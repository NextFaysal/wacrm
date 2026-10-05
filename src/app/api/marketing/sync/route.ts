import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncGoogleAdsMetrics } from '@/lib/marketing/google-ads';
import { syncTikTokAdsMetrics } from '@/lib/marketing/tiktok-ads';

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

    const body = await req.json().catch(() => ({}));
    const { date } = body;

    // Run parallel syncs for Google & TikTok
    const [googleRes, tiktokRes] = await Promise.all([
      syncGoogleAdsMetrics(supabase, membership.account_id, date),
      syncTikTokAdsMetrics(supabase, membership.account_id, date),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      syncResults: {
        google: googleRes,
        tiktok: tiktokRes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error syncing marketing platforms' }, { status: 500 });
  }
}
