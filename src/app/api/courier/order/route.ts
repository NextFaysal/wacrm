import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { dispatchCourierOrder } from '@/lib/courier/dispatch';
import type { CourierOrderInput } from '@/lib/courier/types';

/**
 * GET /api/courier/order?contact_id=...&conversation_id=...
 * Fetch past courier orders for this contact or account.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const conversationId = searchParams.get('conversation_id');

    let query = supabase
      .from('courier_orders')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    } else if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[courier/order] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/courier/order
 * Sends order details to the selected courier's API and records the consignment.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');
    const body = (await request.json().catch(() => null)) as CourierOrderInput | null;

    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const {
      provider,
      recipient_name,
      recipient_phone,
      recipient_address,
      cod_amount,
      invoice_id,
      note,
      conversation_id,
      contact_id,
    } = body;

    if (!provider || !recipient_name || !recipient_phone || !recipient_address) {
      return NextResponse.json(
        { error: 'Recipient name, phone, address, and courier provider are required' },
        { status: 400 }
      );
    }

    // 1. Fetch courier config for this account & provider
    const { data: config, error: configErr } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', provider)
      .maybeSingle();

    if (configErr) {
      console.error('[courier/order] config lookup error:', configErr);
      return NextResponse.json({ error: 'Failed to check courier settings' }, { status: 500 });
    }

    if (!config || !config.is_active || !config.api_key) {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} Courier is not configured or inactive. Configure it in Settings → Courier.`,
          code: 'courier_not_configured',
        },
        { status: 400 }
      );
    }

    // 2. Dispatch to Courier API
    let result;
    try {
      result = await dispatchCourierOrder(
        config,
        {
          provider,
          recipient_name,
          recipient_phone,
          recipient_address,
          cod_amount: Number(cod_amount) || 0,
          invoice_id,
          note,
        },
        supabase
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Courier API dispatch failed';
      console.error(`[courier/order] ${provider} error:`, msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    // 3. Save order to database
    const { data: orderRow, error: saveErr } = await supabase
      .from('courier_orders')
      .insert({
        account_id: accountId,
        conversation_id: conversation_id || null,
        contact_id: contact_id || null,
        provider,
        consignment_id: result.consignment_id || null,
        tracking_code: result.tracking_code,
        tracking_url: result.tracking_url,
        invoice_id: invoice_id || null,
        recipient_name,
        recipient_phone,
        recipient_address,
        cod_amount: Number(cod_amount) || 0,
        delivery_charge: result.delivery_charge || 0,
        note: note || null,
        status: result.status || 'in_review',
        created_by: userId,
      })
      .select()
      .single();

    if (saveErr) {
      console.error('[courier/order] save error:', saveErr);
      // Still return the tracking code since the courier accepted the order
      return NextResponse.json({
        success: true,
        warning: 'Order created with courier but failed to save in database',
        order: result,
      });
    }

    return NextResponse.json({ success: true, order: orderRow });
  } catch (err) {
    return toErrorResponse(err);
  }
}
