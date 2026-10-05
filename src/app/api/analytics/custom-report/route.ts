import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCustomReport, formatReportAsCSV } from '@/lib/analytics/custom-report';

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
    const channel = searchParams.get('channel') || undefined;
    const status = searchParams.get('status') || undefined;
    const format = searchParams.get('format');

    const result = await generateCustomReport(membership.account_id, {
      startDate,
      endDate,
      channel,
      status,
    });

    if (format === 'csv') {
      const csv = formatReportAsCSV(result.rows);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="growth_sales_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error generating custom report' }, { status: 500 });
  }
}
