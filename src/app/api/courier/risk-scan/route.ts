import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { scanCustomerRiskProfile } from '@/lib/courier/fraud-shield';

/**
 * GET /api/courier/risk-scan?phone=017XXXXXXXX
 * Scans customer across couriers & CRM to compute risk score & recommendation
 */
export async function GET(request: Request) {
  try {
    const { accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const profile = await scanCustomerRiskProfile(accountId, phone);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return toErrorResponse(err);
  }
}
