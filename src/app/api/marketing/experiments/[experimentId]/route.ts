import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ experimentId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { experimentId } = await context.params;
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
    const { status, baselineMetrics, testMetrics, aiEvaluation } = body;

    const updates: any = {};
    if (status) {
      updates.status = status;
      if (status === 'concluded') updates.concluded_at = new Date().toISOString();
      if (status === 'running') updates.started_at = new Date().toISOString();
    }
    if (baselineMetrics) updates.baseline_metrics = baselineMetrics;
    if (testMetrics) updates.test_metrics = testMetrics;
    if (aiEvaluation) updates.ai_evaluation = aiEvaluation;

    const { data: updated, error } = await supabase
      .from('growth_experiments')
      .update(updates)
      .eq('id', experimentId)
      .eq('account_id', membership.account_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      experiment: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update experiment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { experimentId } = await context.params;
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

    const { error } = await supabase
      .from('growth_experiments')
      .delete()
      .eq('id', experimentId)
      .eq('account_id', membership.account_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete experiment' }, { status: 500 });
  }
}
