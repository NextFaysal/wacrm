import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

let _adminClient: any = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

/**
 * SHA-256 hash helper required by Meta Conversions API
 */
export function sha256Hash(value?: string | null): string | undefined {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Format and hash phone number to E.164 (without plus) for Meta CAPI
 */
export function hashPhoneForMeta(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, '');
  // If Bangladesh local number (01XXXXXXXXX), add 88 country code
  if (digits.startsWith('01') && digits.length === 11) {
    digits = `88${digits}`;
  } else if (digits.startsWith('8801') && digits.length === 13) {
    // already has country code
  }
  return sha256Hash(digits);
}

export interface CapiUserData {
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface CapiCustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  order_id?: string;
}

export interface DispatchCapiEventParams {
  accountId: string;
  eventName: 'Purchase' | 'InitiateCheckout' | 'AddToCart' | 'Lead' | 'ViewContent';
  eventId?: string;
  eventSourceUrl?: string;
  userData: CapiUserData;
  customData?: CapiCustomData;
  testEventCode?: string; // Optional test code to see live in Meta Events Manager
}

/**
 * Dispatches server-side event to Meta Conversions API (CAPI)
 */
export async function sendMetaConversionsEvent(params: DispatchCapiEventParams) {
  const db = getAdminClient();

  // 1. Fetch Meta config for this account
  const { data: config } = await db
    .from('meta_integrations')
    .select('pixel_id, capi_access_token, page_access_token, capi_test_event_code, capi_enabled')
    .eq('account_id', params.accountId)
    .single();

  if (!config) {
    console.warn('[meta-capi] No Meta config found for account:', params.accountId);
    return { success: false, error: 'Meta config missing' };
  }

  if (config.capi_enabled === false) {
    return { success: false, error: 'CAPI is disabled for this account' };
  }

  const pixelId = config.pixel_id;
  const token = config.capi_access_token || config.page_access_token;

  if (!pixelId || !token) {
    console.warn('[meta-capi] Pixel ID or Token missing for account:', params.accountId);
    return { success: false, error: 'Pixel ID or Access Token is missing' };
  }

  const eventId = params.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const eventTime = Math.floor(Date.now() / 1000);
  const testCode = params.testEventCode || config.capi_test_event_code;

  // 2. Build User Data (SHA-256 hashed where required)
  const userDataPayload: Record<string, any> = {};

  if (params.userData.phone) {
    const hashedPhone = hashPhoneForMeta(params.userData.phone);
    if (hashedPhone) userDataPayload.ph = [hashedPhone];
  }

  if (params.userData.email) {
    const hashedEmail = sha256Hash(params.userData.email);
    if (hashedEmail) userDataPayload.em = [hashedEmail];
  }

  if (params.userData.firstName) {
    const hashedFn = sha256Hash(params.userData.firstName);
    if (hashedFn) userDataPayload.fn = [hashedFn];
  }

  if (params.userData.clientIp) {
    userDataPayload.client_ip_address = params.userData.clientIp;
  }

  if (params.userData.clientUserAgent) {
    userDataPayload.client_user_agent = params.userData.clientUserAgent;
  }

  if (params.userData.fbp) {
    userDataPayload.fbp = params.userData.fbp;
  }

  if (params.userData.fbc) {
    userDataPayload.fbc = params.userData.fbc;
  }

  // 3. Assemble Meta CAPI Event Object
  const eventObject: Record<string, any> = {
    event_name: params.eventName,
    event_time: eventTime,
    event_id: eventId,
    event_source_url: params.eventSourceUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm.local',
    action_source: 'website',
    user_data: userDataPayload,
  };

  if (params.customData) {
    eventObject.custom_data = {
      value: params.customData.value || 0,
      currency: params.customData.currency || 'BDT',
      content_name: params.customData.content_name,
      content_ids: params.customData.content_ids,
      content_type: params.customData.content_type || 'product',
      num_items: params.customData.num_items || 1,
      order_id: params.customData.order_id,
    };
  }

  const payload: Record<string, any> = {
    data: [eventObject],
  };

  if (testCode) {
    payload.test_event_code = testCode;
  }

  // 4. Send HTTP POST to Meta Graph API
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();
    const isSuccess = res.ok && !responseData.error;

    // 5. Log CAPI Event in database
    await db.from('meta_capi_events').insert({
      account_id: params.accountId,
      event_name: params.eventName,
      event_id: eventId,
      event_time: eventTime,
      event_source_url: eventObject.event_source_url,
      customer_phone: params.userData.phone || null,
      customer_email: params.userData.email || null,
      currency: params.customData?.currency || 'BDT',
      value: params.customData?.value || 0,
      status: isSuccess ? 'sent' : 'failed',
      error_message: isSuccess ? null : responseData?.error?.message || 'Meta CAPI failed',
      meta_response: responseData,
    });

    if (!isSuccess) {
      console.error('[meta-capi] Meta returned error:', responseData?.error);
      return { success: false, error: responseData?.error?.message, response: responseData };
    }

    return {
      success: true,
      eventsReceived: responseData.events_received,
      fbtraceId: responseData.fbtrace_id,
    };
  } catch (err: any) {
    console.error('[meta-capi] Network/Dispatch error:', err);
    await db.from('meta_capi_events').insert({
      account_id: params.accountId,
      event_name: params.eventName,
      event_id: eventId,
      event_time: eventTime,
      status: 'failed',
      error_message: err?.message || 'Network error',
    });
    return { success: false, error: err?.message || 'Network error' };
  }
}
