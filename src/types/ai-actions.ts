export interface AiActionSettings {
  id?: string;
  account_id: string;
  auto_order_creation: boolean;
  auto_courier_booking: boolean;
  risk_engine: boolean;
  auto_followup: boolean;
  send_product_images: boolean;
  voice_notes: boolean;
  smart_courier_routing?: boolean;
  meta_capi_tracking?: boolean;
  vip_loyalty?: boolean;
  live_tracking_bot?: boolean;
  dynamic_upsell?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CustomActionType = 'fixed_reply' | 'instant_coupon' | 'notify_owner' | 'webhook';

export interface CustomActionConfig {
  message?: string;
  discount_amount?: number;
  coupon_prefix?: string;
  owner_phone?: string;
  alert_title?: string;
  webhook_url?: string;
  webhook_method?: 'GET' | 'POST';
  headers?: Record<string, string>;
}

export interface AiCustomAction {
  id: string;
  account_id: string;
  name: string;
  description: string;
  action_type: CustomActionType;
  config: CustomActionConfig;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export const DEFAULT_AI_ACTION_SETTINGS: Omit<AiActionSettings, 'id' | 'account_id'> = {
  auto_order_creation: true,
  auto_courier_booking: false, // safe default
  risk_engine: true,
  auto_followup: true,
  send_product_images: true,
  voice_notes: true,
  smart_courier_routing: true,
  meta_capi_tracking: true,
  vip_loyalty: true,
  live_tracking_bot: true,
  dynamic_upsell: true,
};
