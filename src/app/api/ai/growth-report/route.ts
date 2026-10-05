import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyBusinessReport } from '@/lib/ai/growth-intelligence';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const date = searchParams.get('date') || undefined;

    const report = await generateDailyBusinessReport(membership.account_id, date);

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Error generating growth report:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
