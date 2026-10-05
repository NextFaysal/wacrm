import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 1. Fetch active sessions in last 15m
    const { data: activeSessions } = await supabase
      .from('tracking_sessions')
      .select('id, detected_channel, landing_page, has_cart_activity, has_checkout_activity, tracking_visitors(device_type, city)')
      .eq('account_id', membership.account_id)
      .gte('started_at', fifteenMinutesAgo);

    // 2. Fetch latest events
    const { data: recentEvents } = await supabase
      .from('tracking_events')
      .select('event_name, page_url, event_time, payload')
      .eq('account_id', membership.account_id)
      .gte('event_time', fifteenMinutesAgo)
      .order('event_time', { ascending: false })
      .limit(20);

    const activeCount = activeSessions?.length || 0;
    const cartCount = activeSessions?.filter(s => s.has_cart_activity).length || 0;
    const checkoutCount = activeSessions?.filter(s => s.has_checkout_activity).length || 0;

    return NextResponse.json({
      activeVisitors: activeCount,
      activeCarts: cartCount,
      activeCheckouts: checkoutCount,
      sessions: activeSessions || [],
      recentEvents: recentEvents || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching live visitors' }, { status: 500 });
  }
}
