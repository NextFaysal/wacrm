import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { sendMetaConversionsEvent } from '@/lib/meta/conversions-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketing/capi-test
 * Dispatches a live test event to Meta Conversions API (CAPI)
 * with test_event_code to verify pixel connectivity in Meta Events Manager.
 */
export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await req.json().catch(() => ({}));

    const {
      eventName = 'Purchase',
      testEventCode,
      value = 1450,
      customerPhone = '01711000000',
      customerEmail = 'test@example.com',
    } = body;

    // Check if Meta integration is configured for this account
    const { data: metaConfig } = await supabase
      .from('meta_integrations')
      .select('pixel_id, capi_access_token, capi_test_event_code, capi_enabled')
      .eq('account_id', accountId)
      .maybeSingle();

    const activeTestCode = testEventCode || metaConfig?.capi_test_event_code || 'TEST58493';

    const result = await sendMetaConversionsEvent({
      accountId,
      eventName: eventName as any,
      eventId: `test_ping_${Date.now()}`,
      testEventCode: activeTestCode,
      userData: {
        phone: customerPhone,
        email: customerEmail,
        clientIp: '103.205.180.1',
        clientUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      },
      customData: {
        value: Number(value) || 1450,
        currency: 'BDT',
        content_name: 'Test CAPI Sync Product',
        content_type: 'product',
        num_items: 1,
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        configured: Boolean(metaConfig?.pixel_id),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Meta CAPI Test Event dispatched successfully!',
      testEventCode: activeTestCode,
      eventName,
      pixelId: metaConfig?.pixel_id || 'Configured Pixel',
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
