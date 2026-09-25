import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getSteadfastBalance } from '@/lib/courier/dispatch';
import type { CourierConfig } from '@/lib/courier/types';

/**
 * GET /api/courier/balance?provider=steadfast
 * Check merchant balance from the courier provider.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'steadfast';

    if (provider !== 'steadfast') {
      return NextResponse.json(
        { error: 'Balance check is currently supported for Steadfast Courier' },
        { status: 400 }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: `${provider} is not configured or active for this account` },
        { status: 400 }
      );
    }

    const result = await getSteadfastBalance(config as CourierConfig);

    return NextResponse.json({
      success: true,
      provider,
      balance: result.current_balance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Balance check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
