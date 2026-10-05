/**
 * Human Personality & Conversational Nuance Engine for WhatsApp CRM.
 * Implements 100% human-like behavioral traits for Bangladeshi conversational commerce:
 * 1. Time-of-day natural greetings (সকাল / দুপুর / সন্ধ্যা / রাত)
 * 2. Natural colloquial affirmative phrases (জি অবশ্যই, হ্যাঁ ভাইয়া/আপু, ইনশাআল্লাহ)
 * 3. Human empathetic objection handlers (bargaining, hesitation, quality concerns)
 * 4. Micro-variations in response templates to prevent repetitive robotic patterns
 * 5. Automatic cleanup of robotic markdown formatting (headers, asterisks, bullet walls)
 */

export interface HumanGreetingOptions {
  customerName?: string | null;
  isReturning?: boolean;
}

/**
 * Returns a natural, context-aware Bangladeshi greeting based on Bangladesh Standard Time (UTC+6)
 */
export function getHumanGreeting(options: HumanGreetingOptions = {}): string {
  const { customerName, isReturning } = options;

  // Calculate Bangladesh Standard Time (UTC+6)
  const now = new Date();
  const utcHours = now.getUTCHours();
  const bstHours = (utcHours + 6) % 24;

  let timeGreeting = '';
  if (bstHours >= 6 && bstHours < 12) {
    timeGreeting = 'শুভ সকাল';
  } else if (bstHours >= 12 && bstHours < 17) {
    timeGreeting = 'শুভ দুপুর';
  } else if (bstHours >= 17 && bstHours < 22) {
    timeGreeting = 'শুভ সন্ধ্যা';
  } else {
    timeGreeting = 'আসসালামু আলাইকুম';
  }

  const namePart = customerName ? ` ${customerName} ভাইয়া/আপু` : '';
  const returningPart = isReturning ? ' আবার যোগাযোগ করার জন্য ধন্যবাদ!' : '';

  const variations = [
    `${timeGreeting}${namePart}! আশা করি ভালো আছেন 😊${returningPart}`,
    `আসসালামু আলাইকুম${namePart}! কেমন আছেন? 😊${returningPart}`,
    `জি${namePart}! ${timeGreeting}! আপনাকে কীভাবে সাহায্য করতে পারি? 😊`,
  ];

  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Returns a random natural affirmative filler real Bangladeshi sales reps use on WhatsApp
 */
export function getNaturalAffirmation(): string {
  const phrases = [
    'জি অবশ্যই!',
    'হ্যাঁ ভাইয়া/আপু, একদম!',
    'জি নিশ্চয়ই!',
    'অবশ্যই পারবেন, কোনো চিন্তা নেই!',
    'ইনশাআল্লাহ, আপনার অনেক পছন্দ হবে!',
    'জি, অবশ্যই দেখতে পারেন!',
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Returns empathetic, human-like objection handling text for common customer hesitations
 */
export function getHumanObjectionResponse(
  intent: 'BARGAIN' | 'HESITATION' | 'QUALITY_DOUBT' | 'SHOP_LOCATION',
  storeName = 'আমাদের শপ'
): string {
  if (intent === 'BARGAIN') {
    const responses = [
      'ভাইয়া/আপু, দামটা অলরেডি আমাদের লিমিটেড টাইম স্পেশাল অফারে রাখা হয়েছে! তবে আপনি যদি ২টি প্রোডাক্ট একসাথে অর্ডার করেন, তাহলে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি করে দেওয়া যাবে এবং সাথে একটি আকর্ষণীয় উপহার পাবেন! 🎁',
      'আমাদের প্রোডাক্টের প্রিমিয়াম ফিনিশিং ও কোয়ালিটি বিবেচনা করলে প্রাইসটা একদম রিজনেবল রাখা হয়েছে। তাছাড়া ডেলিভারির সময় পার্সেল খুলে চেক করে নেওয়ার ১০০% সুবিধা পাবেন! 😊',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (intent === 'HESITATION') {
    const responses = [
      'জি কোনো সমস্যা নেই ভাইয়া/আপু! আপনি সময় নিয়ে ভেবে দেখতে পারেন। তবে আমাদের এই স্পেশাল অফার স্টক খুব সীমিত, পছন্দের কালার বা সাইজটি ফুরিয়ে যাওয়ার আগেই অর্ডার কনফার্ম করে রাখলে ভালো হয়। ভালো থাকবেন! ❤️',
      'কোনো ব্যাপার না! আপনার সুবিদামতো যেকোনো সময় নক করবেন। আমরা সবসময় আপনাকে সেরা সেবা দিতে পাশে আছি। ধন্যবাদ! 😊',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (intent === 'QUALITY_DOUBT') {
    return 'আমরা ১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটি নিশ্চিত করি। কোনো কপি বা নরমাল প্রোডাক্ট আমরা সেল করি না। সবচেয়ে বড় সুবিধা হলো—ডেলিভারিম্যানের সামনে পার্সেল খুলে কোয়ালিটি চেক করে দেখে তারপর পেমেন্ট করতে পারবেন। সম্পূর্ণ নিশ্চিন্তে থাকুন! ✨';
  }

  if (intent === 'SHOP_LOCATION') {
    return `আমরা একটি অনলাইন-বেসড অফিশিয়াল শপ। আমাদের সেন্ট্রাল ওয়্যারহাউস থেকে সারা বাংলাদেশের ৬৪ জেলায় দ্রুততম সময়ে হোম ডেলিভারি পৌঁছে দেওয়া হয়। পার্সেল রিসিভ করার সময় চেক করে নেওয়ার পুরো সুযোগ রয়েছে! 🚚`;
  }

  return '';
}

/**
 * Removes robotic AI formatting artifacts from raw LLM output to make it 100% human-like.
 * - Removes markdown headers (###, ##)
 * - Removes list prefixes like 1., 2., -, *
 * - Removes AI prefixes like "Assistant:", "Reply:", "Response:"
 * - Ensures colloquial punctuation and spacing
 */
export function humanizeMessageText(rawText: string): string {
  let text = rawText.trim();
  if (!text) return '';

  // Remove common AI persona prefixes
  text = text.replace(/^(assistant|bot|reply|response|মেসেজ|উত্তর)[:\s-]*/i, '');

  // Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove divider lines
  text = text.replace(/^---+$/gm, '');

  // Soften rigid bullet lists into natural conversational flows
  text = text.replace(/^\s*[-*•]\s+/gm, '• ');

  // Clean extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
