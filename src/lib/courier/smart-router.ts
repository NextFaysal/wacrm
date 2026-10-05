import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourierProvider } from './types';
import { normalizeBdLocation } from './bd-geo';

export interface SmartRouteInput {
  accountId: string;
  customerAddress: string;
  city?: string | null;
  district?: string | null;
  itemWeightKg?: number;
  codAmount?: number;
}

export interface ProviderComparison {
  provider: CourierProvider;
  name: string;
  estimatedFee: number;
  estimatedDays: string;
  isConfigured: boolean;
  score: number;
}

export interface SmartRouteRecommendation {
  recommendedProvider: CourierProvider;
  isInsideDhaka: boolean;
  estimatedDeliveryDays: string;
  estimatedDeliveryFee: number;
  reason: string;
  comparison: ProviderComparison[];
}

/**
 * Intelligent courier selector that analyzes recipient location,
 * active API integrations, shipping rates, and delivery speeds.
 */
export async function getSmartCourierRoute(
  supabase: SupabaseClient,
  input: SmartRouteInput
): Promise<SmartRouteRecommendation> {
  // 1. Determine geographic region (Inside Dhaka vs Outside Dhaka)
  const geo = normalizeBdLocation(input.customerAddress, input.city || input.district || undefined);
  const isInsideDhaka = geo.isInsideDhaka;

  // 2. Fetch active courier configs for this account
  const { data: configs } = await supabase
    .from('courier_configs')
    .select('provider, is_active')
    .eq('account_id', input.accountId)
    .eq('is_active', true);

  const activeProviders = new Set((configs || []).map((c) => c.provider));

  // Default comparison matrix based on Bangladeshi logistics standards
  const comparison: ProviderComparison[] = [
    {
      provider: 'steadfast',
      name: 'Steadfast Courier',
      estimatedFee: isInsideDhaka ? 60 : 120,
      estimatedDays: isInsideDhaka ? '২৪-৪৮ ঘণ্টা' : '৪৮-৭২ ঘণ্টা',
      isConfigured: activeProviders.has('steadfast'),
      score: isInsideDhaka ? 85 : 95, // Steadfast dominates outside Dhaka
    },
    {
      provider: 'pathao',
      name: 'Pathao Courier',
      estimatedFee: isInsideDhaka ? 60 : 130,
      estimatedDays: isInsideDhaka ? '১২-২৪ ঘণ্টা' : '৪৮-৭২ ঘণ্টা',
      isConfigured: activeProviders.has('pathao'),
      score: isInsideDhaka ? 95 : 80, // Pathao is fastest inside Dhaka metro
    },
  ];

  // Pick the highest scoring active provider
  const configuredProviders = comparison.filter((c) => c.isConfigured);

  let selected: ProviderComparison;

  if (configuredProviders.length > 0) {
    // Sort by score descending
    configuredProviders.sort((a, b) => b.score - a.score);
    selected = configuredProviders[0];
  } else {
    // Fallback to default Steadfast if none configured yet
    selected = comparison[0];
  }

  let reason = '';
  if (isInsideDhaka) {
    reason =
      selected.provider === 'pathao'
        ? 'ঢাকা সিটির ভেতরে দ্রুততম ডেলিভারির (১২-২৪ ঘণ্টা) জন্য Pathao নির্বাচন করা হয়েছে।'
        : 'ঢাকা সিটির জন্য স্ট্যান্ডার্ড চার্জে (৳৬০) Steadfast নির্বাচন করা হয়েছে।';
  } else {
    reason =
      selected.provider === 'steadfast'
        ? 'ঢাকার বাইরে দেশব্যাপী ৬৪ জেলায় দ্রুততম ও নিরাপদ ক্যাশ-অন-ডেলিভারির জন্য Steadfast নির্বাচন করা হয়েছে।'
        : 'ঢাকার বাইরের ঠিকানার জন্য Pathao নির্বাচন করা হয়েছে।';
  }

  return {
    recommendedProvider: selected.provider,
    isInsideDhaka,
    estimatedDeliveryDays: selected.estimatedDays,
    estimatedDeliveryFee: selected.estimatedFee,
    reason,
    comparison,
  };
}
