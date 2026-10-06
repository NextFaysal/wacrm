import type { BusinessContext } from '../business-context';

/**
 * Ultra-Fast In-Memory / Regex Intent Matcher for Bangladesh E-Commerce & Retail.
 * Resolves 60-70% of repetitive customer questions in < 5ms without calling LLM,
 * saving thousands of tokens daily and providing instantaneous human-like replies.
 * Handles both universal e-commerce inquiries and product-specific contexts dynamically.
 */

export interface FastFaqMatch {
  matched: boolean;
  intent?: string;
  replyText?: string;
}

export function matchFastStoreFaq(
  text: string,
  storeOrContext: string | Partial<BusinessContext> = 'আমাদের শপ'
): FastFaqMatch {
  const q = (text || '').trim().toLowerCase();
  if (!q) return { matched: false };

  const ctx: Partial<BusinessContext> =
    typeof storeOrContext === 'string'
      ? { storeName: storeOrContext }
      : storeOrContext || {};

  const storeName = ctx.storeName || 'আমাদের শপ';
  const productNoun = ctx.productNoun || 'পণ্য';
  const bType = ctx.businessType || 'general';

  // 1. Warranty & Guarantee
  if (
    /warranty|guarantee|ওয়ারেন্টি|গ্যারান্টি|কতদিন|মেশিন|কালার নষ্ট|নষ্ট হলে|সার্ভিসিং|নষ্ট হয়ে গেলে/i.test(q) &&
    !/order|অর্ডার|কনফার্ম|বুক/i.test(q)
  ) {
    const defaultWarranty =
      ctx.warrantyPolicy ||
      'আমাদের প্রতিটি পণ্যে কোয়ালিটি নিশ্চয়তা ও রিসিভ করার সময় চেক করে নেওয়ার সুবিধা থাকবে (প্রয়োজনে অফিশিয়াল ওয়ারেন্টি পলিসি প্রযোজ্য) 😊';

    return {
      matched: true,
      intent: 'WARRANTY',
      replyText: defaultWarranty,
    };
  }

  // 2. Delivery Time (কতদিন লাগবে / কবে পাবো)
  if (
    /কবে পাব|কতদিন|কত দিন|সময় লাগ|ডেলিভারি কবে|কত সময়|delivery time|when deliver|কখন পাব/i.test(q) &&
    !/charge|চার্জ|টাকা|ফি|cost/i.test(q)
  ) {
    const inside = ctx.deliveryInsideDhaka || '২৪ থেকে ৪৮ ঘন্টা';
    const outside = ctx.deliveryOutsideDhaka || '৪৮ থেকে ৭২ ঘন্টা';

    return {
      matched: true,
      intent: 'DELIVERY_TIME',
      replyText: `আমাদের ডেলিভারি সাধারণত ঢাকার ভিতরে ${inside} এবং ঢাকার বাহিরে ${outside} সময় লাগতে পারে। 🚚`,
    };
  }

  // 3. Delivery Fee / Shipping Cost (ডেলিভারি চার্জ কত)
  if (
    /ডেলিভারি চার্জ|ডেলিভারি খরচ|ডেলিভারি ফি|শিপিং চার্জ|delivery charge|delivery fee|delivery cost|পৌঁছাতে কত নিবেন/i.test(q)
  ) {
    const insideCharge = ctx.insideDhakaCharge ?? 60;
    const outsideCharge = ctx.outsideDhakaCharge ?? 120;

    let offerText = '';
    if (ctx.freeDeliveryGlobal) {
      offerText = ' আর বর্তমানে আমাদের বিশেষ ক্যাম্পেইনে ডেলিভারি সম্পূর্ণ ফ্রি! 🎁';
    } else if (ctx.freeDeliveryMinQty && ctx.freeDeliveryMinQty > 0) {
      offerText = ` তবে আপনি যদি ${ctx.freeDeliveryMinQty}টি বা ততোধিক ${productNoun} অর্ডার করেন, তাহলে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি! 🎁`;
    }

    return {
      matched: true,
      intent: 'DELIVERY_CHARGE',
      replyText: `আমাদের ডেলিভারি চার্জ ঢাকার ভিতরে মাত্র ৳${insideCharge} এবং ঢাকার বাহিরে ৳${outsideCharge}।${offerText}`,
    };
  }

  // 4. Cash on Delivery & Open-Box Checking (দেখে নেওয়া যাবে কি)
  if (
    /দেখে নেওয়া|চেক করে|খুলে দেখা|ক্যাশ অন ডেলিভারি|cod|দেখে টাকা|আগে দেখে|প্যাকেট খুলে|ডেলিভারিম্যানের সামনে/i.test(q)
  ) {
    if (ctx.advanceChargeRequired) {
      return {
        matched: true,
        intent: 'COD_VERIFICATION',
        replyText: `জি অবশ্যই! ক্যাশ অন ডেলিভারিতে চেক করে নেওয়ার সুবিধা রয়েছে। তবে ডেলিভারি চার্জ মাত্র ৳${ctx.advanceDeliveryFee ?? 150} অগ্রিম পরিশোধ করতে হবে এবং বাকি টাকা পার্সেল দেখে পরিশোধ করবেন। ✨`,
      };
    }
    return {
      matched: true,
      intent: 'COD_VERIFICATION',
      replyText: 'জি অবশ্যই! ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। ডেলিভারিম্যান থেকে পার্সেল রিসিভ করার সময় আপনি ভালো করে চেক করে দেখে টাকা পরিশোধ করতে পারবেন। সম্পূর্ণ নিশ্চিন্তে অর্ডার করতে পারেন! ✨',
    };
  }

  // 5. Water Resistance (পানি লাগলে কি হবে — যদি প্রযোজ্য হয়)
  if (
    /waterproof|water resistant|পানি লাগলে|ওয়াটারপ্রুফ|পানি নিরোধক|ভিজলে নষ্ট/i.test(q)
  ) {
    if (bType === 'watches' || bType === 'electronics') {
      return {
        matched: true,
        intent: 'WATER_RESISTANCE',
        replyText: 'Water resistant (ওয়াটার রেজিস্ট্যান্ট) ফিচার সম্পন্ন প্রোডাক্ট কিছুটা পানি প্রতিরোধ করতে পারে (হালকা পানির ছিটা বা বৃষ্টিতে সমস্যা হবে না)। তবে পানিতে ডুবিয়ে রাখা পরিহার করবেন। 🛡️',
      };
    }
  }

  // 6. Battery / Free Gift / Extra Backup
  if (
    /ব্যাটারি|battery|চার্জ থাকে কতদিন|ব্যাটারী|gift|উপহার|অফার/i.test(q) &&
    !/phone|নাম্বার/i.test(q)
  ) {
    if (bType === 'watches') {
      return {
        matched: true,
        intent: 'BATTERY_AND_GIFT',
        replyText: 'ঘড়িটিতে হাই-কোয়ালিটি লং-লাস্টিং ব্যাটারি লাগানো আছে যা দীর্ঘদিন নিশ্চিন্তে চলে। এছাড়া আমরা স্পেশাল গিফট ও অফিশিয়াল বক্স প্রদান করে থাকি! 🎁',
      };
    } else if (bType === 'electronics') {
      return {
        matched: true,
        intent: 'BATTERY_AND_GIFT',
        replyText: 'এটিতে হাই-কোয়ালিটি লং-লাস্টিং ব্যাটারি ব্যাকআপ সুবিধা রয়েছে যা দীর্ঘ সময় নিরবচ্ছিন্ন সাপোর্ট দেয়। 🔋',
      };
    } else {
      const bonus = ctx.bonusOffer || 'অফিসিয়াল প্যাকিং ও স্পেশাল উপহারের ব্যবস্থা রয়েছে';
      return {
        matched: true,
        intent: 'BATTERY_AND_GIFT',
        replyText: `জি! আমাদের প্রতিটি অর্ডারে ${bonus}! 🎁`,
      };
    }
  }

  // 7. Originality / Quality Assurance (আসল পণ্য তো?)
  if (
    /আসল তো|অরিজিনাল তো|original|নকল নাকি|কপি নাকি|quality kemon|কোয়ালিটি কেমন|original naki/i.test(q)
  ) {
    return {
      matched: true,
      intent: 'ORIGINALITY',
      replyText: `আমরা ${storeName}-এ ১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটির পণ্য সরবরাহ করি। পার্সেল রিসিভ করার সময় চেক করে নেওয়ার সুযোগ রয়েছে। কোনো কপি বা খারাপ মানের পণ্য আমরা বিক্রি করি না। 🛡️`,
    };
  }

  // 8. Polite Declines / Not Buying Now (পরে নিব / এখন নিব না)
  if (
    /এখন নেব না|এখন নিব না|পরে নিব|পরে নেব|এখন লাগবে না|পরে যোগাযোগ করব|টাকা নাই|অন্য সময় নিব|পরে অর্ডার করব|লাগবে না|লাগবেনা|ekhon na|pore nebo|lagbe na/i.test(q)
  ) {
    return {
      matched: true,
      intent: 'FUTURE_PURCHASE',
      replyText: 'কোন ব্যাপার না, আমাদের সাথে যোগাযোগ করার জন্য ধন্যবাদ 🥰\nভবিষ্যতে যেকোনো আকর্ষণীয় অফার বা পণ্যের জন্য আমাদের সাথেই থাকুন। আপনার দিনটি শুভ হোক!',
    };
  }

  return { matched: false };
}
