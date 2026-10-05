import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface BusinessMemoryConfig {
  niche: string; // e.g. "Fashion & Apparel", "Consumer Electronics", "Beauty & Skincare"
  targetAudience: string; // e.g. "Men aged 22-45 in metropolitan cities seeking premium quality"
  targetCPA: number; // e.g. ৳250
  targetROAS: number; // e.g. 4.0
  averageMarginPct: number; // e.g. 50%
  maxAcceptableReturnRatePct: number; // e.g. 15%
  primaryCompetitorNames: string[];
  learnedRules: string[];
}

export const DEFAULT_BUSINESS_MEMORY: BusinessMemoryConfig = {
  niche: 'General E-commerce',
  targetAudience: 'Online shoppers in Bangladesh preferring Cash on Delivery',
  targetCPA: 300,
  targetROAS: 3.5,
  averageMarginPct: 45,
  maxAcceptableReturnRatePct: 15,
  primaryCompetitorNames: [],
  learnedRules: [
    'Free shipping on 2+ items increases conversion by ~20%',
    'Phone confirmation before dispatch reduces courier returns by 35%',
  ],
};

export async function getBusinessMemory(accountId: string): Promise<BusinessMemoryConfig> {
  const { data: settings } = await supabase
    .from('business_settings')
    .select('tagline, business_type')
    .eq('account_id', accountId)
    .maybeSingle();

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .single();

  return {
    ...DEFAULT_BUSINESS_MEMORY,
    niche: settings?.business_type || 'General E-commerce',
  };
}

export async function updateBusinessMemory(
  accountId: string,
  updates: Partial<BusinessMemoryConfig>
): Promise<BusinessMemoryConfig> {
  return {
    ...DEFAULT_BUSINESS_MEMORY,
    ...updates,
  };
}
