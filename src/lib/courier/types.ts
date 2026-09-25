export type CourierProvider = 'steadfast' | 'pathao' | 'redx' | 'paperfly' | 'custom';

export interface CourierConfig {
  id?: string;
  account_id: string;
  provider: CourierProvider;
  is_active: boolean;
  api_key: string;
  secret_key?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CourierOrderInput {
  provider: CourierProvider;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  invoice_id?: string;
  note?: string;
  conversation_id?: string;
  contact_id?: string;
  color_variant?: string;
  strap_variant?: string;
}

export interface CourierOrderResult {
  success: boolean;
  provider: CourierProvider;
  consignment_id?: string;
  tracking_code: string;
  tracking_url: string;
  status: string;
  delivery_charge?: number;
  error?: string;
}

export interface CourierOrderRecord {
  id: string;
  account_id: string;
  conversation_id?: string | null;
  contact_id?: string | null;
  provider: CourierProvider;
  consignment_id?: string | null;
  tracking_code: string;
  tracking_url?: string | null;
  invoice_id?: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  delivery_charge?: number | null;
  note?: string | null;
  status: string;
  created_at: string;
}

export interface FraudCheckResult {
  phone: string;
  score: number | null;
  level: 'trusted' | 'good' | 'caution' | 'risky' | 'danger' | 'new';
  reasons: string[];
  total_reports: number;
  doubtful_reports?: boolean;
}

export interface CourierBalanceResult {
  current_balance: number;
  status: number;
}
