export type SpecializedAgentRole =
  | 'SALES_CLOSER'
  | 'BARGAIN_NEGOTIATOR'
  | 'FRAUD_GUARD'
  | 'POST_PURCHASE_SUPPORT';

export interface AgentRoutingDecision {
  targetRole: SpecializedAgentRole;
  roleTitle: string;
  systemPromptModifier: string;
  reason: string;
}

/**
 * Multi-Agent Router: Dispatches customer messages to the most specialized
 * autonomous sub-agent persona based on intent and conversation context.
 */
export function routeToSpecializedAgent(
  inboundText: string,
  currentState: string,
  hasExistingOrder: boolean
): AgentRoutingDecision {
  const t = inboundText.toLowerCase();

  // 1. Post-Purchase & Tracking Support Agent
  if (
    hasExistingOrder &&
    /কবে পাব|কতদিন|ট্র্যাকিং|কোথায়|সমস্যা|নষ্ট|চেঞ্জ|বদল|ডেলিভারি কবে|status|order/i.test(t)
  ) {
    return {
      targetRole: 'POST_PURCHASE_SUPPORT',
      roleTitle: 'Post-Purchase Support Agent 📦',
      systemPromptModifier:
        'তুমি এখন পোস্ট-পারচেজ সাপোর্ট স্পেশালিস্ট হিসেবে দায়িত্ব পালন করছো। কাস্টমারের পার্সেল ট্র্যাকিং স্ট্যাটাস, দ্রুত সমাধান ও অমায়িক সান্ত্বনা প্রদানে ফোকাস করো।',
      reason: 'Customer inquired about order status, delivery tracking, or replacement.',
    };
  }

  // 2. Bargain & Negotiation Agent
  if (/দাম.*(কম|বেশি|ছাড়)|কিছু কমান|একটু ছাড়|কম রাখা|ডিসকাউন্ট|কুপন|অফার নাই|বাজেট|bargain|discount/i.test(t)) {
    return {
      targetRole: 'BARGAIN_NEGOTIATOR',
      roleTitle: 'Bargain & Discount Negotiator 🤝',
      systemPromptModifier:
        'তুমি এখন স্মার্ট ডিসকাউন্ট ও দাম-দর স্পেশালিস্ট। গ্রাহককে বেশি ছাড় না দিয়েও কীভাবে ভ্যালু বুঝিয়ে স্পেশাল কুপনে দ্রুত অর্ডার ক্লোজ করা যায় সেই কৌশল ব্যবহার করো।',
      reason: 'Customer initiated price haggling or requested discount.',
    };
  }

  // 3. Fraud & Risk Guard Agent
  if (currentState === 'RISK_CHECK' || /ফেক|ভুয়া|অ্যাডভান্স দিব না|কুরিয়ার চার্জ কমান/i.test(t)) {
    return {
      targetRole: 'FRAUD_GUARD',
      roleTitle: 'Fraud Guard & Risk Mitigator 🛡️',
      systemPromptModifier:
        'তুমি এখন কুরিয়ার সিকিউরিটি ও ফ্রড প্রিভেনশন অফিসার। রিটার্ন এড়াতে বিনয়ের সাথে নিশ্চিত করো কাস্টমার সঠিক ঠিকানায় ক্যাশ অন ডেলিভারি রিসিভ করতে প্রস্তুত কি না।',
      reason: 'Conversation involves order risk verification or advance payment resistance.',
    };
  }

  // 4. Default: Sales Closer Agent
  return {
    targetRole: 'SALES_CLOSER',
    roleTitle: 'Sales Pitch & Closer Agent 🎯',
    systemPromptModifier:
      'তুমি এখন শীর্ষ সেলস ক্লোজার। কাস্টমারকে পণ্যের আকর্ষণীয় দিক, স্টক লিমিটেড হওয়া ও ক্যাশ অন ডেলিভারির সুবিধা বুঝিয়ে দ্রুত নাম, ঠিকানা সংগ্রহ ও অর্ডার বুকিং করো।',
    reason: 'Standard customer inquiry, greeting, or purchase exploration.',
  };
}
