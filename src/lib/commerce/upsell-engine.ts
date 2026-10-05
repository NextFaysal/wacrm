import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpsellRecommendation {
  hasUpsell: boolean;
  upsellProduct?: {
    id: string;
    name: string;
    price: number;
    regular_price?: number;
    image_url?: string;
  };
  comboOfferText?: string;
  bundleDiscountAmount?: number;
}

/**
 * Finds a relevant companion product to upsell based on current product.
 * Examples: Watch -> Premium Box/Extra Strap, Dress -> Matching Dupatta/Bag, Tech -> Charger/Case.
 */
export async function getSmartUpsellRecommendation(
  db: SupabaseClient,
  accountId: string,
  currentProductId?: string
): Promise<UpsellRecommendation> {
  if (!accountId) return { hasUpsell: false };

  try {
    let query = db
      .from('products')
      .select('id, name, price, regular_price, image_url, category')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .gt('stock_quantity', 0);

    if (currentProductId) {
      query = query.neq('id', currentProductId);
    }

    // Fetch up to 5 potential products
    const { data: products } = await query.order('price', { ascending: true }).limit(5);

    if (!products || products.length === 0) {
      return { hasUpsell: false };
    }

    // Pick an affordable companion product (lowest price or relevant add-on)
    const upsell = products[0];
    const discount = Math.min(100, Math.round(Number(upsell.price) * 0.15));

    const comboOfferText = `🎁 *স্পেশাল কম্বো অফার:* এই অর্ডারের সাথে আমাদের জনপ্রিয় *${upsell.name}* (মূল্য ৳${upsell.price}) মাত্র *৳${Number(upsell.price) - discount}*-এ (৳${discount} ছাড়) একসাথে ডেলিভারি নিতে চান?`;

    return {
      hasUpsell: true,
      upsellProduct: {
        id: upsell.id,
        name: upsell.name,
        price: Number(upsell.price),
        regular_price: upsell.regular_price ? Number(upsell.regular_price) : undefined,
        image_url: upsell.image_url,
      },
      comboOfferText,
      bundleDiscountAmount: discount,
    };
  } catch (err) {
    console.warn('[getSmartUpsellRecommendation] Failed to calculate upsell:', err);
    return { hasUpsell: false };
  }
}
