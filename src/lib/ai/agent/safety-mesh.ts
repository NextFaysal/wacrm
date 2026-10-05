export interface SafetyMeshResult {
  recovered: boolean;
  replyText?: string;
  actionTaken: 'LLM_PRIMARY' | 'RULE_FALLBACK' | 'HUMAN_ESCALATION';
}

/**
 * AI Safety Mesh: Ensures that customer chats NEVER go unanswered, even during
 * total OpenAI/Gemini API outages, quota limits, or network timeouts.
 */
export function executeSafetyMeshFallback(
  inboundText: string,
  storeName = 'আমাদের শপ'
): SafetyMeshResult {
  const t = inboundText.toLowerCase();

  // 1. Price inquiry fallback
  if (/দাম কত|প্রাইস|মূল্য|price|cost|rate/i.test(t)) {
    return {
      recovered: true,
      replyText: `ধন্যবাদ ${storeName}-এ যোগাযোগের জন্য! আমাদের পণ্যের অফার মূল্য ও মডেলের বিস্তারিত জানতে ইনবক্সে বা ওয়েবসাইটে চেক করতে পারেন। আমাদের একজন প্রতিনিধি দ্রুত আপনার সাথে যোগাযোগ করছেন।`,
      actionTaken: 'RULE_FALLBACK',
    };
  }

  // 2. Delivery & Cash on Delivery fallback
  if (/ডেলিভারি|কবে পাব|ক্যাশ অন|ডেলিভারি চার্জ|delivery/i.test(t)) {
    return {
      recovered: true,
      replyText: `সারা বাংলাদেশে আমাদের ক্যাশ অন হোম ডেলিভারি সুবিধা রয়েছে। ঢাকার ভেতরে ২৪-৪৮ ঘণ্টা এবং ঢাকার বাইরে ২-৩ দিনের মধ্যে ডেলিভারি পাবেন। পার্সেল রিসিভ করার সময় চেক করে নেওয়ার সুযোগ রয়েছে। 🚚`,
      actionTaken: 'RULE_FALLBACK',
    };
  }

  // 3. Location / Store address fallback
  if (/শোরুম|দোকান|ঠিকানা|কোথায়|লোকেশন|address/i.test(t)) {
    return {
      recovered: true,
      replyText: `আমাদের প্রধান অফিস ও অনলাইন ডেলিভারি হাব ঢাকায় অবস্থিত। সারা বাংলাদেশে হোম ডেলিভারিতে পণ্য পাওয়ার জন্য আপনার নাম, ঠিকানা ও ফোন নম্বর প্রদান করতে পারেন। 😊`,
      actionTaken: 'RULE_FALLBACK',
    };
  }

  // 4. Default graceful fallback: Escalate to Human Agent
  return {
    recovered: true,
    replyText: `ধন্যবাদ ${storeName}-এ মেসেজ দেওয়ার জন্য! আপনার বার্তাটি পেয়েছি, আমাদের সাপোর্ট টিম খুব দ্রুত আপনার সাথে সরাসরি যোগাযোগ করছে। অনুগ্রহ করে একটু অপেক্ষা করুন। 🙏`,
    actionTaken: 'HUMAN_ESCALATION',
  };
}
