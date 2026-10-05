import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';

export const dynamic = 'force-dynamic';

export interface AdCopyVariant {
  angle: 'PAS' | 'FOMO' | 'LIFESTYLE' | 'OFFER_FOCUSED';
  angleLabel: string;
  headline: string;
  primaryTextBn: string;
  primaryTextEn: string;
  recommendedCTA: string;
  suggestedCreativeFormat: 'Video Reel' | 'Carousel' | 'Single Image' | 'Catalog Collection';
  suggestedHashtags: string[];
}

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await req.json();

    const {
      productId,
      productName,
      category = 'General',
      price,
      regularPrice,
      platform = 'meta', // 'meta' | 'tiktok' | 'google'
      targetAudience = 'Bangladeshi Shoppers',
    } = body;

    let targetProductTitle = productName;
    let targetProductPrice = price;
    let targetProductRegularPrice = regularPrice;
    let targetProductDesc = '';

    // If productId was provided, pull fresh product specs from DB
    if (productId) {
      const { data: prod } = await supabase
        .from('products')
        .select('name, price, regular_price, description, category, strap_type, dial_size')
        .eq('account_id', accountId)
        .eq('id', productId)
        .maybeSingle();

      if (prod) {
        targetProductTitle = prod.name;
        targetProductPrice = prod.price || targetProductPrice;
        targetProductRegularPrice = prod.regular_price || targetProductRegularPrice;
        targetProductDesc = prod.description || '';
      }
    }

    if (!targetProductTitle) {
      return NextResponse.json({ error: 'Product name or productId is required' }, { status: 400 });
    }

    const aiConfig = await loadAiConfig(supabase, accountId, { requireActive: false });
    if (!aiConfig) {
      // Fallback with realistic high-converting templates if AI key not configured
      const fallbackVariants: AdCopyVariant[] = [
        {
          angle: 'PAS',
          angleLabel: 'Problem - Agitate - Solve (পেইন পয়েন্ট)',
          headline: `অনলাইনে পছন্দের ${targetProductTitle} কিনতে গিয়ে প্রতারণার ভয়? আর নয়!`,
          primaryTextBn: `অনেকেই অনলাইনে প্রোডাক্ট অর্ডার করে ছবির সাথে মিলেনা এমন পণ্য পান। আমাদের সাথে সেই ঝুঁকি শূন্য! ক্যাশ অন ডেলিভারিতে পার্সেল খুলে চেক করে তারপর টাকা পরিশোধ করুন। ১০০% প্রিমিয়াম ফিনিশ ও অরিজিনাল কোয়ালিটি গ্যারান্টি। স্টক সীমিত!`,
          primaryTextEn: `Worried about buying online and receiving something different? Inspect the package before paying with Cash On Delivery nationwide.`,
          recommendedCTA: 'Order Now / অর্ডার করুন',
          suggestedCreativeFormat: 'Video Reel',
          suggestedHashtags: ['#EcommerceBD', '#CashOnDelivery', `#${targetProductTitle.replace(/\s+/g, '')}`],
        },
        {
          angle: 'FOMO',
          angleLabel: 'FOMO & Urgency (সীমিত স্টক অফার)',
          headline: `🔥 স্পেশাল অফার শেষ হতে মাত্র কয়েক ঘণ্টা বাকি! ${targetProductTitle}`,
          primaryTextBn: `বর্তমান অফারে পাচ্ছেন বিশাল ছাড়! আগের দাম ৳${targetProductRegularPrice || Number(targetProductPrice || 1500) + 500}, আজ অর্ডার করলে পাচ্ছেন মাত্র ৳${targetProductPrice || 1200}-এ এবং সাথে ফ্রি হোম ডেলিভারি! আর দেরি না করে এখনই বুক করুন।`,
          primaryTextEn: `Limited stock available at our special discounted rate. Grab yours before the offer expires!`,
          recommendedCTA: 'Shop Now / এখনই নিন',
          suggestedCreativeFormat: 'Carousel',
          suggestedHashtags: ['#SpecialOffer', '#BestPriceBD', '#DiscountOffer'],
        },
        {
          angle: 'LIFESTYLE',
          angleLabel: 'Lifestyle & Social Proof (প্রিমিয়াম লুক ও রিভিউ)',
          headline: `আপনার ব্যক্তিত্বে যোগ করুন প্রিমিয়াম এলিগেন্স — ${targetProductTitle}`,
          primaryTextBn: `দৈনন্দিন ব্যবহার কিংবা যেকোনো অনুষ্ঠানে নিজের ব্যক্তিত্ব ফুটিয়ে তুলুন সেরা কোয়ালিটিতে। গত সপ্তাহে ৫,০০০+ কাস্টমার এটি লুফে নিয়েছেন! ডেলিভারি ম্যানের সামনে দেখে নেওয়ার সম্পূর্ণ সুযোগ রয়েছে।`,
          primaryTextEn: `Elevate your lifestyle with authentic premium styling. Loved by 5,000+ satisfied customers nationwide.`,
          recommendedCTA: 'Learn More / বিস্তারিত দেখুন',
          suggestedCreativeFormat: 'Single Image',
          suggestedHashtags: ['#LifestyleBD', '#PremiumStyle', '#CustomerFavorite'],
        },
      ];

      return NextResponse.json({
        success: true,
        productName: targetProductTitle,
        platform,
        variants: fallbackVariants,
      });
    }

    const systemPrompt = `You are an elite Bangladeshi e-commerce ad creative strategist specializing in Meta (Facebook/Instagram), TikTok, and Google Ads.
Return a STRICT valid JSON array of 3 distinct ad copy variations with these exact angles:
1. "PAS" (Problem-Agitate-Solve)
2. "FOMO" (Urgency, Limited Stock & Discount)
3. "LIFESTYLE" (Aspiration, Social Proof & Premium Feel)

Output JSON schema only:
[
  {
    "angle": "PAS" | "FOMO" | "LIFESTYLE",
    "angleLabel": "string",
    "headline": "catchy Bengali headline with emojis",
    "primaryTextBn": "compelling Bengali ad body text",
    "primaryTextEn": "English translation or summary",
    "recommendedCTA": "Call to action button text",
    "suggestedCreativeFormat": "Video Reel" | "Carousel" | "Single Image",
    "suggestedHashtags": ["#tag1", "#tag2"]
  }
]
No markdown wrapping, no explanation, only raw JSON.`;

    const userPrompt = `Product: ${targetProductTitle}
Category: ${category}
Price: ৳${targetProductPrice || 'N/A'} (Regular: ৳${targetProductRegularPrice || 'N/A'})
Audience: ${targetAudience}
Platform: ${platform.toUpperCase()}
Details: ${targetProductDesc || '100% Quality checked, Cash on Delivery nationwide'}`;

    const aiRes = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let variants: AdCopyVariant[] = [];
    try {
      const cleaned = aiRes.text.replace(/```json/g, '').replace(/```/g, '').trim();
      variants = JSON.parse(cleaned);
    } catch {
      // Fallback if model output was not strict JSON
      variants = [
        {
          angle: 'PAS',
          angleLabel: 'Problem - Agitate - Solve',
          headline: `অনলাইনে সেরা কোয়ালিটির ${targetProductTitle} খুঁজছেন?`,
          primaryTextBn: aiRes.text.slice(0, 300),
          primaryTextEn: 'High-converting ad copy for your product.',
          recommendedCTA: 'অর্ডার করুন',
          suggestedCreativeFormat: 'Video Reel',
          suggestedHashtags: ['#EcommerceBD'],
        },
      ];
    }

    return NextResponse.json({
      success: true,
      productName: targetProductTitle,
      platform,
      variants,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
