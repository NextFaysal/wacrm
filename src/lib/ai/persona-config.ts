import type { SupabaseClient } from '@supabase/supabase-js';

export interface AiPersonaConfig {
  id: string;
  account_id: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  response_language: 'bangla' | 'english' | 'mixed';
  custom_greeting?: string | null;
  custom_sign_off?: string | null;
  max_discount_percent: number;
  negotiation_style: 'firm' | 'flexible' | 'generous';
  require_advance_above: number | null;
  min_order_amount: number | null;
  blocked_phrases: string[];
  custom_rules: string | null;
  auto_learn_from_products: boolean;
  auto_learn_from_orders: boolean;
  created_at: string;
  updated_at: string;
}

export type AiPersonaSettings = Omit<AiPersonaConfig, 'id' | 'account_id' | 'created_at' | 'updated_at'>;

export const DEFAULT_PERSONA: AiPersonaSettings = {
  tone: 'friendly',
  response_language: 'mixed',
  custom_greeting: null,
  custom_sign_off: null,
  max_discount_percent: 10,
  negotiation_style: 'flexible',
  require_advance_above: null,
  min_order_amount: null,
  blocked_phrases: [],
  custom_rules: null,
  auto_learn_from_products: true,
  auto_learn_from_orders: true,
};

export async function loadAiPersonaConfig(
  db: SupabaseClient,
  accountId: string
): Promise<AiPersonaSettings> {
  try {
    const { data, error } = await db
      .from('ai_persona_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_PERSONA };
    }

    return {
      tone: data.tone || DEFAULT_PERSONA.tone,
      response_language: data.response_language || DEFAULT_PERSONA.response_language,
      custom_greeting: data.custom_greeting ?? null,
      custom_sign_off: data.custom_sign_off ?? null,
      max_discount_percent: typeof data.max_discount_percent === 'number' ? data.max_discount_percent : DEFAULT_PERSONA.max_discount_percent,
      negotiation_style: data.negotiation_style || DEFAULT_PERSONA.negotiation_style,
      require_advance_above: data.require_advance_above ?? null,
      min_order_amount: data.min_order_amount ?? null,
      blocked_phrases: Array.isArray(data.blocked_phrases) ? data.blocked_phrases : [],
      custom_rules: data.custom_rules ?? null,
      auto_learn_from_products: data.auto_learn_from_products ?? true,
      auto_learn_from_orders: data.auto_learn_from_orders ?? true,
    };
  } catch (err) {
    console.warn('[loadAiPersonaConfig] Failed to load persona, using fallback:', err);
    return { ...DEFAULT_PERSONA };
  }
}

export function buildPersonaSystemPromptAddition(persona: AiPersonaSettings): string {
  const parts: string[] = [];

  // Tone
  const toneMap = {
    friendly: 'উষ্ণ, আন্তরিক ও অমায়িক ভঙ্গিতে কথা বলো (যেমন: প্রিয় গ্রাহক, আপনার জন্য, অনেক ধন্যবাদ)।',
    professional: 'মার্জিত, পয়েন্ট-টু-পয়েন্ট ও অফিসিয়াল প্রফেশনাল ভঙ্গিতে কথা বলো।',
    casual: 'সহজ, ঘরোয়া ও ক্যাজুয়াল ভঙ্গিতে বন্ধুদের মতো আন্তরিকভাবে কথা বলো।',
    formal: 'অত্যন্ত শ্রদ্ধাপূর্ণ, গম্ভীর ও সম্মানসূচক বাংলা ভাষায় কথা বলো।',
  };
  parts.push(`- কথা বলার স্টাইল: ${toneMap[persona.tone] || toneMap.friendly}`);

  // Language
  if (persona.response_language === 'bangla') {
    parts.push('- ভাষা: সম্পূর্ণ শুদ্ধ ও সাবলীল বাংলা ভাষায় উত্তর দাও। কোনো অপ্রয়োজনীয় ইংরেজি শব্দ ব্যবহার করবে না।');
  } else if (persona.response_language === 'english') {
    parts.push('- Language: Always reply in fluent, natural English.');
  } else {
    parts.push('- ভাষা: কথোপকথনের স্বাভাবিক বাংলা (প্রয়োজনে প্রচলিত ইংরেজি শব্দ যেমন Delivery, Confirm, Order ইত্যাদি মিশ্রিত) ব্যবহার করো।');
  }

  // Greeting / Signoff
  if (persona.custom_greeting) {
    parts.push(`- প্রথম সাক্ষাতে শুরু করো এভাবে: "${persona.custom_greeting}"`);
  }
  if (persona.custom_sign_off) {
    parts.push(`- উত্তর বা মেসেজের ইতি টানো এভাবে: "${persona.custom_sign_off}"`);
  }

  // Negotiation & Discount
  if (persona.max_discount_percent === 0) {
    parts.push('- দামের নিয়ম: আমাদের সকল পণ্যের দাম ফিক্সড (একদাম)। কোনো ছাড় বা ডিসকাউন্ট দেওয়ার অনুমতি নেই। বিনয়ের সাথে বলো দাম একদাম ও সর্বোচ্চ মানের নিশ্চয়তা।');
  } else {
    const negoMap = {
      firm: `দাম ফিক্সড রাখার চেষ্টা করবে। কাস্টমার খুব বেশি জোরাজোরি করলে সর্বোচ্চ ${persona.max_discount_percent}% পর্যন্ত বিশেষ ছাড় দিতে পারো।`,
      flexible: `স্বাভাবিকভাবে সর্বোচ্চ ${persona.max_discount_percent}% পর্যন্ত ছাড় দিতে পারো কাস্টমারকে অর্ডার কনফার্ম করতে উৎসাহ দিতে।`,
      generous: `কাস্টমার আগ্রহ দেখালেই সরাসরি সর্বোচ্চ ${persona.max_discount_percent}% ডিসকাউন্ট অফার করে দ্রুত অর্ডার বুকিং করার চেষ্টা করো।`,
    };
    parts.push(`- ডিসকাউন্ট ও দাম-দর পলিসি: ${negoMap[persona.negotiation_style] || negoMap.flexible}`);
  }

  // Min order amount
  if (persona.min_order_amount && persona.min_order_amount > 0) {
    parts.push(`- ন্যূনতম অর্ডার: মোট অর্ডারের মূল্য কমপক্ষে ৳${persona.min_order_amount} হতে হবে। এর নিচের অর্ডার গ্রহণ করা যাবে না।`);
  }

  // Advance requirement threshold
  if (persona.require_advance_above && persona.require_advance_above > 0) {
    parts.push(`- অ্যাডভান্স পেমেন্ট শর্ত: মোট মূল্য ৳${persona.require_advance_above}-এর বেশি হলে কুরিয়ার বা সিকিউরিটি অ্যাডভান্স বিকাশ/নগদে গ্রহণ করতে হবে।`);
  }

  // Blocked phrases
  if (persona.blocked_phrases && persona.blocked_phrases.length > 0) {
    parts.push(`- নিষিদ্ধ শব্দ/বাক্য (কখনো বলবে না): ${persona.blocked_phrases.map((p) => `"${p}"`).join(', ')}`);
  }

  // Custom merchant rules
  if (persona.custom_rules && persona.custom_rules.trim()) {
    parts.push(`- বিশেষ ব্যবসায়ী নীতিমালা:\n${persona.custom_rules.trim()}`);
  }

  return parts.join('\n');
}
