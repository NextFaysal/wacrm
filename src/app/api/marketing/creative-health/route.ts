import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeCreativeFatigue } from '@/lib/marketing/creative-fatigue';

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

    const healthData = await analyzeCreativeFatigue(supabase, membership.account_id);

    return NextResponse.json(healthData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error analyzing ad fatigue' }, { status: 500 });
  }
}
