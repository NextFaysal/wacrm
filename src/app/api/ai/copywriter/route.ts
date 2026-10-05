import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await req.json();

    const {
      productName,
      category = 'general',
      price,
      regularPrice,
      specs = '',
      tone = 'persuasive',
    } = body;

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const aiConfig = await loadAiConfig(supabase, accountId, { requireActive: false });
    if (!aiConfig) {
      return NextResponse.json(
        {
          error:
            'AI is not configured yet. Please configure your OpenAI, Anthropic, or Gemini API key in Settings → AI.',
        },
        { status: 400 }
      );
    }

    const priceText = price ? `বর্তমান অফার মূল্য: ৳${price}` : '';
    const regPriceText = regularPrice ? `পূর্বের মূল্য: ৳${regularPrice}` : '';

    const systemPrompt = `You are a world-class e-commerce direct response copywriter and marketing specialist for the Bangladeshi market.
Your task is to write high-converting, persuasive sales copy in natural, engaging Bengali (বাংলা) for product landing pages, Facebook Ads, and WhatsApp broadcast campaigns.

Target Audience: Bangladeshi online shoppers who value authenticity, fast delivery, and Cash on Delivery (COD).

Tone style: ${tone} (urgent, highly persuasive, trustworthy).

Format your response in clear, beautifully structured Bengali markdown with emojis.
Structure:
1. 💥 ক্যাচি শিরোনাম (Catchy Headline)
2. 🎯 হুক ও সুবিধা (Emotional Hook & Why buy this?)
3. ✨ মূল বৈশিষ্ট্যসমূহ (Key bullet points with benefits)
4. 🎁 স্পেশাল অফার (Urgency, Discount, Free delivery mention)
5. 🚀 অর্ডার করার কল-টু-অ্যাকশন (Clear Call to Action for Cash On Delivery)`;

    const userPrompt = `অনুগ্রহ করে নিচের প্রোডাক্টটির জন্য একটি অত্যন্ত আকর্ষণীয় ও বিক্রয়যোগ্য সেলস কপি তৈরি করুন:
প্রোডাক্টের নাম: ${productName}
ক্যাটাগরি: ${category}
${priceText}
${regPriceText}
স্পেসিফিকেশন/বিস্তারিত: ${specs || 'উন্নত কোয়ালিটি ও টেকসই ম্যাটেরিয়াল'}
`;

    const result = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    return NextResponse.json({
      success: true,
      copy: result.text,
      productName,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
