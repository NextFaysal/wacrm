import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getSmartCourierRoute } from '@/lib/courier/smart-router';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await req.json();

    const {
      address = '',
      city = '',
      district = '',
      itemWeightKg = 0.5,
      codAmount = 0,
    } = body;

    const recommendation = await getSmartCourierRoute(supabase, {
      accountId,
      customerAddress: address,
      city,
      district,
      itemWeightKg,
      codAmount,
    });

    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
