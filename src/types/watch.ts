export interface ProductVariant {
  id: string;
  name: string; // e.g. "Silver Dial / Leather Strap"
  sku?: string | null;
  price?: number | null; // Optional override; defaults to base price if null
  regular_price?: number | null;
  stock: number;
  image_url?: string | null;
  cost_price?: number | null;
  barcode?: string | null;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface ProductCategory {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface ProductStockLog {
  id: string;
  account_id: string;
  product_id: string;
  variant_id?: string | null;
  change_qty: number;
  previous_stock: number;
  new_stock: number;
  reason: 'manual_adjustment' | 'order_placed' | 'bulk_restock' | 'return';
  order_id?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface TierPrice {
  quantity: number;
  price: number;
  label?: string;
  badge?: string;
}

export interface BundleItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  variant_id?: string | null;
  unit_price?: number;
}

export interface ProductBundle {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  price: number;
  regular_price?: number | null;
  image_url?: string | null;
  description?: string | null;
  items: BundleItem[];
  badge_text?: string | null;
  total_sold: number;
  is_active: boolean;
  created_at?: string;
}

export interface ProductReview {
  id: string;
  account_id: string;
  product_id: string;
  customer_name: string;
  customer_city: string;
  rating: number;
  review_text: string;
  image_url?: string | null;
  is_verified_purchase: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  account_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  regular_price?: number | null;
  cost_price?: number | null;
  unit?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  category?: string | null;
  dial_size?: string | null;
  water_resistance?: string | null;
  movement?: string | null;
  strap_type?: string | null;
  colors?: string[] | null;
  variants?: ProductVariant[] | null;
  custom_attributes?: ProductAttribute[] | null;
  tier_pricing?: TierPrice[] | null;
  warranty_months: number;
  stock_quantity: number;
  low_stock_threshold?: number;
  slug?: string | null;
  images?: string[] | null;
  view_count?: number;
  total_sold?: number;
  badge_text?: string | null;
  is_active: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warranty {
  id: string;
  account_id: string;
  contact_id?: string | null;
  warranty_code: string;
  product_name: string;
  serial_number?: string | null;
  customer_name: string;
  customer_phone: string;
  duration_months: number;
  starts_at: string;
  expires_at: string;
  coverage_details: string;
  status: 'active' | 'expired' | 'claimed' | 'void';
  claim_notes?: string | null;
  created_at: string;
  updated_at: string;
}
