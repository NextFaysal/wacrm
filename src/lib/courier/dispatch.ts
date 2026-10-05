import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CourierConfig,
  CourierOrderInput,
  CourierOrderResult,
  FraudCheckResult,
  CourierBalanceResult,
} from './types';
import { sendToPathao } from './pathao';
import { formatBDPhone, sanitizeSteadfastText, getTrackingUrl } from './utils';

export { formatBDPhone, sanitizeSteadfastText, getTrackingUrl };

/**
 * Dispatch an order placement to the designated courier API.
 */
export async function dispatchCourierOrder(
  config: CourierConfig,
  input: CourierOrderInput,
  supabase?: SupabaseClient
): Promise<CourierOrderResult> {
  const invoiceId = input.invoice_id || `INV-${Date.now().toString().slice(-6)}`;

  // Test / Demo Mode fallback
  if (config.api_key === 'demo' || config.api_key === 'test') {
    const mockCode = `TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      success: true,
      provider: input.provider,
      consignment_id: `CS-${Date.now()}`,
      tracking_code: mockCode,
      tracking_url: getTrackingUrl(input.provider, mockCode),
      status: 'in_review',
      delivery_charge: 60,
    };
  }

  switch (input.provider) {
    case 'steadfast':
      return sendToSteadfast(config, input, invoiceId);
    case 'pathao':
      return sendToPathao(config, input, invoiceId, supabase);
    case 'redx':
      return sendToRedX(config, input, invoiceId);
    case 'paperfly':
      return sendToPaperfly(config, input, invoiceId);
    default:
      throw new Error(`Unsupported courier provider: ${input.provider}`);
  }
}

/**
 * Steadfast Courier API Integration
 * Docs: https://portal.packzy.com/api/v1
 */
async function sendToSteadfast(
  config: CourierConfig,
  input: CourierOrderInput,
  invoiceId: string
): Promise<CourierOrderResult> {
  const endpoint = 'https://portal.packzy.com/api/v1/create_order';

  const body = {
    invoice: sanitizeSteadfastText(invoiceId, 100),
    recipient_name: sanitizeSteadfastText(input.recipient_name, 100),
    recipient_phone: formatBDPhone(input.recipient_phone),
    recipient_address: sanitizeSteadfastText(input.recipient_address, 490),
    cod_amount: Number(input.cod_amount) || 0,
    note: sanitizeSteadfastText(input.note || '', 480),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Api-Key': config.api_key,
      'Secret-Key': config.secret_key || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.status !== 200) {
    const errorMsg = data?.errors
      ? (typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors))
      : data?.message || `Steadfast API error (${response.status})`;
    throw new Error(errorMsg);
  }

  const consignment = data.consignment || {};
  const trackingCode = consignment.tracking_code || String(consignment.consignment_id || '');
  const trackingUrl = consignment.tracking_link || getTrackingUrl('steadfast', trackingCode);

  return {
    success: true,
    provider: 'steadfast',
    consignment_id: String(consignment.consignment_id || ''),
    tracking_code: trackingCode,
    tracking_url: trackingUrl,
    status: consignment.status || 'in_review',
    delivery_charge: consignment.delivery_fee ?? 0,
  };
}

/**
 * Checks customer delivery history and fraud score from Steadfast
 */
export async function checkSteadfastFraudScore(
  config: CourierConfig,
  phone: string
): Promise<FraudCheckResult> {
  const cleanPhone = formatBDPhone(phone);
  if (!cleanPhone || cleanPhone.length < 11) {
    throw new Error('Valid 11-digit phone number starting with 01 is required');
  }

  const endpoint = `https://portal.packzy.com/api/v1/fraud_check/score/${cleanPhone}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Api-Key': config.api_key,
      'Secret-Key': config.secret_key || '',
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 200) {
    throw new Error(data?.message || `Failed to check fraud score (${response.status})`);
  }

  return {
    phone: cleanPhone,
    score: data.score,
    level: data.level || 'new',
    reasons: data.reasons || [],
    total_reports: data.total_reports || 0,
    doubtful_reports: data.doubtful_reports,
  };
}

/**
 * Fetches current payable balance from Steadfast
 */
export async function getSteadfastBalance(
  config: CourierConfig
): Promise<CourierBalanceResult> {
  const endpoint = 'https://portal.packzy.com/api/v1/get_balance';
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Api-Key': config.api_key,
      'Secret-Key': config.secret_key || '',
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 200) {
    throw new Error(data?.message || `Failed to get Steadfast balance (${response.status})`);
  }

  return {
    current_balance: Number(data.current_balance) || 0,
    status: data.status,
  };
}


/**
 * RedX Courier API Integration
 */
