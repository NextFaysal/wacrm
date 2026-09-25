export interface DeliveryZone {
  id: string;
  account_id: string;
  name: string;
  code?: string | null;
  charge: number;
  is_free: boolean;
  estimated_time?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliverySettings {
  account_id: string;
  free_delivery_global: boolean;
  free_delivery_min_qty: number;
  free_delivery_min_amount: number;
  free_delivery_banner_text?: string | null;
  cod_enabled: boolean;
  advance_charge_required: boolean;
  created_at?: string;
  updated_at?: string;
}
