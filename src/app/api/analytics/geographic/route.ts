import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGeographicAnalytics } from '@/lib/analytics/geographic';

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getGeographicAnalytics(membership.account_id, startDate, endDate);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error loading geographic analytics' }, { status: 500 });
  }
}
