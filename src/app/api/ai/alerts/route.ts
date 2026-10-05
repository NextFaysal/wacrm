import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanAndDetectBusinessAnomalies } from '@/lib/ai/anomaly-detector';

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

    const alerts = await scanAndDetectBusinessAnomalies(membership.account_id);
    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching alerts' }, { status: 500 });
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

    const { alertId } = await req.json();
    if (alertId) {
      await supabase
        .from('ai_anomalies_and_alerts')
        .update({ is_resolved: true })
        .eq('id', alertId)
        .eq('account_id', membership.account_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating alert' }, { status: 500 });
  }
}
