import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getPathaoStores } from '@/lib/courier/pathao';
import type { CourierConfig } from '@/lib/courier/types';

/**
 * GET /api/courier/pathao/stores
 * List stores registered under the account's Pathao Merchant credentials.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data: config, error } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', 'pathao')
      .single();

    if (error || !config) {
      return NextResponse.json(
        { error: 'Pathao Courier is not configured for this account' },
        { status: 400 }
      );
    }

    const stores = await getPathaoStores(config as CourierConfig, supabase);

    return NextResponse.json({
      success: true,
      stores,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Pathao stores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
