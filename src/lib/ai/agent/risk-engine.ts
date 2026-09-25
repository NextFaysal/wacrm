import type { SupabaseClient } from '@supabase/supabase-js';
import type { RiskCheckResult, AiCommerceConfig } from '@/types/commerce';
import { formatBDPhone } from '@/lib/courier/utils';

export function validateBDPhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone) return { valid: false, error: 'Phone number is missing' };
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const normalized = formatBDPhone(cleaned);
  // Valid BD mobile must start with 01 and have 11 digits (e.g. 01712345678)
  const isValid = /^01[3-9]\d{8}$/.test(normalized);
  if (!isValid) {
    return { valid: false, error: 'Invalid Bangladeshi mobile number format (e.g. 017XXXXXXXX)' };
  }
  return { valid: true, normalized };
}

export function validateAddressCompleteness(address: string, thana?: string | null, district?: string | null): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  const text = (address || '').trim();

  if (!text || text.length < 5) {
    missing.push('full_address');
  }

  // Check if thana or district are explicitly provided or contained in address
  const hasThana = Boolean(thana && thana.trim().length > 1) || /(thana|থানা|upazila|উপজেলা)/i.test(text);
  const hasDistrict = Boolean(district && district.trim().length > 1) || /(district|জেলা|dhaka|ঢাকা|chittagong|চট্টগ্রাম|khulna|খুলনা|rajshahi|রাজশাহী|sylhet|সিলেট|barisal|বরিশাল|rangpur|রংপুর|mymensingh|ময়মনসিংহ)/i.test(text);

  if (!hasThana && !thana) {
    missing.push('thana');
  }
  if (!hasDistrict && !district) {
    missing.push('district');
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

export async function calculateCustomerRisk(
  db: SupabaseClient,
  accountId: string,
  rawPhone: string,
  config: Partial<AiCommerceConfig> = {}
): Promise<RiskCheckResult> {
  const phoneValidation = validateBDPhone(rawPhone);
  const phone = phoneValidation.normalized || rawPhone;

  const maxCancellationRate = config.risk_max_cancellation_rate ?? 50;
  const minSteadfastRatio = config.risk_min_steadfast_ratio ?? 60;

  const reasons: string[] = [];

  // 1. Query internal database orders for this customer phone
  const { data: previousOrders, error: orderErr } = await db
    .from('orders')
    .select('id, status, created_at')
    .eq('account_id', accountId)
    .eq('customer_phone', phone);

  let totalOrders = 0;
  let cancelledOrders = 0;
  let deliveredOrders = 0;

  if (!orderErr && previousOrders) {
    totalOrders = previousOrders.length;
    for (const order of previousOrders) {
      if (['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(order.status)) {
        cancelledOrders++;
      } else if (order.status === 'DELIVERED') {
        deliveredOrders++;
      }
    }
  }

  const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

  // 2. Query Steadfast Courier Fraud / Delivery Ratio if Steadfast config exists
  let steadfastDeliveryRatio: number | undefined;
  try {
    const { data: courierCfg } = await db
      .from('courier_configs')
      .select('api_key, secret_key, is_active')
      .eq('account_id', accountId)
      .eq('provider', 'steadfast')
      .eq('is_active', true)
      .maybeSingle();

    if (courierCfg?.api_key && courierCfg?.secret_key) {
      const res = await fetch(`https://portal.packzy.com/api/v1/fraud-check/${phone}`, {
        method: 'GET',
        headers: {
          'Api-Key': courierCfg.api_key,
          'Secret-Key': courierCfg.secret_key,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const fraudData = await res.json();
        // Steadfast returns total_parcels, total_delivered, success_ratio
        if (fraudData?.total_parcels && fraudData.total_parcels > 0) {
          const ratio = typeof fraudData.success_ratio === 'number'
            ? fraudData.success_ratio
            : Math.round(((fraudData.total_delivered || 0) / fraudData.total_parcels) * 100);
          steadfastDeliveryRatio = ratio;
        }
      }
    }
  } catch (err) {
    console.warn('[risk-engine] Steadfast fraud check skipped/failed:', err);
  }

  // 3. Determine Risk Level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let requiresHumanApproval = false;

  // Rule A: High internal cancellation rate
  if (totalOrders >= 2 && cancellationRate >= maxCancellationRate) {
    riskLevel = 'HIGH';
    requiresHumanApproval = true;
    reasons.push(`পূর্ববর্তী অর্ডারে ক্যান্সেলেশন/রিটার্ন রেট ${cancellationRate}% (সীমা: ${maxCancellationRate}%)`);
  }

  // Rule B: Steadfast Delivery Success Ratio below minimum threshold
  if (steadfastDeliveryRatio !== undefined && steadfastDeliveryRatio < minSteadfastRatio) {
    riskLevel = 'HIGH';
    requiresHumanApproval = true;
    reasons.push(`কুরিয়ারে ডেলিভারি সাকসেস রেশিও মাত্র ${steadfastDeliveryRatio}% (ন্যূনতম নিরাপদ: ${minSteadfastRatio}%)`);
  }

  // Rule C: Moderate risk
  if (riskLevel !== 'HIGH') {
    if (totalOrders >= 2 && cancellationRate >= 25) {
      riskLevel = 'MEDIUM';
      reasons.push(`মাঝারি ক্যান্সেলেশন রেট (${cancellationRate}%)`);
    } else if (steadfastDeliveryRatio !== undefined && steadfastDeliveryRatio < 75) {
      riskLevel = 'MEDIUM';
      reasons.push(`কুরিয়ার ডেলিভারি রেশিও ${steadfastDeliveryRatio}%`);
    }
  }

  return {
    riskLevel,
    cancellationRate,
    totalOrders,
    cancelledOrders,
    deliveredOrders,
    steadfastDeliveryRatio,
    requiresHumanApproval,
    reasons,
  };
}
