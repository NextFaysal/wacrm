import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePriceIntelligence } from './price-intelligence';

export interface AiInsight {
  type: 'conversion_rate' | 'top_abandoned_product' | 'peak_hours' | 'vip_opportunity' | 'restock_alert' | 'pricing_tip';
  title: string;
  description: string;
  value?: string;
  trend?: 'up' | 'down' | 'neutral';
  action?: string;
}

/**
 * Generate actionable AI business insights for the last 30 days.
 */
export async function generateAiInsights(
  db: SupabaseClient,
  accountId: string
): Promise<AiInsight[]> {
  const insights: AiInsight[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Orders conversion analysis
    const { data: orders } = await db
      .from('orders')
      .select('id, status, total_amount, product_name, created_at')
      .eq('account_id', accountId)
      .gte('created_at', thirtyDaysAgo);

    if (orders && orders.length > 0) {
      const total = orders.length;
      const confirmed = orders.filter((o) => o.status === 'confirmed' || o.status === 'delivered').length;
      const rate = Math.round((confirmed / total) * 100);

      insights.push({
        type: 'conversion_rate',
        title: 'অর্ডার কনভার্সন রেট',
        description: `গত ৩০ দিনে মোট ${total} টি ইনবাউন্ড অর্ডারের মধ্যে ${confirmed} টি সফলভাবে কনফার্ম হয়েছে।`,
        value: `${rate}%`,
        trend: rate >= 60 ? 'up' : rate >= 40 ? 'neutral' : 'down',
        action: rate < 50 ? 'দাম-দর ও ফলোআপ মেসেজে কুপন কোড ব্যবহার বাড়াতে পারেন।' : 'কনভার্সন রেট দারুণ অবস্থায় আছে!',
      });

      // 2. Identify top ordered vs cancelled products
      const productCounts: Record<string, { total: number; cancelled: number }> = {};
      orders.forEach((o) => {
        const pName = o.product_name || 'অন্যান্য পণ্য';
        if (!productCounts[pName]) productCounts[pName] = { total: 0, cancelled: 0 };
        productCounts[pName].total++;
        if (o.status === 'cancelled' || o.status === 'returned') {
          productCounts[pName].cancelled++;
        }
      });

      const mostPopular = Object.entries(productCounts).sort((a, b) => b[1].total - a[1].total)[0];
      if (mostPopular) {
        insights.push({
          type: 'top_abandoned_product',
          title: 'সর্বোচ্চ চাহিদাসম্পন্ন পণ্য',
          description: `গ্রাহকদের সবচেয়ে বেশি পছন্দ '${mostPopular[0]}'। মোট ${mostPopular[1].total} টি অর্ডার এসেছে।`,
          value: mostPopular[0],
          trend: 'up',
          action: 'এই পণ্যের জন্য মেটা বিজ্ঞাপন বাজেট বাড়ালে বিক্রয় আরো বৃদ্ধি পাবে।',
        });
      }
    } else {
      insights.push({
        type: 'conversion_rate',
        title: 'নতুন ব্যবসা সূচনা',
        description: 'গত ৩০ দিনে নতুন কোনো অর্ডার নেই। পণ্য যোগ করে প্রচার শুরু করুন।',
        trend: 'neutral',
        action: 'ক্যাটালগে অন্তত ৫টি আকর্ষণীয় প্রোডাক্ট যোগ করুন।',
      });
    }

    // 3. Repeat / VIP customer opportunities
    const { data: repeatContacts } = await db
      .from('contacts')
      .select('id, name, phone, total_orders, loyalty_tier')
      .eq('account_id', accountId)
      .gte('total_orders', 2)
      .limit(5);

    if (repeatContacts && repeatContacts.length > 0) {
      insights.push({
        type: 'vip_opportunity',
        title: 'VIP রিপিট কাস্টমার সুযোগ',
        description: `আপনার স্টোরে ${repeatContacts.length} জন বিশ্বস্ত কাস্টমার রয়েছে যারা একাধিকবার অর্ডার করেছেন।`,
        value: `${repeatContacts.length} জন`,
        trend: 'up',
        action: 'তাদের জন্য নতুন কালেকশন বা স্পেশাল VIP কুপন দিয়ে মেসেজ পাঠান।',
      });
    }

    // 4. Low stock alert insight
    const { data: lowStock } = await db
      .from('products')
      .select('name, stock_quantity')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .lte('stock_quantity', 5)
      .limit(3);

    if (lowStock && lowStock.length > 0) {
      const names = lowStock.map((p) => p.name).join(', ');
      insights.push({
        type: 'restock_alert',
        title: 'স্টক রিস্টক এলার্ট',
        description: `${names} পণ্যের স্টক ৫ বা তার নিচে নেমে এসেছে। দ্রুত রিস্টক করুন।`,
        value: 'কম স্টক',
        trend: 'down',
        action: 'সাপ্লায়ারের সাথে যোগাযোগ করে স্টক আপডেট নিশ্চিত করুন।',
      });
    }

    // 5. Price Intelligence & Margin Insights
    const priceTips = await calculatePriceIntelligence(db, accountId);
    const actionableTip = priceTips.find((p) => p.recommendation !== 'OPTIMAL');
    if (actionableTip) {
      insights.push({
        type: 'pricing_tip',
        title: `স্মার্ট প্রাইসিং পরামর্শ (${actionableTip.productName})`,
        description: actionableTip.insightText,
        value: `৳${actionableTip.marketSuggestedPrice}`,
        trend: actionableTip.recommendation === 'INCREASE_PRICE' ? 'up' : 'down',
        action: actionableTip.potentialProfitImpact,
      });
    }

    return insights;
  } catch (err) {
    console.warn('[generateAiInsights] Failed to compute insights:', err);
    return [
      {
        type: 'conversion_rate',
        title: 'AI সিস্টেম রানিং',
        description: 'AI এজেন্ট কাস্টমারদের সাথে সক্রিয়ভাবে কথা বলছে এবং ডেটা শিখছে।',
        trend: 'neutral',
      },
    ];
  }
}
