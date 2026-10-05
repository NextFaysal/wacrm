import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getExperimentsWithAnalysis } from '@/lib/marketing/experiments';

export async function GET() {
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

    const experiments = await getExperimentsWithAnalysis(supabase, membership.account_id);

    return NextResponse.json({
      experiments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch experiments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      name,
      hypothesis,
      testType,
      targetId,
      status = 'running',
      baselineMetrics,
      testMetrics,
    } = body;

    if (!name || !hypothesis || !testType) {
      return NextResponse.json({ error: 'Missing name, hypothesis or testType' }, { status: 400 });
    }

    const { data: newExperiment, error } = await supabase
      .from('growth_experiments')
      .insert({
        account_id: membership.account_id,
        name,
        hypothesis,
        test_type: testType,
        target_id: targetId || null,
        status,
        started_at: status === 'running' ? new Date().toISOString() : null,
        baseline_metrics: baselineMetrics || { visitors: 0, conversions: 0, revenue: 0 },
        test_metrics: testMetrics || { visitors: 0, conversions: 0, revenue: 0 },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      experiment: newExperiment,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create experiment' }, { status: 500 });
  }
}
