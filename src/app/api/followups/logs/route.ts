import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const { data: logs, error } = await supabase
      .from('followup_logs')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[followup-logs] query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
