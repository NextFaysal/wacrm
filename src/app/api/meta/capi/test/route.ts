import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { sendMetaConversionsEvent } from '@/lib/meta/conversions-api';

/**
 * POST /api/meta/capi/test - Send a test event to Meta Conversions API
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const body = await request.json().catch(() => ({}));

    const result = await sendMetaConversionsEvent({
      accountId,
      eventName: body.eventName || 'Purchase',
      eventSourceUrl: body.url || process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm.local',
      testEventCode: body.testEventCode,
      userData: {
        phone: body.phone || '01711223344',
        email: body.email || 'customer@test.com',
        firstName: body.firstName || 'Test',
        lastName: body.lastName || 'Customer',
        clientIp: '127.0.0.1',
      },
      customData: {
        value: Number(body.value) || 1500,
        currency: body.currency || 'BDT',
        content_name: 'Test Product Order',
        num_items: 1,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, details: result }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test event dispatched to Meta Conversions API successfully! Check Events Manager.',
      result,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
