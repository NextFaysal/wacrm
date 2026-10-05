import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { formatBDPhone } from '@/lib/courier/dispatch';
import { scanCustomerRiskProfile } from '@/lib/courier/fraud-shield';

/**
 * GET /api/courier/fraud-check?phone=01XXXXXXXXX
 * Checks customer delivery history, return rate, and fraud score across couriers and CRM history.
 */
export async function GET(request: Request) {
  try {
    const { accountId } = await requireRole('viewer');
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

    const profile = await scanCustomerRiskProfile(accountId, cleanPhone);

    // Shape response so it satisfies existing FraudCheckResult consumers and adds profile data
    const legacyFraudCheck = {
      phone: cleanPhone,
      score: profile.trustScore,
      level: profile.riskLevel === 'TRUSTED' ? 'trusted' : profile.riskLevel === 'MODERATE' ? 'caution' : 'danger',
      reasons: profile.courierReports.length > 0 ? profile.courierReports : [profile.recommendationBangla],
      total_reports: profile.cancelledOrReturned,
      doubtful_reports: profile.riskLevel === 'HIGH_RISK',
      profile,
    };

    return NextResponse.json({
      success: true,
      fraud_check: legacyFraudCheck,
      profile,
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