async function sendToRedX(
  config: CourierConfig,
  input: CourierOrderInput,
  invoiceId: string
): Promise<CourierOrderResult> {
  const endpoint = 'https://openapi.redx.com.bd/v1.0.0-beta/parcels';

  const body = {
    customer_name: input.recipient_name,
    customer_phone: input.recipient_phone,
    delivery_area: input.recipient_address,
    customer_address: input.recipient_address,
    merchant_invoice_id: invoiceId,
    cash_collection_amount: input.cod_amount,
    instruction: input.note || '',
    value: input.cod_amount,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'API-ACCESS-TOKEN': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.tracking_id) {
    const errorMsg = data?.message || `RedX API error (${response.status})`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    provider: 'redx',
    consignment_id: data.tracking_id,
    tracking_code: data.tracking_id,
    tracking_url: getTrackingUrl('redx', data.tracking_id),
    status: 'in_review',
  };
}

/**
 * Paperfly Courier API Integration
 */
async function sendToPaperfly(
  config: CourierConfig,
  input: CourierOrderInput,
  invoiceId: string
): Promise<CourierOrderResult> {
  const endpoint = 'https://api.paperfly.com.bd/order-placement';

  const body = {
    merOrderRef: invoiceId,
    custName: input.recipient_name,
    custPhone: input.recipient_phone,
    custAddress: input.recipient_address,
    packagePrice: input.cod_amount,
    briefBrief: input.note || '',
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Paperfly API error (${response.status})`;
    throw new Error(errorMsg);
  }

  const trackingId = data?.tracking_number || invoiceId;

  return {
    success: true,
    provider: 'paperfly',
    consignment_id: trackingId,
    tracking_code: trackingId,
    tracking_url: getTrackingUrl('paperfly', trackingId),
    status: 'placed',
  };
}

export interface LiveTrackingResult {
  provider: string;
  trackingCode: string;
  trackingUrl: string;
  status: string;
  statusBangla: string;
  location?: string | null;
  lastUpdated?: string | null;
}

/**
 * Queries real-time parcel tracking from courier API (Steadfast / Pathao / etc.)
 */
export async function getLiveCourierTracking(
  config: CourierConfig | null,
  provider: string,
  trackingCode: string
): Promise<LiveTrackingResult> {
  const defaultUrl = getTrackingUrl(provider as any, trackingCode);

  if (!config || config.api_key === 'demo' || config.api_key === 'test') {
    return {
      provider,
      trackingCode,
      trackingUrl: defaultUrl,
      status: 'in_transit',
      statusBangla: 'পার্সেলটি কুরিয়ারে বুকিং হয়েছে এবং ট্রানজিটে রয়েছে',
      location: 'Hub',
      lastUpdated: new Date().toISOString(),
    };
  }

  if (provider === 'steadfast') {
    try {
      const endpoint = `https://portal.packzy.com/api/v1/status_by_trackingcode/${encodeURIComponent(trackingCode)}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Api-Key': config.api_key,
          'Secret-Key': config.secret_key || '',
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawStatus = (data?.delivery_status || 'in_transit').toLowerCase();

        const statusMap: Record<string, string> = {
          in_review: 'পার্সেলটি রিভিউতে আছে',
          pending: 'পার্সেলটি পিকআপের অপেক্ষায় রয়েছে',
          in_transit: 'পার্সেলটি আপনার শহরের উদ্দেশ্যে রওনা হয়েছে',
          out_for_delivery: 'পার্সেলটি ডেলিভারিম্যানের কাছে রয়েছে, আজই ডেলিভারি হবে',
          delivered: 'ডেলিভারি সফলভাবে সম্পন্ন হয়েছে',
          cancelled: 'ডেলিভারি বাতিল করা হয়েছে',
          hold: 'পার্সেলটি সাময়িকভাবে হোল্ডে রয়েছে (যোগাযোগ করা হচ্ছে)',
        };

        return {
          provider: 'steadfast',
          trackingCode,
          trackingUrl: data?.tracking_link || defaultUrl,
          status: rawStatus,
          statusBangla: statusMap[rawStatus] || 'কুরিয়ারে প্রক্রিয়াধীন রয়েছে',
          location: data?.current_hub || 'Hub / In-Transit',
          lastUpdated: data?.updated_at || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[live-tracking] Steadfast query failed:', e);
    }
  }

  return {
    provider,
    trackingCode,
    trackingUrl: defaultUrl,
    status: 'in_transit',
    statusBangla: 'পার্সেলটি ট্রানজিটে রয়েছে',
    location: 'কুরিয়ার হাব',
    lastUpdated: new Date().toISOString(),
  };
}

