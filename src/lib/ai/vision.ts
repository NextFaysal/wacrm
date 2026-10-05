import type { Product } from '@/types/watch';
import { aiRequestTimeoutMs } from './defaults';

interface VisionAnalysisArgs {
  apiKey: string;
  imageUrl: string;
  catalog?: Product[];
  caption?: string | null;
  provider?: 'openai' | 'anthropic' | 'gemini';
}

export interface ProductVisionResult {
  isProduct: boolean;
  isWatch?: boolean;
  matchedProductId: string | null;
  matchedProductName: string | null;
  variantColor?: string | null;
  variantStyle?: string | null;
  dialColor?: string | null;
  strapType?: string | null;
  brandName?: string | null;
  descriptionBangla: string;
  suggestedPitch?: string;
}

// Backward-compatible alias
export type WatchVisionResult = ProductVisionResult;

export async function analyzeProductImageWithVision(args: VisionAnalysisArgs): Promise<ProductVisionResult | null> {
  const { apiKey, imageUrl, catalog = [], caption } = args;

  try {
    const timeoutMs = aiRequestTimeoutMs() * 2;

    const catalogList = catalog.slice(0, 10).map((p) => {
      const details = [
        p.category ? `Category: ${p.category}` : null,
        p.colors?.length ? `Colors: ${p.colors.join(', ')}` : null,
        p.strap_type ? `Variant/Spec: ${p.strap_type}` : null,
      ].filter(Boolean).join(' | ');
      return `- ID: ${p.id} | Name: ${p.name} | Price: ৳${p.price}${details ? ` | ${details}` : ''}`;
    }).join('\n');

    const promptText = `
You are an expert e-commerce product recognition specialist for an online retail store in Bangladesh.
A customer on WhatsApp sent this image${caption ? ` with caption: "${caption}"` : ''}.

Here is our active store product catalog:
${catalogList || 'No catalog available.'}

Analyze the photo:
1. Is this a physical product, merchandise, fashion item, gadget, cosmetic, accessory, or product screenshot?
2. Which product from our active catalog does this match or look closest to?
3. What is the color, size, style, or variant?
4. Write a warm 1-sentence Bengali description for our sales agent.

Return ONLY a valid JSON object with this exact shape:
{
  "isProduct": true,
  "matchedProductId": "catalog-id-or-null",
  "matchedProductName": "matching-product-name-or-null",
  "variantColor": "Color or null",
  "variantStyle": "Size, Variant or Style",
  "brandName": "Brand or Category name",
  "descriptionBangla": "কাস্টমার অমুক প্রোডাক্টের ছবি পাঠিয়েছেন।",
  "suggestedPitch": "জি! চমৎকার পছন্দ! এটি আমাদের প্রিমিয়াম কোয়ালিটির প্রোডাক্ট..."
}
`;

    const isGemini = args.provider === 'gemini';
    const endpoint = isGemini
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const visionModel = isGemini ? 'gemini-3.8-flash' : 'gpt-4o-mini';

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

    const parsed = JSON.parse(content) as ProductVisionResult;
    // Normalize aliases
    parsed.isWatch = parsed.isProduct;
    parsed.dialColor = parsed.variantColor || parsed.dialColor;
    parsed.strapType = parsed.variantStyle || parsed.strapType;
    return parsed;
  } catch (err) {
    console.error('[vision] Error analyzing product image:', err);
    return null;
  }
}

// Backward-compatible export
export const analyzeWatchImageWithVision = analyzeProductImageWithVision;
