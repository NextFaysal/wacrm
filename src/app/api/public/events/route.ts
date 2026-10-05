import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { incrementPlanUsage } from '@/lib/billing/plan-guard';

// Service role client to safely record analytics without requiring user auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      accountId,
      visitorToken,
      sessionToken,
      eventName,
      pageUrl,
      referrer,
      channel,
      utm = {},
      payload = {},
    } = body;

    if (!visitorToken || !sessionToken || !eventName) {
      return NextResponse.json({ error: 'Missing required tokens or eventName' }, { status: 400 });
    }

    // Resolve Account ID if not provided explicitly
    if (!accountId) {
      // Find the first account or account matching default
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .limit(1);

      if (accounts && accounts.length > 0) {
        accountId = accounts[0].id;
      } else {
        return NextResponse.json({ error: 'Tenant account not found' }, { status: 404 });
      }
    }

    // Extract device/client info from User-Agent & headers
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    const isMobile = /mobile|iphone|android|ipad/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';

    // 1. Upsert Visitor
    let visitorId: string | null = null;
    const { data: existingVisitor } = await supabase
      .from('tracking_visitors')
      .select('id, total_sessions, contact_id')
      .eq('account_id', accountId)
      .eq('visitor_token', visitorToken)
      .maybeSingle();

    if (existingVisitor) {
      visitorId = existingVisitor.id;
      await supabase
        .from('tracking_visitors')
        .update({
          last_seen_at: new Date().toISOString(),
          ip_address: ipAddress || undefined,
        })
        .eq('id', visitorId);
    } else {
      const { data: newVisitor } = await supabase
        .from('tracking_visitors')
        .insert({
          account_id: accountId,
          visitor_token: visitorToken,
          device_type: deviceType,
          ip_address: ipAddress,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_sessions: 1,
        })
        .select('id')
        .single();

      if (newVisitor) {
        visitorId = newVisitor.id;
      }
    }

    if (!visitorId) {
      return NextResponse.json({ error: 'Could not create or find visitor' }, { status: 500 });
    }

    // 2. Upsert Session
    let sessionId: string | null = null;
    const { data: existingSession } = await supabase
      .from('tracking_sessions')
      .select('id, page_views_count, has_cart_activity, has_checkout_activity, has_order_activity')
      .eq('account_id', accountId)
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existingSession) {
      sessionId = existingSession.id;
      const updates: Record<string, any> = {
        ended_at: new Date().toISOString(),
      };
      if (eventName === 'PageView') {
        updates.page_views_count = (existingSession.page_views_count || 1) + 1;
      }
      if (eventName === 'AddToCart') {
        updates.has_cart_activity = true;
      }
      if (eventName === 'CheckoutStarted') {
        updates.has_checkout_activity = true;
      }
      if (eventName === 'Purchase') {
        updates.has_order_activity = true;
      }

      await supabase.from('tracking_sessions').update(updates).eq('id', sessionId);
    } else {
      const { data: newSession } = await supabase
        .from('tracking_sessions')
        .insert({
          account_id: accountId,
          visitor_id: visitorId,
          session_token: sessionToken,
          landing_page: pageUrl || '/',
          referrer: referrer || null,
          utm_source: utm.source || null,
          utm_medium: utm.medium || null,
          utm_campaign: utm.campaign || null,
          utm_term: utm.term || null,
          utm_content: utm.content || null,
          fbclid: utm.fbclid || null,
          gclid: utm.gclid || null,
          ttclid: utm.ttclid || null,
          detected_channel: channel || 'direct',
          has_cart_activity: eventName === 'AddToCart',
          has_checkout_activity: eventName === 'CheckoutStarted',
          has_order_activity: eventName === 'Purchase',
        })
        .select('id')
        .single();

      if (newSession) {
        sessionId = newSession.id;
        // Bump visitor session counter
        if (existingVisitor) {
          await supabase
            .from('tracking_visitors')
            .update({ total_sessions: (existingVisitor.total_sessions || 1) + 1 })
            .eq('id', visitorId);
        }
        // Increment monthly plan session usage
        void incrementPlanUsage(supabase, accountId, 'sessions');
      }
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Could not create or find session' }, { status: 500 });
    }

    // 3. Insert Tracking Event
    const productId = payload.productId || null;
    const orderId = payload.orderId || null;

    if (eventName === 'Purchase') {
      void incrementPlanUsage(supabase, accountId, 'orders');
    }

    await supabase.from('tracking_events').insert({
      account_id: accountId,
      visitor_id: visitorId,
      session_id: sessionId,
      event_name: eventName,
      page_url: pageUrl || '/',
      product_id: productId,
      order_id: orderId,
      payload: payload,
    });

    // 4. Identity Stitching: If phone or contact provided, link contact
    const customerPhone = payload.phone || payload.customerPhone || null;
    if (customerPhone) {
      const cleanPhone = String(customerPhone).replace(/\D/g, '');
      const { data: matchedContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .maybeSingle();

      if (matchedContact) {
        await supabase
          .from('tracking_visitors')
          .update({ contact_id: matchedContact.id })
          .eq('id', visitorId);
      }
    }

    // 5. Attribution Creation on Purchase
    if (eventName === 'Purchase' && orderId) {
      const orderRevenue = Number(payload.total || payload.orderTotal || 0);

      // Create or update order_attributions
      await supabase.from('order_attributions').upsert(
        {
          account_id: accountId,
          order_id: orderId,
          visitor_id: visitorId,
          session_id: sessionId,
          first_touch_channel: channel || 'direct',
          last_touch_channel: channel || 'direct',
          order_total_revenue: orderRevenue,
          order_status: 'pending',
          is_delivered: false,
        },
        { onConflict: 'account_id,order_id' }
      );

      // Update visitor lifetime orders & revenue
      const { data: vis } = await supabase
        .from('tracking_visitors')
        .select('total_orders, total_revenue')
        .eq('id', visitorId)
        .single();

      if (vis) {
        await supabase
          .from('tracking_visitors')
          .update({
            total_orders: (vis.total_orders || 0) + 1,
            total_revenue: (Number(vis.total_revenue) || 0) + orderRevenue,
          })
          .eq('id', visitorId);
      }
    }

    return NextResponse.json({ success: true, visitorId, sessionId });
  } catch (err: any) {
    console.error('Failed to ingest tracking event:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
