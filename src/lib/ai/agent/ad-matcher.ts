import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/watch';
import type { AdReferralData } from '@/types/commerce';

export interface AdMatchResult {
  matched: boolean;
  product?: Product;
  colorImages: Array<{ color: string; imageUrl: string }>;
  initialPitchText?: string;
}

import type { BusinessContext } from '../business-context';
import { loadBusinessContext } from '../business-context';
import { cacheGet, cacheSet } from '@/lib/redis/cache';

export async function matchProductFromInbound(
  db: SupabaseClient,
  accountId: string,
  text: string,
  referral?: AdReferralData | null,
  businessContext?: Partial<BusinessContext>
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

  // 5. Default fallback for standard ad template or inquiries
  if (!matchedProduct && (referral || /জানতে চাই|অর্ডার|দাম কত|নিতে চাই|অফার|প্রোডাক্ট|পণ্য|ছবি|image|pic|photo|কালার|color|দেখান|পাঠান/i.test(combinedSearchSource))) {
    matchedProduct = products[0];
  }

  if (!matchedProduct) {
    return { matched: false, colorImages: [] };
  }

  // Build color images list (fallback to main product image or images array if variant image absent)
  const colorImages: Array<{ color: string; imageUrl: string }> = [];
  const colors = matchedProduct.colors?.length ? matchedProduct.colors : [];
  const rawVariants = Array.isArray(matchedProduct.variants)
    ? matchedProduct.variants
    : typeof matchedProduct.variants === 'string'
      ? (() => { try { return JSON.parse(matchedProduct.variants); } catch { return []; } })()
      : [];
  const variantsWithImg = (rawVariants as any[]).filter((v: any) => v?.image_url && typeof v.image_url === 'string' && v.image_url.startsWith('http'));

  if (variantsWithImg.length > 0) {
    for (const v of variantsWithImg.slice(0, 3)) {
      colorImages.push({ color: v.name || 'Variant', imageUrl: v.image_url });
    }
  } else if (matchedProduct.image_url && matchedProduct.image_url.startsWith('http')) {
    const colorsLabel = colors.length ? colors.join(', ') : 'Standard';
    colorImages.push({ color: colorsLabel, imageUrl: matchedProduct.image_url });
  } else if (Array.isArray(matchedProduct.images) && matchedProduct.images.length > 0) {
    for (const img of matchedProduct.images.slice(0, 3)) {
      if (typeof img === 'string' && img.startsWith('http')) {
        colorImages.push({ color: 'Standard', imageUrl: img });
      }
    }
  }

  // Resolve business context
  const ctx = businessContext || (await loadBusinessContext(accountId, db));

  // Generate short, high-converting WhatsApp offer pitch
  const regular = matchedProduct.regular_price ? ` (পূর্বে ৳${matchedProduct.regular_price.toLocaleString('en-BD')})` : '';
  const price = matchedProduct.price.toLocaleString('en-BD');
  const colorsText = colors.join(', ');

  const bonusLine = matchedProduct.warranty_months
    ? `🛡️ সাথে পাচ্ছেন ${matchedProduct.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি কার্ড।`
    : ctx.warrantyPolicy
      ? `🛡️ ${ctx.warrantyPolicy}`
      : `⭐ ১০০% প্রিমিয়াম ও অরিজিনাল কোয়ালিটি নিশ্চিত।`;

  const codText = ctx.advanceChargeRequired
    ? `🚚 ডেলিভারি চার্জ মাত্র ৳${ctx.advanceDeliveryFee ?? 150} অগ্রিম, বাকি টাকা ক্যাশ অন ডেলিভারিতে চেক করে পরিশোধ করবেন।`
    : `🚚 সারা বাংলাদেশে ক্যাশ অন হোম ডেলিভারিতে চেক করে নেওয়ার সুবিধা।`;

  const bonusOffer = ctx.bonusOffer ? `🎁 ${ctx.bonusOffer}\n` : '';

  const initialPitchText =
    `🔥 আমাদের *${ctx.storeName || 'Super Offer'}* চলছে!\n\n` +
    `*${matchedProduct.name}*\n` +
    `💵 অফার মূল্য মাত্র *৳${price}*${regular}!\n` +
    `${codText}\n` +
    `${bonusLine}\n` +
    (bonusOffer ? `${bonusOffer}\n` : '') +
    (colorsText ? `Available: *${colorsText}*\n\n` : '') +
    `আপনি কোনটি নিতে চান? 😊`;

  return {
    matched: true,
    product: matchedProduct,
    colorImages,
    initialPitchText,
  };
}
