export type PaymentGatewayType = 'bkash' | 'nagad' | 'sslcommerz' | 'aamarpay' | 'manual';

export interface PaymentGatewayConfig {
  id?: string;
  account_id: string;
  gateway: PaymentGatewayType;
  is_enabled: boolean;
  is_sandbox: boolean;
  config: {
    // bKash
    app_key?: string;
    app_secret?: string;
    username?: string;
    password?: string;
    // Nagad
    merchant_id?: string;
    public_key?: string;
    private_key?: string;
    // Manual
    personal_number?: string;
    merchant_number?: string;
    account_type?: 'personal' | 'merchant' | 'agent';
    instructions?: string;
    // General
    [key: string]: unknown;
  };
  display_name?: string;
  instructions?: string;
  created_at?: string;
  updated_at?: string;
}

export type PaymentLinkStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
export type PaymentPurpose = 'advance_payment' | 'full_payment' | 'custom';

export interface PaymentLink {
  id: string;
  account_id: string;
  order_id?: string | null;
  conversation_id?: string | null;
  payment_token: string;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  customer_name?: string | null;
  customer_phone: string;
  status: PaymentLinkStatus;
  payment_method?: string | null;
  trx_id?: string | null;
  gateway_payment_id?: string | null;
  gateway_response?: Record<string, unknown> | null;
  expires_at?: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BkashTokenResponse {
  statusCode: string;
  statusMessage: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface BkashCreateResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
}

export interface BkashExecuteResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  payerReference: string;
  customerMsisdn: string;
  trxID: string;
  amount: string;
  transactionStatus: string;
  paymentExecuteTime: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
}
