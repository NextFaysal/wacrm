import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { id } = await props.params;

    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('product_stock_logs')
      .select('*')
      .eq('product_id', id)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[stock-logs] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching logs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
