import type { Product } from '@/types/watch';
import { aiRequestTimeoutMs } from './defaults';

interface VisionAnalysisArgs {
  apiKey: string;
  imageUrl: string;
  catalog?: Product[];
  caption?: string | null;
  provider?: 'openai' | 'anthropic' | 'gemini';
}

export interface WatchVisionResult {
  isWatch: boolean;
  matchedProductId: string | null;
  matchedProductName: string | null;
  dialColor?: string | null;
  strapType?: string | null;
  brandName?: string | null;
  descriptionBangla: string;
  suggestedPitch?: string;
}

export async function analyzeWatchImageWithVision(args: VisionAnalysisArgs): Promise<WatchVisionResult | null> {
  const { apiKey, imageUrl, catalog = [], caption } = args;

  try {
    const timeoutMs = aiRequestTimeoutMs() * 2;

    const catalogList = catalog.slice(0, 10).map((p) => (
      `- ID: ${p.id} | Name: ${p.name} | Price: ৳${p.price} | Colors: ${p.colors?.join(', ') || 'Standard'} | Strap: ${p.strap_type || 'N/A'}`
    )).join('\n');

    const promptText = `
You are an expert luxury and fashion watch analyst for a Bangladeshi watch store.
A customer on WhatsApp sent this image${caption ? ` with caption: "${caption}"` : ''}.

Here is our active watch catalog:
${catalogList || 'No catalog available.'}

Analyze the photo:
1. Is this a watch or watch screenshot?
2. Which watch from our catalog does this match or look closest to?
3. What is the dial color, strap material, and overall style?
4. Write a warm 1-sentence Bengali description for our sales agent.

Return ONLY a valid JSON object with this exact shape:
{
  "isWatch": true,
  "matchedProductId": "catalog-id-or-null",
  "matchedProductName": "matching-product-name-or-null",
  "dialColor": "Black / Silver / Blue / etc",
  "strapType": "Leather / Stainless Steel / etc",
  "brandName": "Curren / Naviforce / Poedagar / etc",
  "descriptionBangla": "কাস্টমার ব্ল্যাক ডায়াল ও লেদার স্ট্র্যাপের প্রিমিয়াম ওয়াচের ছবি পাঠিয়েছেন।",
  "suggestedPitch": "জি ভাইয়া! চমৎকার পছন্দ! এটি আমাদের প্রিমিয়াম মডেল..."
}
`;

    const isGemini = args.provider === 'gemini';
    const endpoint = isGemini
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const visionModel = isGemini ? 'gemini-2.5-flash' : 'gpt-4o-mini';

    const requestBody: Record<string, unknown> = {
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'low' },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    };

    if (isGemini) {
      requestBody.max_tokens = 500;
    } else {
      requestBody.max_completion_tokens = 500;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[vision] Image analysis failed (${res.status}): ${err.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as WatchVisionResult;
    return parsed;
  } catch (err) {
    console.error('[vision] Error analyzing watch image:', err);
    return null;
  }
}
