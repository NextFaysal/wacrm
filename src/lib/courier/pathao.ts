import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourierConfig, CourierOrderInput, CourierOrderResult } from './types';
import { formatBDPhone, getTrackingUrl } from './utils';

interface PathaoStore {
  store_id: number;
  store_name: string;
  store_address: string;
  is_active: number;
  is_default_store: boolean | number;
}

/**
 * Returns the active Pathao base URL depending on sandbox toggle.
 */
export function getPathaoBaseUrl(config: CourierConfig): string {
  const meta = (config.metadata as Record<string, unknown>) || {};
  const isSandbox = Boolean(meta.is_sandbox) || config.api_key.includes('sandbox') || config.api_key === '7N1aMJQbWm';
  return isSandbox
    ? 'https://courier-api-sandbox.pathao.com'
    : 'https://api-hermes.pathao.com';
}

/**
 * Ensures a valid Pathao OAuth access token.
 * Caches token in courier_configs.metadata and refreshes automatically.
 */
export async function getPathaoAccessToken(
  config: CourierConfig,
  supabase?: SupabaseClient
): Promise<string> {
  const meta = ((config.metadata as Record<string, unknown>) || {});
  const now = Date.now();

  const cachedToken = typeof meta.access_token === 'string' ? meta.access_token : null;
  const expiresAt = typeof meta.token_expires_at === 'number' ? meta.token_expires_at : 0;

  // Use cached token if still valid (with 5-minute safety buffer)
  if (cachedToken && expiresAt > now + 300_000) {
    return cachedToken;
  }

  const baseUrl = getPathaoBaseUrl(config);
  const clientId = config.api_key;
  const clientSecret = config.secret_key || '';
  const username = typeof meta.username === 'string' ? meta.username : '';
  const password = typeof meta.password === 'string' ? meta.password : '';
  const refreshToken = typeof meta.refresh_token === 'string' ? meta.refresh_token : null;

  let tokenData: { access_token: string; refresh_token?: string; expires_in: number } | null = null;

  // 1. Try refresh token if available
  if (refreshToken) {
    try {
      const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      if (res.ok) {
        tokenData = await res.json();
      }
    } catch {
      // Fallback to password grant
    }
  }

  // 2. Fallback to password grant
  if (!tokenData && username && password) {
    const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'password',
        username,
        password,
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) {
      const msg = body?.message || body?.error || `Pathao authentication failed (${res.status})`;
      throw new Error(msg);
    }
    tokenData = body;
  }

  if (!tokenData?.access_token) {
    throw new Error('Could not obtain Pathao access token. Please verify Client ID, Secret, Username, and Password in Settings.');
  }

  const newExpiresAt = now + (Number(tokenData.expires_in) || 432000) * 1000;

  // Save new tokens to metadata if supabase client is provided
  if (supabase && config.account_id) {
    const updatedMeta = {
      ...meta,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      token_expires_at: newExpiresAt,
    };

    await supabase
      .from('courier_configs')
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', config.account_id)
      .eq('provider', 'pathao');
  }

  return tokenData.access_token;
}

/**
 * Fetch all stores registered in the merchant's Pathao account.
 */
export async function getPathaoStores(
  config: CourierConfig,
  supabase?: SupabaseClient
): Promise<PathaoStore[]> {
  const token = await getPathaoAccessToken(config, supabase);
  const baseUrl = getPathaoBaseUrl(config);

  const res = await fetch(`${baseUrl}/aladdin/api/v1/stores`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || `Failed to fetch Pathao stores (${res.status})`);
  }

  const rawList = json?.data?.data || json?.data || [];
  return rawList;
}

/**
 * Dispatches an order to Pathao Courier.
 */
export async function sendToPathao(
  config: CourierConfig,
  input: CourierOrderInput,
  invoiceId: string,
  supabase?: SupabaseClient
): Promise<CourierOrderResult> {
  const token = await getPathaoAccessToken(config, supabase);
  const baseUrl = getPathaoBaseUrl(config);
  const meta = (config.metadata as Record<string, unknown>) || {};

  // Resolve store_id
  let storeId = Number(meta.store_id);
  if (!storeId) {
    // Attempt auto-resolving default store
    const stores = await getPathaoStores(config, supabase).catch(() => []);
    const defaultStore = stores.find((s) => s.is_default_store) || stores[0];
    if (defaultStore) {
      storeId = defaultStore.store_id;
    }
  }

  if (!storeId) {
    throw new Error('Pathao Store ID is missing. Please configure your Store ID in Settings → Courier → Pathao.');
  }

  const cleanPhone = formatBDPhone(input.recipient_phone);
  if (!cleanPhone || cleanPhone.length < 11) {
    throw new Error('Valid 11-digit phone number is required for Pathao delivery');
  }

  const payload = {
    store_id: storeId,
    merchant_order_id: invoiceId,
    recipient_name: input.recipient_name.trim().slice(0, 100),
    recipient_phone: cleanPhone,
    recipient_address: input.recipient_address.trim().slice(0, 220),
    delivery_type: 48, // 48: Normal Delivery, 12: On Demand
    item_type: 2, // 1: Document, 2: Parcel
    special_instruction: (input.note || '').trim(),
    item_quantity: 1,
    item_weight: 0.5,
    item_description: 'Standard parcel',
    amount_to_collect: Math.max(0, Math.round(Number(input.cod_amount) || 0)),
  };

  const response = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || (data?.code && data.code !== 200)) {
    const errorMsg = data?.errors
      ? (typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors))
      : data?.message || `Pathao API error (${response.status})`;
    throw new Error(errorMsg);
  }

  const consignmentId = data?.data?.consignment_id || '';
  const trackingCode = consignmentId || invoiceId;
  const trackingUrl = getTrackingUrl('pathao', trackingCode);

  return {
    success: true,
    provider: 'pathao',
    consignment_id: consignmentId,
    tracking_code: trackingCode,
    tracking_url: trackingUrl,
    status: data?.data?.order_status || 'Pending',
    delivery_charge: data?.data?.delivery_fee ?? 0,
  };
}
