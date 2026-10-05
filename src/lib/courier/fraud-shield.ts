import { createClient } from '@supabase/supabase-js';
import { checkSteadfastFraudScore, formatBDPhone } from './dispatch';
import type { CourierConfig } from './types';

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

export interface CustomerRiskProfile {
  phone: string;
  trustScore: number; // 0 - 100
  riskLevel: 'TRUSTED' | 'MODERATE' | 'HIGH_RISK';
  deliverySuccessRate: number; // percentage
  totalHistoricalOrders: number;
  successfulDeliveries: number;
  cancelledOrReturned: number;
  courierReports: string[];
  recommendation: 'FAST_SHIP' | 'PHONE_VERIFY' | 'REQUIRE_ADVANCE_COD';
  recommendationBangla: string;
}

/**
 * Scans customer phone across courier networks and CRM history to compute real Delivery Risk & Trust Score.
 */
export async function scanCustomerRiskProfile(
  accountId: string,
  rawPhone: string
): Promise<CustomerRiskProfile> {
  const db = getAdminClient();
  const phone = formatBDPhone(rawPhone);

  let courierSuccess = 0;
  let courierFailed = 0;
  const reports: string[] = [];

  // 1. Check Steadfast Courier API if configured
  try {
    const { data: config } = await db
      .from('courier_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', 'steadfast')
      .eq('is_active', true)
      .maybeSingle();

    if (config?.api_key && config.api_key !== 'demo') {
      const fraudRes = await checkSteadfastFraudScore(config as CourierConfig, phone);
      if (fraudRes) {
        if (fraudRes.level === 'danger' || fraudRes.level === 'risky' || fraudRes.doubtful_reports) {
          reports.push(`Steadfast Alert: ${fraudRes.reasons.join(', ') || 'High return/cancellation history'}`);
          courierFailed += Math.max(1, fraudRes.total_reports || 2);
        } else if (fraudRes.level === 'trusted' || fraudRes.level === 'good') {
          courierSuccess += 5;
        }
      }
    }
  } catch (err) {
    console.warn('[fraud-shield] Steadfast scan warning:', err);
  }

  // 2. Query CRM Internal Order History for this phone
  const { data: internalOrders } = await db
    .from('orders')
    .select('status, created_at')
    .eq('account_id', accountId)
    .eq('customer_phone', phone);

  let crmSuccess = 0;
  let crmFailed = 0;

  if (internalOrders && internalOrders.length > 0) {
    for (const ord of internalOrders) {
      const st = (ord.status || '').toLowerCase();
      if (st === 'delivered' || st === 'completed') {
        crmSuccess++;
      } else if (st === 'cancelled' || st === 'returned') {
        crmFailed++;
      }
    }
  }

  const totalSuccess = courierSuccess + crmSuccess;
  const totalFailed = courierFailed + crmFailed;
  const totalEvents = totalSuccess + totalFailed;

  let successRate = 100;
  let trustScore = 85;
  let riskLevel: 'TRUSTED' | 'MODERATE' | 'HIGH_RISK' = 'TRUSTED';
  let recommendation: 'FAST_SHIP' | 'PHONE_VERIFY' | 'REQUIRE_ADVANCE_COD' = 'FAST_SHIP';
  let recommendationBangla = 'বিশ্বস্ত ক্রেতা — সরাসরি অর্ডার কনফার্ম করে শিপিং করুন।';

  if (totalEvents > 0) {
    successRate = Math.round((totalSuccess / totalEvents) * 100);
    trustScore = successRate;

    if (successRate >= 80 && totalFailed <= 1) {
      riskLevel = 'TRUSTED';
      recommendation = 'FAST_SHIP';
      recommendationBangla = 'বিশ্বস্ত ক্রেতা — সরাসরি পার্সেল বুকিং করতে পারেন।';
    } else if (successRate >= 50 && successRate < 80) {
      riskLevel = 'MODERATE';
      recommendation = 'PHONE_VERIFY';
      recommendationBangla = 'মাঝারি ঝুঁকি — শিপিংয়ের পূর্বে ফোনে ঠিকানা ও অর্ডার কনফার্ম করে নিন।';
    } else {
      riskLevel = 'HIGH_RISK';
      recommendation = 'REQUIRE_ADVANCE_COD';
      recommendationBangla = 'উচ্চ ঝুঁকি (সিরিয়াল রিটার্নার) — ডেলিভারি চার্জ অগ্রিম (বিকাশ/নগদ) নেওয়া বাধ্যতামূলক।';
      reports.push('রিটার্ন রেট ৫০% এর নিচে অথবা একাধিক পার্সেল বাতিলের রেকর্ড রয়েছে');
    }
  } else {
    // New Customer
    trustScore = 75;
    riskLevel = 'MODERATE';
    recommendation = 'PHONE_VERIFY';
    recommendationBangla = 'নতুন ক্রেতা — ফোনে একবার কথা বলে পার্সেল পাঠান।';
  }

  return {
    phone,
    trustScore,
    riskLevel,
    deliverySuccessRate: successRate,
    totalHistoricalOrders: totalEvents,
    successfulDeliveries: totalSuccess,
    cancelledOrReturned: totalFailed,
    courierReports: reports,
    recommendation,
    recommendationBangla,
  };
}
