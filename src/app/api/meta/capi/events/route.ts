import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/meta/capi/events - List recent server-side CAPI events and statistics
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const { data: events, error } = await supabase
      .from('meta_capi_events')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[meta-capi-events] fetch error:', error);
      return NextResponse.json({ events: [], stats: { total: 0, sent: 0, failed: 0 } });
    }

    const list = events || [];
    const total = list.length;
    const sent = list.filter((e) => e.status === 'sent').length;
    const failed = list.filter((e) => e.status === 'failed').length;

    return NextResponse.json({
      success: true,
      stats: { total, sent, failed },
      events: list,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
