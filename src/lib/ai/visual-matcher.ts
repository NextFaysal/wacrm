import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/watch';

export interface VisualMatchResult {
  matched: boolean;
  product?: Product;
  confidence: number;
  message: string;
}

/**
 * Visual Matcher: When customer sends an image URL or image caption,
 * this function matches against product catalog images or visual keywords.
 */
export async function matchProductFromImage(
  db: SupabaseClient,
  accountId: string,
  imageDescriptionOrKeywords: string
): Promise<VisualMatchResult> {
  if (!imageDescriptionOrKeywords || !accountId) {
    return {
      matched: false,
      confidence: 0,
      message: 'কোনো ভিজ্যুয়াল তথ্য বা ডেসক্রিপশন পাওয়া যায়নি।',
    };
  }

  try {
    const { data: products } = await db
      .from('products')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .limit(20);

    if (!products || products.length === 0) {
      return {
        matched: false,
        confidence: 0,
        message: 'ক্যাটালগে কোনো সক্রিয় স্টক নেই।',
      };
    }

    const query = imageDescriptionOrKeywords.toLowerCase();

    // 1. Check direct name match
    for (const p of products) {
      if (p.name && query.includes(p.name.toLowerCase())) {
        return {
          matched: true,
          product: p as Product,
          confidence: 0.95,
          message: `আপনার ছবির সাথে আমাদের *${p.name}* মডেলটি মিলেছে! বর্তমান মূল্য ৳${p.price} এবং এটি স্টকে এভেইলেবল আছে। 🎉`,
        };
      }
    }

    // 2. Check keywords against category, color, description
    for (const p of products) {
      const tokens = [
        p.category,
        p.strap_type,
        ...(p.colors || []),
      ]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase());

      const matchCount = tokens.filter((t) => query.includes(t)).length;
      if (matchCount > 0) {
        return {
          matched: true,
          product: p as Product,
          confidence: 0.8,
          message: `আপনার পাঠানো ছবির মতো আমাদের কালেকশনে রয়েছে *${p.name}* (মূল্য ৳${p.price})। এটি কি দেখতে চেয়েছেন? 😊`,
        };
      }
    }

    // Fallback: Return top featured product
    const featured = products[0];
    return {
      matched: true,
      product: featured as Product,
      confidence: 0.5,
      message: `আপনার পাঠানো ছবির কাছাকাছি আমাদের প্রিমিয়াম *${featured.name}* (মূল্য ৳${featured.price}) চমৎকার অপশন হতে পারে।`,
    };
  } catch (err) {
    console.warn('[matchProductFromImage] Visual matching error:', err);
    return {
      matched: false,
      confidence: 0,
      message: 'ছবি স্ক্যান করার সময় সমস্যা হয়েছে।',
    };
  }
}
