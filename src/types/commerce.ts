export type ConversationState =
  | 'NEW'
  | 'PRODUCT_IDENTIFICATION'
  | 'PRODUCT_INFORMATION_SENT'
  | 'WAITING_FOR_CUSTOMER'
  | 'CUSTOMER_QUESTION'
  | 'PURCHASE_INTENT'
  | 'COLLECTING_ORDER_INFORMATION'
  | 'VALIDATING_ORDER_INFORMATION'
  | 'RISK_CHECK'
  | 'WAITING_FOR_HUMAN_APPROVAL'
  | 'ORDER_CREATING'
  | 'ORDER_CREATED'
  | 'COURIER_BOOKING'
  | 'COURIER_BOOKED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'HUMAN_HANDOFF'
  | 'COMPLETED';

export interface AdReferralData {
  source_id?: string;
  source_type?: string;
  source_url?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
}

export interface RiskCheckResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  cancellationRate: number;
  totalOrders: number;
  cancelledOrders: number;
  deliveredOrders: number;
  steadfastDeliveryRatio?: number;
  requiresHumanApproval: boolean;
  reasons: string[];
}

export interface ConversationMemory {
  interested_product_id?: string;
  interested_product_name?: string;
  selected_variant?: string;
  quantity?: number;
  customer_name?: string;
  customer_phone?: string;
  full_address?: string;
  thana?: string;
  district?: string;
  collected_fields?: string[];
  missing_fields?: string[];
  risk_result?: RiskCheckResult;
  order_id?: string;
  courier_tracking?: string;
  courier_consignment_id?: string;
  last_customer_intent?: string;
  referral?: AdReferralData;
  followup_scheduled_at?: string;
  is_ad_referral?: boolean;
  free_window_expires_at?: string;
  ai_followup_count?: number;
}

export type OrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COURIER_BOOKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'FAILED_DELIVERY';

export interface Order {
  id: string;
  account_id: string;
  conversation_id?: string | null;
  contact_id?: string | null;
  product_id?: string | null;
  product_name: string;
  variant?: string | null;
  quantity: number;
  unit_price: number;
  delivery_charge: number;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  thana?: string | null;
  district?: string | null;
  status: OrderStatus;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score?: number;
  risk_notes?: string | null;
  courier_provider?: string | null;
  courier_tracking_code?: string | null;
  courier_consignment_id?: string | null;
  courier_status?: string | null;
  advance_paid?: number;
  advance_method?: string | null;
  advance_status?: string | null;
  advance_trx_id?: string | null;
  invoice_no?: string | null;
  notes?: string | null;
  idempotency_key?: string | null;
  call_status?: 'uncalled' | 'called_confirmed' | 'called_no_answer' | 'called_busy' | 'called_cancelled' | 'called_rescheduled' | null;
  call_attempt_count?: number;
  last_called_at?: string | null;
  confirmation_token?: string | null;
  confirmation_status?: string | null;
  review_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAuditEntry {
  id?: string;
  account_id: string;
  conversation_id: string;
  contact_id?: string | null;
  tool_name: string;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  status: 'success' | 'failure' | 'requires_approval';
  error_message?: string | null;
  created_at?: string;
}

export interface AiCommerceConfig {
  delivery_charge_inside_dhaka: number;
  delivery_charge_outside_dhaka: number;
  free_delivery_min_amount?: number | null;
  default_gift: string;
  risk_max_cancellation_rate: number;
  risk_min_steadfast_ratio: number;
  auto_courier_booking: boolean;
  followup_delay_minutes: number;
  auto_tagging_enabled: boolean;
}
