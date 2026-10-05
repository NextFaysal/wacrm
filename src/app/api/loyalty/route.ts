import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { calculateCustomerLoyaltyTier } from '@/lib/loyalty/vip-engine';

/**
 * GET /api/loyalty
 * Query params: ?phone=017...
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone')?.trim();

    if (phone) {
      // 1. Fetch customer loyalty profile
      const { data: profile } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('account_id', accountId)
        .eq('customer_phone', phone)
        .maybeSingle();

      // 2. Fetch customer recent orders to compute tier live if profile does not exist yet
      const { data: customerOrders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, product_name, quantity, customer_name')
        .eq('account_id', accountId)
        .eq('customer_phone', phone);

      const calculated = calculateCustomerLoyaltyTier(customerOrders || []);

      // 3. Fetch transaction history
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('account_id', accountId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(20);

      return NextResponse.json({
        success: true,
        profile: profile || {
          customer_phone: phone,
          customer_name: customerOrders?.[0]?.customer_name || 'Customer',
          tier: calculated.tier,
          points_balance: Math.floor(calculated.totalSpend / 100),
          cashback_balance: Math.round(calculated.totalSpend * 0.02),
          total_spend: calculated.totalSpend,
          total_orders: calculated.totalOrders,
        },
        calculated,
        transactions: transactions || [],
      });
    }

    // List top loyalty members
    const { data: topMembers, error } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('account_id', accountId)
      .order('points_balance', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[loyalty] fetch list error:', error);
      return NextResponse.json({ members: [] });
    }

    return NextResponse.json({ success: true, members: topMembers || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/loyalty
 * Action: 'adjust' | 'sync_customer' | 'redeem'
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.phone?.trim()) {
      return NextResponse.json({ error: 'Customer phone is required' }, { status: 400 });
    }

    const phone = body.phone.trim();
    const action = body.action || 'sync_customer';

    // 1. Fetch current profile or create
    let { data: profile } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('account_id', accountId)
      .eq('customer_phone', phone)
      .maybeSingle();

    if (action === 'sync_customer') {
      const { data: customerOrders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, customer_name')
        .eq('account_id', accountId)
        .eq('customer_phone', phone);

      const calculated = calculateCustomerLoyaltyTier(customerOrders || []);
      const pointsCalculated = Math.floor(calculated.totalSpend / 100);
      const cashbackCalculated = Math.round(calculated.totalSpend * 0.02);
      const customerName = body.customer_name || customerOrders?.[0]?.customer_name || 'Customer';

      if (!profile) {
        const { data: newProfile, error: insErr } = await supabase
          .from('customer_loyalty')
          .insert({
            account_id: accountId,
            customer_phone: phone,
            customer_name: customerName,
            tier: calculated.tier,
            points_balance: pointsCalculated,
            cashback_balance: cashbackCalculated,
            total_spend: calculated.totalSpend,
            total_orders: calculated.totalOrders,
          })
          .select()
          .single();

        if (insErr) {
          return NextResponse.json({ error: 'Failed to create loyalty profile' }, { status: 500 });
        }
        profile = newProfile;
      } else {
        const { data: updatedProfile, error: updErr } = await supabase
          .from('customer_loyalty')
          .update({
            customer_name: customerName,
            tier: calculated.tier,
            total_spend: calculated.totalSpend,
            total_orders: calculated.totalOrders,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id)
          .select()
          .single();

        if (updErr) {
          return NextResponse.json({ error: 'Failed to update loyalty profile' }, { status: 500 });
        }
        profile = updatedProfile;
      }

      return NextResponse.json({ success: true, profile, calculated });
    }

    if (action === 'adjust') {
      const pointsDelta = parseInt(body.pointsDelta, 10) || 0;
      const cashbackDelta = parseFloat(body.cashbackDelta) || 0;
      const description = body.description?.trim() || 'Manual Admin Adjustment';

      const currentPoints = profile ? profile.points_balance : 0;
      const currentCashback = profile ? Number(profile.cashback_balance) || 0 : 0;
      const newPoints = Math.max(0, currentPoints + pointsDelta);
      const newCashback = Math.max(0, currentCashback + cashbackDelta);

      if (!profile) {
        const { data: created } = await supabase
          .from('customer_loyalty')
          .insert({
            account_id: accountId,
            customer_phone: phone,
            customer_name: body.customerName || 'Customer',
            points_balance: newPoints,
            cashback_balance: newCashback,
          })
          .select()
          .single();
        profile = created;
      } else {
        const { data: updated } = await supabase
          .from('customer_loyalty')
          .update({
            points_balance: newPoints,
            cashback_balance: newCashback,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id)
          .select()
          .single();
        profile = updated;
      }

      // Log transaction
      await supabase.from('loyalty_transactions').insert({
        account_id: accountId,
        customer_phone: phone,
        type: 'manual_adjustment',
        points: pointsDelta,
        cashback_amount: cashbackDelta,
        balance_after: newPoints,
        description,
      });

      return NextResponse.json({ success: true, profile });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
