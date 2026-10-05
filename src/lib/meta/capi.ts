import { createHash } from 'crypto';

export interface MetaCapiConfig {
  pixelId?: string;
  accessToken?: string;
  testEventCode?: string;
}

export interface CapiUserData {
  phone?: string;
  name?: string;
  email?: string;
  city?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

export interface CapiCustomData {
  value?: number;
  currency?: string;
  orderId?: string;
  contentName?: string;
  contentType?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  status?: string;
}

export interface MetaCapiEventPayload {
  eventName: 'Purchase' | 'InitiateCheckout' | 'Lead' | 'Contact' | 'CompleteRegistration';
  eventId?: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: 'chat' | 'website' | 'system_generated' | 'other';
  userData: CapiUserData;
  customData?: CapiCustomData;
}

export interface CapiResponse {
  success: boolean;
  eventsReceived?: number;
  fbtraceId?: string;
  error?: string;
}

/**
 * Standard Meta SHA-256 Normalizer & Hasher
 */
export function hashMetaField(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normalizes Bangladeshi or international phone number for Meta CAPI
 * Meta requires country code digits without leading '+' or whitespace (e.g. '8801712345678')
 */
export function normalizePhoneForMeta(rawPhone?: string | null): string | undefined {
  if (!rawPhone) return undefined;
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    digits = '88' + digits;
  }
  return digits.length >= 10 ? digits : undefined;
}

/**
 * Dispatches an event to Meta Conversions API (CAPI) Graph API v21.0
 */
export async function sendMetaCapiEvent(
  config: MetaCapiConfig,
  event: MetaCapiEventPayload
): Promise<CapiResponse> {
  const pixelId = config.pixelId || process.env.META_PIXEL_ID;
  const accessToken = config.accessToken || process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    return {
      success: false,
      error: 'Meta Pixel ID or CAPI Access Token is not configured.',
    };
  }

  const normalizedPhone = normalizePhoneForMeta(event.userData.phone);
  const hashedPhone = hashMetaField(normalizedPhone);
  const hashedName = hashMetaField(event.userData.name);
  const hashedEmail = hashMetaField(event.userData.email);
  const hashedCity = hashMetaField(event.userData.city || 'dhaka');
  const hashedCountry = hashMetaField(event.userData.country || 'bd');
  const hashedExternalId = hashMetaField(event.userData.externalId);

  const eventTime = event.eventTime || Math.floor(Date.now() / 1000);
  const eventId = event.eventId || `evt_${eventTime}_${Math.random().toString(36).substring(2, 9)}`;

  const eventData: Record<string, unknown> = {
    event_name: event.eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: event.actionSource || 'chat',
    event_source_url: event.eventSourceUrl || 'https://api.whatsapp.com',
    user_data: {
      ...(hashedPhone ? { ph: [hashedPhone] } : {}),
      ...(hashedName ? { fn: [hashedName] } : {}),
      ...(hashedEmail ? { em: [hashedEmail] } : {}),
      ...(hashedCity ? { ct: [hashedCity] } : {}),
      ...(hashedCountry ? { country: [hashedCountry] } : {}),
      ...(hashedExternalId ? { external_id: [hashedExternalId] } : {}),
      ...(event.userData.clientIpAddress ? { client_ip_address: event.userData.clientIpAddress } : {}),
      ...(event.userData.clientUserAgent ? { client_user_agent: event.userData.clientUserAgent } : {}),
    },
  };

  if (event.customData) {
    eventData.custom_data = {
      value: event.customData.value || 0,
      currency: event.customData.currency || 'BDT',
      content_type: event.customData.contentType || 'product',
      ...(event.customData.orderId ? { order_id: event.customData.orderId } : {}),
      ...(event.customData.contentName ? { content_name: event.customData.contentName } : {}),
      ...(event.customData.contents ? { contents: event.customData.contents } : {}),
      ...(event.customData.status ? { status: event.customData.status } : {}),
    };
  }

  const payload: Record<string, unknown> = {
    data: [eventData],
  };

  const testCode = config.testEventCode || process.env.META_CAPI_TEST_CODE;
  if (testCode) {
    payload.test_event_code = testCode;
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: body?.error?.message || `Meta CAPI error (HTTP ${res.status})`,
        fbtraceId: body?.error?.fbtrace_id,
      };
    }

    return {
      success: true,
      eventsReceived: body.events_received ?? 1,
      fbtraceId: body.fbtrace_id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Meta CAPI network error: ${msg}`,
    };
  }
}

/**
 * Convenience helper to track a Purchase event from an Order
 */
export async function trackOrderPurchaseCapi(
  config: MetaCapiConfig,
  order: {
    id: string;
    invoice_no?: string;
    total_amount: number;
    customer_phone?: string;
    customer_name?: string;
    city?: string;
    items?: Array<{ id: string; name?: string; quantity: number; price?: number }>;
  }
): Promise<CapiResponse> {
  return sendMetaCapiEvent(config, {
    eventName: 'Purchase',
    eventId: order.invoice_no || order.id,
    actionSource: 'chat',
    userData: {
      phone: order.customer_phone,
      name: order.customer_name,
      city: order.city,
      externalId: order.id,
    },
    customData: {
      value: order.total_amount,
      currency: 'BDT',
      orderId: order.invoice_no || order.id,
      contents: order.items?.map((item) => ({
        id: item.id,
        quantity: item.quantity || 1,
        item_price: item.price,
      })),
    },
  });
}

/**
 * Resolves Meta CAPI config from DB (business_settings) or environment variables
 */
export async function getMetaCapiConfig(
  accountId?: string,
  db?: any
): Promise<MetaCapiConfig> {
  const envPixel = process.env.META_PIXEL_ID;
  const envToken = process.env.META_CAPI_ACCESS_TOKEN;
  const envTest = process.env.META_CAPI_TEST_CODE;

  if (accountId && db && typeof db.from === 'function') {
    try {
      const { data } = await db
        .from('business_settings')
        .select('meta_pixel_id, meta_capi_access_token, meta_capi_test_code')
        .eq('account_id', accountId)
        .maybeSingle();

      if (data?.meta_pixel_id && data?.meta_capi_access_token) {
        return {
          pixelId: data.meta_pixel_id,
          accessToken: data.meta_capi_access_token,
          testEventCode: data.meta_capi_test_code || envTest || undefined,
        };
      }
    } catch {
      // Fallback to env
    }
  }

  return {
    pixelId: envPixel,
    accessToken: envToken,
    testEventCode: envTest,
  };
}
