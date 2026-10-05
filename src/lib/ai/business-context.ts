import { supabaseAdmin } from './admin-client';
import type { BusinessType } from '@/types/business';
import { BUSINESS_TYPE_PRESETS } from '@/types/business';

export interface BusinessContext {
  storeName: string;
  businessType: BusinessType;
  businessTypeLabel: string;
  tagline: string;
  productNoun: string; // e.g., 'পণ্য' or 'প্রোডাক্ট'
  warrantyPolicy: string;
  bonusOffer: string;
  specLabels: [string, string, string, string];
  deliveryInsideDhaka: string;
  deliveryOutsideDhaka: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  freeDeliveryMinQty: number;
  freeDeliveryMinAmount: number;
  freeDeliveryGlobal: boolean;
  freeDeliveryBanner: string | null;
  advanceDeliveryFee: number;
  codEnabled: boolean;
  advanceChargeRequired: boolean;
  features: {
    feature1: { title: string; subtitle: string };
    feature2: { title: string; subtitle: string };
    feature3: { title: string; subtitle: string };
  };
  announcementText: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
}

export function getFallbackBusinessContext(storeName = 'আমাদের শপ'): BusinessContext {
  const preset = BUSINESS_TYPE_PRESETS.general;
  return {
    storeName,
    businessType: 'general',
    businessTypeLabel: preset.label,
    tagline: preset.defaultTagline,
    productNoun: 'পণ্য',
    warrantyPolicy: '১০০% কোয়ালিটি গ্যারান্টি ও ডেলিভারির সময় চেক করে নেওয়ার সম্পূর্ণ সুবিধা।',
    bonusOffer: 'অফিসিয়াল প্যাকিং ও দ্রুত ডেলিভারির নিশ্চয়তা',
    specLabels: [
      preset.defaultSpecs.spec_label_1,
      preset.defaultSpecs.spec_label_2,
      preset.defaultSpecs.spec_label_3,
      preset.defaultSpecs.spec_label_4,
    ],
    deliveryInsideDhaka: '২৪ থেকে ৪৮ ঘণ্টা',
    deliveryOutsideDhaka: '৪৮ থেকে ৭২ ঘণ্টা',
    insideDhakaCharge: 60,
    outsideDhakaCharge: 120,
    freeDeliveryMinQty: 2,
    freeDeliveryMinAmount: 0,
    freeDeliveryGlobal: false,
    freeDeliveryBanner: '🎁 ২ বা ততোধিক পণ্য অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!',
    advanceDeliveryFee: 150,
    codEnabled: true,
    advanceChargeRequired: false,
    features: {
      feature1: { title: 'দ্রুততম ডেলিভারি', subtitle: 'সারাদেশে হোম ডেলিভারি' },
      feature2: { title: '১০০% জেনুইন কোয়ালিটি', subtitle: 'প্রিমিয়াম মানের প্রোডাক্ট' },
      feature3: { title: 'ক্যাশ অন ডেলিভারি', subtitle: 'চেক করে পেমেন্ট করার সুবিধা' },
    },
    announcementText: null,
    supportPhone: null,
    whatsappNumber: null,
  };
}

