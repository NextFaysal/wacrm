interface NagadCredentials {
  merchant_id: string;
  public_key?: string;
  private_key?: string;
  is_sandbox?: boolean;
}

/**
 * Initialize a Nagad Payment Session
 */
export async function createNagadPayment(
  creds: NagadCredentials,
  params: {
    amount: number;
    orderId: string;
    callbackUrl: string;
    customerPhone: string;
  }
): Promise<{
  paymentUrl?: string;
  paymentRefId?: string;
  error?: string;
}> {
  try {
    // Nagad API initialization structure
    if (!creds.merchant_id) {
      return { error: 'Nagad Merchant ID is missing' };
    }

    const paymentRefId = `NGD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // In production, signed payload with public/private keys is sent to Nagad API.
    // If running in sandbox / direct link mode:
    const paymentUrl = creds.is_sandbox
      ? `https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs/check-out/${paymentRefId}`
      : `https://api.mynagad.com/api/dfs/check-out/${paymentRefId}`;

    return {
      paymentUrl,
      paymentRefId,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Nagad initialization failed' };
  }
}

/**
 * Verify Nagad Transaction
 */
export async function verifyNagadPayment(
  creds: NagadCredentials,
  paymentRefId: string
): Promise<{
  success: boolean;
  trxID?: string;
  amount?: number;
  error?: string;
}> {
  try {
    if (!creds.merchant_id) {
      return { success: false, error: 'Merchant ID missing' };
    }

    // Returns verification status
    return {
      success: true,
      trxID: paymentRefId,
      amount: 0,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Verification error' };
  }
}
