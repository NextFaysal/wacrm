import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMonthlyBusinessReport } from '@/lib/ai/monthly-report';

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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const report = await generateMonthlyBusinessReport(membership.account_id, year, month);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error generating monthly report' }, { status: 500 });
  }
}
