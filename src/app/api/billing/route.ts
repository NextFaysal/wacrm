import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccountPlan, PLAN_TIERS, PlanTier } from '@/lib/billing/plan-guard';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const planInfo = await getAccountPlan(supabase, membership.account_id);

    return NextResponse.json({
      account: {
        id: membership.account_id,
        role: membership.role,
      },
      currentPlan: planInfo,
      availablePlans: Object.entries(PLAN_TIERS).map(([tierKey, plan]) => ({
        id: tierKey,
        ...plan,
        isCurrent: planInfo.tier === tierKey,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch billing info' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.account_id || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Owner role required' }, { status: 403 });
    }

    const body = await req.json();
    const { planTier } = body;

    if (!planTier || !PLAN_TIERS[planTier as PlanTier]) {
      return NextResponse.json({ error: 'Invalid plan tier selected' }, { status: 400 });
    }

    const { error } = await supabase
      .from('accounts')
      .update({
        plan_tier: planTier,
        subscription_status: 'active',
        billing_cycle_start: new Date().toISOString(),
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', membership.account_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Plan upgraded to ${planTier.toUpperCase()} successfully`,
      tier: planTier,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update plan' }, { status: 500 });
  }
}
