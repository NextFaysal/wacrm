import type { SupabaseClient } from '@supabase/supabase-js';

export type ObjectionType =
  | 'PRICE_TOO_HIGH'
  | 'DELIVERY_CHARGE_ISSUE'
  | 'DOUBT_ORIGINALITY'
  | 'WANT_TO_BUY_LATER'
  | 'DELIVERY_TIME_TOO_LONG'
  | 'UNKNOWN';

export interface ObjectionAnalysis {
  type: ObjectionType;
  confidence: number;
  adaptiveCounterPitch: string;
}

/**
 * Detect customer's hesitation/objection from chat text and provide
 * a psychologically proven counter-pitch in fluent conversational Bengali.
 */
export function analyzeCustomerObjection(text: string): ObjectionAnalysis {
  const t = text.toLowerCase();

  // 1. Price objection
  if (/দাম বেশি|বেশি দাম|কিছু কমান|একটু ছাড়|কম রাখা যায়|ডিসকাউন্ট নাই|বাজেট কম/i.test(t)) {
    return {
      type: 'PRICE_TOO_HIGH',
      confidence: 0.9,
      adaptiveCounterPitch:
        'ভাইয়া/আপু, কোয়ালিটি বিবেচনায় আমাদের এই অফার রেটটি সীমিত সময়ের জন্য রাখা হয়েছে। তবে আপনি চাইলে এখনই অর্ডার কনফার্ম করলে আমরা বিশেষ ছাড় বা ডেলিভারি অফার সমন্বয় করে দিতে পারি।',
    };
  }

  // 2. Delivery charge objection
  if (/ডেলিভারি চার্জ বেশি|চার্জ ফ্রি করেন|ডেলিভারি ফ্রি নাই|চার্জ নিবেন না/i.test(t)) {
    return {
      type: 'DELIVERY_CHARGE_ISSUE',
      confidence: 0.85,
      adaptiveCounterPitch:
        'আমাদের সাথে ২টি পণ্য একসাথে অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি! অথবা এখনই কনফার্ম করলে ডেলিভারি চার্জে বিশেষ ছাড়ের ব্যবস্থা করছি।',
    };
  }

  // 3. Doubt originality or quality
  if (/আসল তো|অরিজিনাল তো|নকল নাকি|কপি প্রোডাক্ট|কোয়ালিটি কেমন|ভুয়া/i.test(t)) {
    return {
      type: 'DOUBT_ORIGINALITY',
      confidence: 0.95,
      adaptiveCounterPitch:
        'একদম শতভাগ নিশ্চিত থাকুন! আমাদের পণ্য ১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটি। পার্সেল রিসিভ করার সময় আপনি নিজে খুলে চেক করে দেখে তারপর পেমেন্ট করতে পারবেন। কোনো সমস্যা থাকলে রিটার্ন সুবিধা রয়েছে।',
    };
  }

  // 4. Delivery time too long
  if (/অনেক দিন লাগে|দেরি হবে|জরুরি দরকার|কালকে পাবো|আজকেই লাগবে/i.test(t)) {
    return {
      type: 'DELIVERY_TIME_TOO_LONG',
      confidence: 0.85,
      adaptiveCounterPitch:
        'ঢাকার ভেতরে আমরা ২৪ ঘণ্টার মধ্যে দ্রুততম এক্সপ্রেস ডেলিভারি দিয়ে থাকি। আপনার ঠিকানাটি দিলে আমরা এখনই ফাস্ট-ট্র্যাক শিডিউলে বুক করে দিতে পারি।',
    };
  }

  // 5. Future purchase
  if (/পরে নিব|পরে জানাবো|পরে অর্ডার করব|বেতন পাইয়া|ভাবতেছি/i.test(t)) {
    return {
      type: 'WANT_TO_BUY_LATER',
      confidence: 0.8,
      adaptiveCounterPitch:
        'অবশ্যই কোনো ব্যাপার না ভাইয়া! তবে আমাদের এই বিশেষ অফার প্রাইস এবং সীমিত স্টক আর অল্প কিছুদিন থাকবে। আপনার জন্য কি ১ পিস স্টক হোল্ড করে রাখব?',
    };
  }

  return {
    type: 'UNKNOWN',
    confidence: 0,
    adaptiveCounterPitch: '',
  };
}

/**
 * Record detected objections to database for weekly learning & self-tuning.
 */
export async function recordObjectionInsight(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  objection: ObjectionAnalysis
): Promise<void> {
  if (objection.type === 'UNKNOWN') return;

  try {
    await db.from('ai_objections_log').insert({
      account_id: accountId,
      conversation_id: conversationId,
      objection_type: objection.type,
      confidence: objection.confidence,
    });
  } catch (err) {
    // Non-blocking best effort
    console.warn('[recordObjectionInsight] Insert failed:', err);
  }
}
