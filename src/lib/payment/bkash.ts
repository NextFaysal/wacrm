import { BkashTokenResponse, BkashCreateResponse, BkashExecuteResponse } from './types';

const SANDBOX_BASE_URL = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout';
const LIVE_BASE_URL = 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';

interface BkashCredentials {
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  is_sandbox?: boolean;
}

/**
 * Grant or renew bKash Tokenized Access Token
 */
export async function grantBkashToken(creds: BkashCredentials): Promise<{
  token?: string;
  error?: string;
}> {
  const baseUrl = creds.is_sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: creds.username,
        password: creds.password,
      },
      body: JSON.stringify({
        app_key: creds.app_key,
        app_secret: creds.app_secret,
      }),
    });

    const data = (await res.json()) as BkashTokenResponse;

    if (data.id_token) {
      return { token: data.id_token };
    }

    return { error: data.statusMessage || 'Failed to authenticate with bKash' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'bKash token request error' };
  }
}

/**
 * Initialize a bKash Tokenized Checkout Payment Session
 */
export async function createBkashPayment(
  creds: BkashCredentials,
  params: {
    amount: number;
    invoiceNumber: string;
    callbackUrl: string;
    payerReference?: string;
  }
): Promise<{
  paymentID?: string;
  bkashURL?: string;
  error?: string;
}> {
  const { token, error: tokenErr } = await grantBkashToken(creds);
  if (!token || tokenErr) {
    return { error: tokenErr || 'Could not get bKash token' };
  }

  const baseUrl = creds.is_sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'X-APP-Key': creds.app_key,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: params.payerReference || params.invoiceNumber,
        callbackURL: params.callbackUrl,
        amount: params.amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: params.invoiceNumber,
      }),
    });

    const data = (await res.json()) as BkashCreateResponse;

    if (data.paymentID && data.bkashURL) {
      return {
        paymentID: data.paymentID,
        bkashURL: data.bkashURL,
      };
    }

    return { error: data.statusMessage || 'Failed to create bKash payment URL' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'bKash create payment failed' };
  }
}

/**
 * Finalize/Execute payment once user completes PIN verification on bKash PGW
 */
export async function executeBkashPayment(
  creds: BkashCredentials,
  paymentID: string
): Promise<{
  success: boolean;
  trxID?: string;
  amount?: number;
  data?: BkashExecuteResponse;
  error?: string;
}> {
  const { token, error: tokenErr } = await grantBkashToken(creds);
  if (!token || tokenErr) {
    return { success: false, error: tokenErr || 'bKash authentication failed' };
  }

  const baseUrl = creds.is_sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'X-APP-Key': creds.app_key,
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = (await res.json()) as BkashExecuteResponse;

    if (data.statusCode === '0000' && (data.transactionStatus === 'Completed' || data.trxID)) {
      return {
        success: true,
        trxID: data.trxID,
        amount: parseFloat(data.amount || '0'),
        data,
      };
    }

    return {
      success: false,
      error: data.statusMessage || `bKash execution failed with status: ${data.statusCode}`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'bKash execute call failed',
    };
  }
}

/**
 * Query payment status directly from bKash
 */
export async function queryBkashPayment(
  creds: BkashCredentials,
  paymentID: string
): Promise<{
  success: boolean;
  trxID?: string;
  transactionStatus?: string;
  error?: string;
}> {
  const { token, error: tokenErr } = await grantBkashToken(creds);
  if (!token || tokenErr) {
    return { success: false, error: tokenErr };
  }

  const baseUrl = creds.is_sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/payment/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'X-APP-Key': creds.app_key,
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = await res.json();
    return {
      success: data.statusCode === '0000',
      trxID: data.trxID,
      transactionStatus: data.transactionStatus,
      error: data.statusMessage,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Query error',
    };
  }
}
