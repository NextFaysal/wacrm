import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { SendSmsParams, SendSmsResult, SmsGatewayConfig } from './types';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

/**
 * Normalizes phone number to Bangladeshi format (8801XXXXXXXXX)
 */
export function normalizeBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  if (digits.startsWith('8801') && digits.length === 13) {
    return digits;
  }
  return digits;
}

/**
 * Sends an SMS through the active configured provider for this account
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const db = supabaseAdmin();
  const phone = normalizeBdPhone(params.phone);

  // 1. Fetch active SMS gateway for the account
  const { data: gateway, error } = await db
    .from('sms_gateways')
    .select('*')
    .eq('account_id', params.accountId)
    .eq('is_enabled', true)
    .limit(1)
    .maybeSingle();

  if (error || !gateway || !gateway.api_key) {
    return {
      success: false,
      provider: 'none',
      error: 'No active SMS gateway configured or enabled for this account',
    };
  }

  const { provider, api_key, api_secret, sender_id } = gateway;
  let result: SendSmsResult = { success: false, provider };

  try {
    if (provider === 'greenweb') {
      const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(api_key)}&to=${encodeURIComponent(phone)}&message=${encodeURIComponent(params.message)}`;
      const res = await fetch(url, { method: 'POST' });
      const text = await res.text();
      const success = text.toLowerCase().includes('ok') || !text.toLowerCase().includes('error');
      result = { success, provider, response: text, error: success ? undefined : text };
    } else if (provider === 'bulksmsbd') {
      const res = await fetch('http://bulksmsbd.net/api/smsapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key,
          type: 'text',
          number: phone,
          senderid: sender_id || 'BulkSMS',
          message: params.message,
        }),
      });
      const data = await res.json();
      result = {
        success: data.response_code === 202 || data.success === true,
        provider,
        response: data,
        error: data.error_message || data.msg,
      };
    } else if (provider === 'alphasms') {
      const res = await fetch('https://api.sms.net.bd/sendsms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          api_key,
          msg: params.message,
          to: phone,
          sender_id: sender_id || '',
        }),
      });
      const data = await res.json();
      result = {
        success: data.error === 0,
        provider,
        response: data,
        error: data.msg,
      };
    } else if (provider === 'mimsms') {
      const res = await fetch('https://mimsms.com/smsapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key,
          type: 'text',
          contacts: phone,
          senderid: sender_id || '',
          msg: params.message,
        }),
      });
      const data = await res.json();
      result = {
        success: data.status === 'success' || data.code === 200,
        provider,
        response: data,
        error: data.message,
      };
    } else if (provider === 'twilio' && api_secret) {
      const auth = Buffer.from(`${api_key}:${api_secret}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${api_key}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `+${phone}`,
          From: sender_id || '',
          Body: params.message,
        }),
      });
      const data = await res.json();
      result = {
        success: !data.error_code,
        provider,
        response: data,
        error: data.message,
      };
    } else {
      // Mock / Custom
      result = { success: true, provider, response: 'SMS dispatched successfully' };
    }
  } catch (err) {
    result = {
      success: false,
      provider,
      error: err instanceof Error ? err.message : 'SMS send request failed',
    };
  }

  // 2. Log outbound SMS
  try {
    await db.from('sms_logs').insert({
      account_id: params.accountId,
      order_id: params.orderId || null,
      customer_phone: phone,
      message_text: params.message,
      provider,
      status: result.success ? 'sent' : 'failed',
      response_data: (result.response as Record<string, unknown>) || { error: result.error },
    });
  } catch (logErr) {
    console.warn('[sms-service] Log error:', logErr);
  }

  return result;
}

/**
 * Creates OTP & sends order confirmation verification via SMS & WhatsApp
 */
export async function sendOrderConfirmationOtp(params: {
  accountId: string;
  orderId: string;
  phone: string;
  customerName?: string;
  invoiceNo?: string;
  baseUrl?: string;
}): Promise<{
  success: boolean;
  token: string;
  otp: string;
  confirmUrl: string;
}> {
  const db = supabaseAdmin();
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const token = 'cnf_' + crypto.randomBytes(8).toString('hex');
  const appBaseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://wacrm.live';
  const confirmUrl = `${appBaseUrl.replace(/\/$/, '')}/confirm/${token}`;

  // 1. Save in order_confirmations
  await db.from('order_confirmations').insert({
    account_id: params.accountId,
    order_id: params.orderId,
    customer_phone: params.phone,
    otp_code: otp,
    confirmation_token: token,
    status: 'pending',
  });

  // Update order status to pending_confirmation
  await db
    .from('orders')
    .update({
      confirmation_status: 'pending_otp',
      otp_code: otp,
    })
    .eq('id', params.orderId);

  // 2. Fetch business store name
  const { data: store } = await db
    .from('business_settings')
    .select('store_name')
    .eq('account_id', params.accountId)
    .maybeSingle();

  const storeName = store?.store_name || 'আমাদের শপ';
  const smsText = `${storeName}: আপনার অর্ডারটি (${params.invoiceNo || 'Order'}) নিশ্চিত করতে OTP কোড: ${otp}। অথবা লিঙ্কে ক্লিক করুন: ${confirmUrl}`;

  // 3. Send SMS
  await sendSms({
    accountId: params.accountId,
    phone: params.phone,
    message: smsText,
    orderId: params.orderId,
  });

  return {
    success: true,
    token,
    otp,
    confirmUrl,
  };
}

/**
 * Verifies an OTP or confirmation token and marks order confirmed
 */
export async function verifyOrderConfirmation(params: {
  tokenOrOtp: string;
  orderId?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  error?: string;
}> {
  const db = supabaseAdmin();

  // Find confirmation by token or (otp + orderId)
  let query = db.from('order_confirmations').select('*, order:orders(*)');
  if (params.tokenOrOtp.startsWith('cnf_')) {
    query = query.eq('confirmation_token', params.tokenOrOtp);
  } else if (params.orderId) {
    query = query.eq('order_id', params.orderId).eq('otp_code', params.tokenOrOtp);
  } else {
    query = query.eq('otp_code', params.tokenOrOtp);
  }

  const { data: conf, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error || !conf) {
    return { success: false, error: 'ভুল OTP কোড বা মেয়াদোত্তীর্ণ লিঙ্ক' };
  }

  if (conf.status === 'confirmed') {
    return { success: true, orderId: conf.order_id };
  }

  // Mark confirmed
  await db
    .from('order_confirmations')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', conf.id);

  await db
    .from('orders')
    .update({
      confirmation_status: 'confirmed',
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conf.order_id);

  return { success: true, orderId: conf.order_id };
}
