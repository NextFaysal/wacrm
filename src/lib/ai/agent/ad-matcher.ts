import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/watch';
import type { AdReferralData } from '@/types/commerce';

export interface AdMatchResult {
  matched: boolean;
  product?: Product;
  colorImages: Array<{ color: string; imageUrl: string }>;
  initialPitchText?: string;
}

import { cacheGet, cacheSet } from '@/lib/redis/cache';

export async function matchProductFromInbound(
  db: SupabaseClient,
  accountId: string,
  text: string,
  referral?: AdReferralData | null
): Promise<AdMatchResult> {
  // 1. Fetch active products from Redis cache or database
  const cacheKey = `products:active:${accountId}`;
  let products = await cacheGet<Product[]>(cacheKey);

  if (!products) {
    const { data: dbProducts, error } = await db
      .from('products')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !dbProducts || dbProducts.length === 0) {
      return { matched: false, colorImages: [] };
    }
    products = dbProducts as Product[];
    // Cache for 5 minutes
    await cacheSet(cacheKey, products, 300);
  }

  const combinedSearchSource = [
    text || '',
    referral?.headline || '',
    referral?.body || '',
    referral?.source_url || '',
  ].join(' ').toLowerCase();

  let matchedProduct: Product | undefined;

  // 2. Match exact SKU
  for (const p of products) {
    if (p.sku && combinedSearchSource.includes(p.sku.toLowerCase())) {
      matchedProduct = p;
      break;
    }
  }

  // 3. Match product name / model
  if (!matchedProduct) {
    for (const p of products) {
      const nameParts = p.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      const matches = nameParts.filter((w: string) => combinedSearchSource.includes(w));
      if (matches.length >= 2 || (nameParts.length === 1 && matches.length === 1)) {
        matchedProduct = p;
        break;
      }
    }
  }

  // 4. Match dynamic brand and category keywords from store products
  if (!matchedProduct) {
    for (const p of products) {
      const keywords = [
        ...p.name.toLowerCase().split(/\s+/),
        ...(p.category ? p.category.toLowerCase().split(/\s+/) : []),
      ].filter((w: string) => w.length >= 3);

      if (keywords.some((k: string) => combinedSearchSource.includes(k))) {
        matchedProduct = p;
        break;
      }
    }
  }

  // 5. Default fallback for standard ad template ("আমি এই প্রোডাক্টটি সম্পর্কে জানতে চাই")
  if (!matchedProduct && (referral || /জানতে চাই|অর্ডার|দাম কত|নিতে চাই|অফার|প্রোডাক্ট|পণ্য/i.test(combinedSearchSource))) {
    matchedProduct = products[0];
  }

  if (!matchedProduct) {
    return { matched: false, colorImages: [] };
  }

  // Build color images list (fallback to main product image if variant image absent)
  const colorImages: Array<{ color: string; imageUrl: string }> = [];
  const colors = matchedProduct.colors?.length ? matchedProduct.colors : [];
  for (const c of colors) {
    if (matchedProduct.image_url) {
      colorImages.push({ color: c, imageUrl: matchedProduct.image_url });
    }
  }

  // Generate short, high-converting WhatsApp offer pitch
  const regular = matchedProduct.regular_price ? ` (পূর্বে ৳${matchedProduct.regular_price.toLocaleString('en-BD')})` : '';
  const price = matchedProduct.price.toLocaleString('en-BD');
  const colorsText = colors.join(', ');

  const bonusLine = matchedProduct.warranty_months
    ? `🛡️ সাথে পাচ্ছেন ${matchedProduct.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি কার্ড।`
    : `⭐ ১০০% প্রিমিয়াম ও অরিজিনাল কোয়ালিটি নিশ্চিত।`;

  const initialPitchText =
    `🔥 আমাদের *Super Offer* চলছে!\n\n` +
    `*${matchedProduct.name}*\n` +
    `💵 অফার মূল্য মাত্র *৳${price}*${regular}!\n` +
    `🚚 সারা বাংলাদেশে ক্যাশ অন হোম ডেলিভারি সুবিধা।\n` +
    `${bonusLine}\n\n` +
    (colorsText ? `Available: *${colorsText}*\n\n` : '') +
    `আপনি কোনটি নিতে চান? 😊`;

  return {
    matched: true,
    product: matchedProduct,
    colorImages,
    initialPitchText,
  };
}
