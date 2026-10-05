import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ contactId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { contactId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.account_id) return NextResponse.json({ error: 'No account found' }, { status: 400 });

    // 1. Fetch Contact (by UUID or phone)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId);
    let contact: any = null;

    if (isUuid) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('account_id', membership.account_id)
        .maybeSingle();
      contact = data;
    }

    if (!contact) {
      const cleanInput = contactId.replace(/\D/g, '').slice(-10);
      if (cleanInput.length >= 6) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('account_id', membership.account_id)
          .ilike('phone', `%${cleanInput}%`)
          .limit(1)
          .maybeSingle();
        contact = data;
      }
    }

    // Fallback if not registered as contact
    if (!contact) {
      contact = {
        id: contactId,
        name: isUuid ? 'Visitor' : `User (${contactId})`,
        phone: isUuid ? null : contactId,
        created_at: new Date().toISOString(),
      };
    }

    // 2. Fetch Visitor & Sessions
    let visitorQuery = supabase
      .from('tracking_visitors')
      .select('id, visitor_token, device_type, first_seen_at, last_seen_at, total_sessions, total_orders')
      .eq('account_id', membership.account_id);

    if (isUuid) {
      visitorQuery = visitorQuery.or(`contact_id.eq.${contactId},id.eq.${contactId}`);
    } else if (contact.phone) {
      visitorQuery = visitorQuery.ilike('phone', `%${contact.phone.replace(/\D/g, '').slice(-10)}%`);
    }

    const { data: visitors } = await visitorQuery;

    const visitorIds = (visitors || []).map(v => v.id);

    // 3. Fetch Sessions
    let sessions: any[] = [];
    if (visitorIds.length > 0) {
      const { data: sessData } = await supabase
        .from('tracking_sessions')
        .select('*')
        .in('visitor_id', visitorIds)
        .order('started_at', { ascending: false });
      sessions = sessData || [];
    }

    // 4. Fetch Orders
    const cleanPhone = (contact.phone || '').replace(/\D/g, '').slice(-10);
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_attributions(*)')
      .eq('account_id', membership.account_id)
      .ilike('customer_phone', `%${cleanPhone}%`)
      .order('created_at', { ascending: false });

    // 5. Fetch WhatsApp Conversations
    let conversations: any[] = [];
    if (contact?.id && isUuid) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('*, messages(id, content, sender_type, created_at)')
        .eq('account_id', membership.account_id)
        .eq('contact_id', contact.id)
        .order('updated_at', { ascending: false });
      conversations = convData || [];
    }

    // Construct Timeline
    const timeline: Array<{
      type: 'AD_TOUCH' | 'STORE_VISIT' | 'CHAT' | 'ORDER' | 'DELIVERY';
      timestamp: string;
      title: string;
      description: string;
      meta?: any;
    }> = [];

    // Add sessions / touches
    sessions.forEach(s => {
      timeline.push({
        type: s.detected_channel !== 'direct' ? 'AD_TOUCH' : 'STORE_VISIT',
        timestamp: s.started_at,
        title: s.detected_channel !== 'direct' ? `Ad Click via ${s.detected_channel.toUpperCase()}` : 'Direct Store Visit',
        description: `Landing Page: ${s.landing_page} • Campaign: ${s.utm_campaign || 'N/A'}`,
        meta: { channel: s.detected_channel, utm: { source: s.utm_source, campaign: s.utm_campaign } }
      });
    });

    // Add chats
    (conversations || []).forEach(c => {
      timeline.push({
        type: 'CHAT',
        timestamp: c.updated_at || c.created_at,
        title: `WhatsApp Inquiry (${c.status || 'open'})`,
        description: `Total messages exchanged: ${c.messages?.length || 0}`,
        meta: { lastMessage: c.last_message_preview }
      });
    });

    // Add orders & deliveries
    (orders || []).forEach(o => {
      timeline.push({
        type: 'ORDER',
        timestamp: o.created_at,
        title: `Order Placed #${o.order_number || o.id.slice(0, 8)}`,
        description: `Total: ৳${o.total} • Status: ${o.status}`,
        meta: { orderId: o.id, status: o.status }
      });

      if (o.delivery_status === 'delivered') {
        timeline.push({
          type: 'DELIVERY',
          timestamp: o.delivered_at || o.updated_at || o.created_at,
          title: `Courier Delivery Completed`,
          description: `Consignment delivered via ${o.courier_name || 'Courier'}. Payment collected.`,
          meta: { courier: o.courier_name }
        });
      }
    });

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      contact,
      visitors: visitors || [],
      sessions,
      orders: orders || [],
      timeline,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching customer journey' }, { status: 500 });
  }
}