export async function loadBusinessContext(
  accountId: string,
  dbClient?: any
): Promise<BusinessContext> {
  const db = dbClient || supabaseAdmin();

  try {
    const [bizRes, delivRes, zonesRes] = await Promise.all([
      db.from('business_settings').select('*').eq('account_id', accountId).maybeSingle(),
      db.from('delivery_settings').select('*').eq('account_id', accountId).maybeSingle(),
      db.from('delivery_zones').select('*').eq('account_id', accountId).eq('is_active', true).order('sort_order', { ascending: true }),
    ]);

    const biz = bizRes.data;
    const deliv = delivRes.data;
    const zones = zonesRes.data || [];

    const bType: BusinessType = (biz?.business_type as BusinessType) || 'general';
    const preset = BUSINESS_TYPE_PRESETS[bType] || BUSINESS_TYPE_PRESETS.general;

    // Resolve delivery zones
    const insideZone = zones.find(
      (z: any) => z.code === 'inside_dhaka' || (z.name && z.name.includes('ভেতরে'))
    );
    const outsideZone = zones.find(
      (z: any) => z.code === 'outside_dhaka' || (z.name && z.name.includes('বাইরে'))
    );

    const insideDhakaCharge = insideZone ? Number(insideZone.charge) : 60;
    const outsideDhakaCharge = outsideZone ? Number(outsideZone.charge) : 120;
    const deliveryInsideDhaka = insideZone?.estimated_time || '২৪ থেকে ৪৮ ঘণ্টা';
    const deliveryOutsideDhaka = outsideZone?.estimated_time || '৪৮ থেকে ৭২ ঘণ্টা';

    // Resolve warranty text based on business type or features
    let warrantyPolicy = `${biz?.feature_3_title || '১০০% কোয়ালিটি গ্যারান্টি'}: ${biz?.feature_3_subtitle || 'চেক করে নেওয়ার সুবিধা'}`;
    if (bType === 'watches') {
      warrantyPolicy = '১ বছরের মেশিন ও কালার ওয়ারেন্টি এবং রিসিভ করার সময় চেক করে নেওয়ার সুযোগ রয়েছে।';
    } else if (bType === 'electronics') {
      warrantyPolicy = 'অফিসিয়াল ওয়ারেন্টি ও রিপ্লেসমেন্ট গ্যারান্টি এবং ডেলিভারির সময় চেক করে নেওয়ার সুযোগ।';
    } else if (bType === 'fashion') {
      warrantyPolicy = '১০০% প্রিমিয়াম ফেব্রিক ও সাইজ মিসম্যাচ হলে তাৎক্ষণিক এক্সচেঞ্জ সুবিধা।';
    } else if (bType === 'food') {
      warrantyPolicy = '১০০% খাঁটি ও নিরাপদ অর্গানিক পণ্যের নিশ্চয়তা।';
    }

    const bonusOffer = biz?.announcement_text || 'অফিসিয়াল প্যাকিং ও দ্রুত ডেলিভারির নিশ্চয়তা';

    return {
      storeName: biz?.store_name || preset.defaultStoreName,
      businessType: bType,
      businessTypeLabel: preset.label,
      tagline: biz?.tagline || preset.defaultTagline,
      productNoun: bType === 'food' ? 'আইটেম' : 'পণ্য',
      warrantyPolicy,
      bonusOffer,
      specLabels: [
        biz?.spec_label_1 || preset.defaultSpecs.spec_label_1,
        biz?.spec_label_2 || preset.defaultSpecs.spec_label_2,
        biz?.spec_label_3 || preset.defaultSpecs.spec_label_3,
        biz?.spec_label_4 || preset.defaultSpecs.spec_label_4,
      ],
      deliveryInsideDhaka,
      deliveryOutsideDhaka,
      insideDhakaCharge,
      outsideDhakaCharge,
      freeDeliveryMinQty: deliv?.free_delivery_min_qty ?? 2,
      freeDeliveryMinAmount: Number(deliv?.free_delivery_min_amount) || 0,
      freeDeliveryGlobal: Boolean(deliv?.free_delivery_global),
      freeDeliveryBanner: deliv?.free_delivery_banner_text || null,
      advanceDeliveryFee: 150,
      codEnabled: deliv?.cod_enabled !== false,
      advanceChargeRequired: Boolean(deliv?.advance_charge_required),
      features: {
        feature1: {
          title: biz?.feature_1_title || 'দ্রুততম ডেলিভারি',
          subtitle: biz?.feature_1_subtitle || 'সারাদেশে হোম ডেলিভারি',
        },
        feature2: {
          title: biz?.feature_2_title || '১০০% জেনুইন কোয়ালিটি',
          subtitle: biz?.feature_2_subtitle || 'প্রিমিয়াম কোয়ালিটি নিশ্চিত',
        },
        feature3: {
          title: biz?.feature_3_title || 'ক্যাশ অন ডেলিভারি',
          subtitle: biz?.feature_3_subtitle || 'চেক করে পেমেন্ট করার সুবিধা',
        },
      },
      announcementText: biz?.announcement_text || null,
      supportPhone: biz?.support_phone || null,
      whatsappNumber: biz?.whatsapp_number || null,
    };
  } catch (error) {
    console.error('[loadBusinessContext] Error loading context:', error);
    return getFallbackBusinessContext();
  }
}
