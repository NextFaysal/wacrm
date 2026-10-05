export type SmsProviderType = 'greenweb' | 'bulksmsbd' | 'alphasms' | 'mimsms' | 'twilio' | 'custom';

export interface SmsGatewayConfig {
  id?: string;
  account_id: string;
  provider: SmsProviderType;
  is_enabled: boolean;
  api_key?: string;
  api_secret?: string;
  sender_id?: string;
  balance?: number;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SendSmsParams {
  accountId: string;
  phone: string;
  message: string;
  orderId?: string | null;
}

export interface SendSmsResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  response?: unknown;
}
