import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkSteadfastFraudScore, formatBDPhone } from '@/lib/courier/dispatch';
import type { CourierConfig } from '@/lib/courier/types';

/**
 * GET /api/courier/fraud-check?phone=01XXXXXXXXX
 * Checks customer delivery history and fraud score using Steadfast Courier API.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const cleanPhone = formatBDPhone(phone);
    if (!cleanPhone || cleanPhone.length < 11) {
      return NextResponse.json(
        { error: 'Invalid Bangladeshi phone number (must be 11 digits starting with 01)' },
        { status: 400 }
      );
    }

    // Get Steadfast credentials for this account
    const { data: config, error: configError } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', 'steadfast')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Steadfast Courier is not configured or active for this account' },
        { status: 400 }
      );
    }

    const result = await checkSteadfastFraudScore(config as CourierConfig, cleanPhone);

    return NextResponse.json({
      success: true,
      fraud_check: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fraud check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
