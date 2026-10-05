import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active account
    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const result = await calculateAttributionAndPerformance(membership.account_id, startDate, endDate);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error fetching marketing overview:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
