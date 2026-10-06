export type BusinessType =
  | 'general'
  | 'watches'
  | 'fashion'
  | 'electronics'
  | 'food'
  | 'cosmetics'
  | 'accessories'
  | 'home';

export interface BusinessSettings {
  id: string;
  account_id: string;
  store_name: string;
  business_type: BusinessType;
  tagline: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  logo_url: string | null;
  banner_url: string | null;
  store_slug: string | null;
  support_phone: string | null;
  support_email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  currency_symbol: string;
  primary_color: string;
  
  // Custom Spec Labels for Product Landing Pages
  spec_label_1: string;
  spec_label_2: string;
  spec_label_3: string;
  spec_label_4: string;

  // Features / Highlights
  feature_1_title: string;
  feature_1_subtitle: string;
  feature_2_title: string;
  feature_2_subtitle: string;
  feature_3_title: string;
  feature_3_subtitle: string;

  // Top Bar Announcement
  announcement_text: string | null;
  announcement_enabled: boolean;

  // Meta Conversions API (CAPI)
  meta_pixel_id?: string | null;
  meta_capi_access_token?: string | null;
  meta_capi_test_code?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface BusinessTypePreset {
  id: BusinessType;
  label: string;
  defaultStoreName: string;
  defaultTagline: string;
  defaultProductNoun: string;
  defaultSpecs: {
    spec_label_1: string;
    spec_label_2: string;
    spec_label_3: string;
    spec_label_4: string;
  };
  defaultCategories: string[];
}

export const BUSINESS_TYPE_PRESETS: Record<BusinessType, BusinessTypePreset> = {
  general: {
    id: 'general',
    label: 'General E-Commerce (যেকোনো পণ্য)',
    defaultStoreName: 'My Online Store',
    defaultTagline: 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
    defaultProductNoun: 'পণ্য',
    defaultSpecs: {
      spec_label_1: 'মডেল / কোড',
      spec_label_2: 'ম্যাটেরিয়াল / উপাদান',
      spec_label_3: 'সাইজ / পরিমাপ',
      spec_label_4: 'ওয়ারেন্টি / গ্যারান্টি',
    },
    defaultCategories: ['All Products', 'Trending', 'Best Sellers', 'New Arrival'],
  },
  watches: {
    id: 'watches',
    label: 'Watches & Timepieces (ঘড়ি ও ওয়াচ)',
    defaultStoreName: 'Watch Vault BD',
    defaultTagline: 'প্রিমিয়াম কোয়ালিটি লাক্সারি ও ক্যাজুয়াল ঘড়ি',
    defaultProductNoun: 'ঘড়ি',
    defaultSpecs: {
      spec_label_1: 'ডায়াল সাইজ',
      spec_label_2: 'মুভমেন্ট ইঞ্জিন',
      spec_label_3: 'ওয়াটার রেজিস্ট্যান্স',
      spec_label_4: 'স্ট্র্যাপ ম্যাটেরিয়াল',
    },
    defaultCategories: ['All Watches', 'Men', 'Women', 'Automatic', 'Quartz', 'Chronograph'],
  },
  fashion: {
    id: 'fashion',
    label: 'Fashion & Clothing (পোশাক ও ফ্যাশন)',
    defaultStoreName: 'Fashion Hub BD',
    defaultTagline: 'আধুনিক ট্রেন্ডি ফ্যাশন পোশাকের বিশ্বস্ত কালেকশন',
    defaultProductNoun: 'পোশাক',
    defaultSpecs: {
      spec_label_1: 'ফেব্রিক / উপাদান',
      spec_label_2: 'ফিটিং / সাইজ চার্ট',
      spec_label_3: 'কালার ভ্যারিয়েন্ট',
      spec_label_4: 'ওয়াশ কেয়ার',
    },
    defaultCategories: ['All Outfits', 'Panjabi', 'Shirt', 'T-Shirt', 'Sharee', 'Three Piece'],
  },
  electronics: {
    id: 'electronics',
    label: 'Electronics & Gadgets (ইলেকট্রনিক্স ও গ্যাজেট)',
    defaultStoreName: 'Gadget Store BD',
    defaultTagline: 'লেটেস্ট গ্যাজেট ও ইলেকট্রনিক্স অ্যাক্সেসরিজ',
    defaultProductNoun: 'গ্যাজেট',
    defaultSpecs: {
      spec_label_1: 'মডেল ও প্রসেসর',
      spec_label_2: 'ব্যাটারি লাইফ / ব্যাকআপ',
      spec_label_3: 'কানেক্টিভিটি / পোর্টস',
      spec_label_4: 'অফিশিয়াল ওয়ারেন্টি',
    },
    defaultCategories: ['All Gadgets', 'Smartwatches', 'Earbuds', 'Powerbank', 'Chargers'],
  },
  food: {
    id: 'food',
    label: 'Food & Organic Items (খাবার ও অর্গানিক ফুড)',
    defaultStoreName: 'Pure Organics BD',
    defaultTagline: '১০০% খাঁটি ও নির্ভেজাল খাবার আপনার দোড়গোড়ায়',
    defaultProductNoun: 'খাবার',
    defaultSpecs: {
      spec_label_1: 'উৎস ও উপাদান',
      spec_label_2: 'নেট ওজন / পরিমাণ',
      spec_label_3: 'সংরক্ষণ পদ্ধতি',
      spec_label_4: 'মেয়াদ উত্তীর্ণ সময়',
    },
    defaultCategories: ['All Items', 'Pure Ghee', 'Raw Honey', 'Dry Fruits', 'Organic Spices'],
  },
  cosmetics: {
    id: 'cosmetics',
    label: 'Cosmetics & Beauty (কসমেটিক্স ও রূপচর্চা)',
    defaultStoreName: 'Beauty Lounge BD',
    defaultTagline: 'প্রাকৃতিক ও প্রিমিয়াম বিউটি স্কিনকেয়ার প্রডাক্ট',
    defaultProductNoun: 'প্রোডাক্ট',
    defaultSpecs: {
      spec_label_1: 'স্কিন টাইপ উপযোগী',
      spec_label_2: 'মূল উপাদানসমূহ',
      spec_label_3: 'নেট ভলিউম',
      spec_label_4: 'উৎপাদন ও মেয়াদ',
    },
    defaultCategories: ['All Cosmetics', 'Face Wash', 'Serums', 'Moisturizers', 'Sunscreen'],
  },
  accessories: {
    id: 'accessories',
    label: 'Bags, Wallets & Accessories (ব্যাগ ও অ্যাক্সেসরিজ)',
    defaultStoreName: 'Leather Craft BD',
    defaultTagline: 'জেনুইন লেদার ওয়ালেট, বেল্ট ও ব্যাগ কালেকশন',
    defaultProductNoun: 'ব্যাগ/আইটেম',
    defaultSpecs: {
      spec_label_1: 'লেদার টাইপ',
      spec_label_2: 'চেম্বার / পকেট সংখ্যা',
      spec_label_3: 'ডাইমেনশন / সাইজ',
      spec_label_4: 'ওয়ারেন্টি',
    },
    defaultCategories: ['All Accessories', 'Wallets', 'Belts', 'Backpacks', 'Card Holders'],
  },
  home: {
    id: 'home',
    label: 'Home Decor & Living (ঘর সাজানো ও লাইফস্টাইল)',
    defaultStoreName: 'Home Lifestyle BD',
    defaultTagline: 'আপনার ঘর সাজাতে দৃষ্টিনন্দন ডেকোর কালেকশন',
    defaultProductNoun: 'পণ্য',
    defaultSpecs: {
      spec_label_1: 'ম্যাটেরিয়াল কোয়ালিটি',
      spec_label_2: 'সাইজ ও মেজারমেন্ট',
      spec_label_3: 'ফিনিশিং / কালার',
      spec_label_4: 'ইনস্টলেশন পদ্ধতি',
    },
    defaultCategories: ['All Decor', 'Lamps & Lights', 'Wall Art', 'Cushions', 'Kitchenware'],
  },
};
