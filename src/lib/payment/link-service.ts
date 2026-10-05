import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { PaymentLink, PaymentPurpose } from './types';
import { sendMetaConversionsEvent } from '@/lib/meta/conversions-api';
import { sendMetaMessage } from '@/lib/meta/graph-api';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export interface CreatePaymentLinkParams {
  accountId: string;
  orderId?: string | null;
  conversationId?: string | null;
  amount: number;
  currency?: string;
  purpose?: PaymentPurpose;
  customerName?: string | null;
  customerPhone: string;
  baseUrl?: string;
}

export function generatePaymentToken(): string {
  return 'pay_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Creates a unique dynamic payment link in the database
 */
export async function createDynamicPaymentLink(
  params: CreatePaymentLinkParams
): Promise<{
  paymentLink: PaymentLink;
  payUrl: string;
  formattedText: string;
}> {
  const token = generatePaymentToken();
  const currency = params.currency || 'BDT';
  const appBaseUrl =
    params.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://wacrm.live';

  const payUrl = `${appBaseUrl.replace(/\/$/, '')}/pay/${token}`;

  const { data, error } = await supabaseAdmin()
    .from('payment_links')
    .insert({
      account_id: params.accountId,
      order_id: params.orderId || null,
      conversation_id: params.conversationId || null,
      payment_token: token,
      amount: params.amount,
      currency,
      purpose: params.purpose || 'advance_payment',
      customer_name: params.customerName || null,
      customer_phone: params.customerPhone,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create payment link: ${error?.message || 'Unknown error'}`);
  }

  // If orderId is provided, link to orders table
  if (params.orderId) {
    await supabaseAdmin()
      .from('orders')
      .update({ payment_link_id: data.id })
      .eq('id', params.orderId);
  }

  const purposeLabel =
    params.purpose === 'advance_payment'
      ? 'অগ্রিম ডেলিভারি চার্জ / Advance Payment'
      : 'অর্ডার মূল্য পরিশোধ / Order Payment';

  const formattedText = [
    `💳 *পেমেন্ট লিঙ্ক / SECURE PAYMENT LINK*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `সম্মানিত গ্রাহক ${params.customerName || ''},`,
    `আপনার ${purposeLabel} পরিশোধ করতে নিচের লিঙ্কে ক্লিক করুন:`,
    ``,
    `👉 *পেমেন্ট লিঙ্ক:* ${payUrl}`,
    ``,
    `*টাকার পরিমাণ:* ${currency} ${params.amount}`,
    `*পেমেন্ট মাধ্যম:* bKash, Nagad, Card, Rocket`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `পেমেন্ট সম্পন্ন হওয়ার সাথে সাথেই আপনার অর্ডারটি নিশ্চিত হয়ে যাবে। ধন্যবাদ!`,
  ].join('\n');

  return {
    paymentLink: data as PaymentLink,
    payUrl,
    formattedText,
  };
}

/**
 * Completes a payment link, updates the order & fires CAPI + automated receipt
 */
export async function completePaymentLink(params: {
  paymentToken: string;
  paymentMethod: string;
  trxId: string;
  amount?: number;
  gatewayPaymentId?: string;
  gatewayResponse?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  paymentLink?: PaymentLink;
  orderId?: string | null;
  error?: string;
}> {
  // 1. Fetch payment link
  const { data: link, error: linkErr } = await supabaseAdmin()
    .from('payment_links')
    .select('*, order:orders(*)')
    .eq('payment_token', params.paymentToken)
    .single();

  if (linkErr || !link) {
    return { success: false, error: 'Payment link not found' };
  }

  if (link.status === 'completed') {
    return { success: true, paymentLink: link as PaymentLink, orderId: link.order_id };
  }

  const paidAmount = params.amount ?? link.amount;

  // 2. Mark payment link completed
  const { data: updatedLink, error: updateErr } = await supabaseAdmin()
    .from('payment_links')
    .update({
      status: 'completed',
      payment_method: params.paymentMethod,
      trx_id: params.trxId,
      gateway_payment_id: params.gatewayPaymentId || null,
      gateway_response: params.gatewayResponse || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id)
    .select('*')
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // 3. Update Order if linked
  if (link.order_id) {
    const currentOrder = link.order;
    const previousAdvance = Number(currentOrder?.advance_paid || 0);
    const newAdvance = previousAdvance + paidAmount;
    const isFullyPaid = currentOrder?.total_amount && newAdvance >= currentOrder.total_amount;

    await supabaseAdmin()
      .from('orders')
      .update({
        advance_paid: newAdvance,
        advance_status: 'paid',
        advance_method: params.paymentMethod,
        advance_trx_id: params.trxId,
        ...(isFullyPaid ? { status: 'paid' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.order_id);

    // 4. Send Confirmation Notification if conversation is present
    const receiptMessage = `✅ *পেমেন্ট সফল হয়েছে!*
━━━━━━━━━━━━━━━━━━━━
সম্মানিত ${link.customer_name || 'গ্রাহক'},
আপনার *${link.currency} ${paidAmount}* টাকা পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।
*Transaction ID (TrxID):* ${params.trxId}
*পেমেন্ট মাধ্যম:* ${params.paymentMethod.toUpperCase()}
${currentOrder?.invoice_no ? `*ইনভয়েস নং:* ${currentOrder.invoice_no}` : ''}
━━━━━━━━━━━━━━━━━━━━
আপনার অর্ডারটি প্যাকেজিং এর কাজ শুরু হচ্ছে। আমাদের সাথে থাকার জন্য ধন্যবাদ!`;

    if (link.conversation_id) {
      try {
        const { data: conv } = await supabaseAdmin()
          .from('conversations')
          .select('id, channel, meta_page_id, meta_psid, contact_id')
          .eq('id', link.conversation_id)
          .single();

        if (conv) {
          if (conv.channel === 'facebook' || conv.channel === 'instagram') {
            const { data: metaConfig } = await supabaseAdmin()
              .from('meta_integrations')
              .select('page_access_token')
              .eq('account_id', link.account_id)
              .single();

            if (metaConfig?.page_access_token && conv.meta_psid) {
              await sendMetaMessage({
                accessToken: metaConfig.page_access_token,
                recipientId: conv.meta_psid,
                messageText: receiptMessage,
              });
            }
          } else {
            // WhatsApp channel
            await sendMessageToConversation(
              supabaseAdmin(),
              link.account_id,
              {
                conversationId: conv.id,
                messageType: 'text',
                contentText: receiptMessage,
              }
            );
          }
        }
      } catch (notifyErr) {
        console.warn('Failed to send auto-receipt message:', notifyErr);
      }
    }

    // 5. Fire Meta CAPI Purchase Server Event
    try {
      await sendMetaConversionsEvent({
        accountId: link.account_id,
        eventName: 'Purchase',
        userData: {
          phone: link.customer_phone,
          firstName: link.customer_name || undefined,
        },
        customData: {
          value: paidAmount,
          currency: link.currency || 'BDT',
          order_id: link.order_id,
        },
      });
    } catch (capiErr) {
      console.warn('CAPI purchase event dispatch error on payment:', capiErr);
    }
  }

  return {
    success: true,
    paymentLink: updatedLink as PaymentLink,
    orderId: link.order_id,
  };
}
