import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { askAiCommandCenter } from '@/lib/ai/growth-intelligence';

export async function POST(req: NextRequest) {
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

    const { question } = await req.json();
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const result = await askAiCommandCenter(membership.account_id, question);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error answering command center query:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
