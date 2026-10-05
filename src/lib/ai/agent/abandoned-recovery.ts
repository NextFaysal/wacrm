import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueOutboundMessage } from '@/lib/queue/queues';

export interface RecoveryResult {
  processed: number;
  recoveredSent: number;
  skipped: number;
}

/**
 * Recovers dropped-off / incomplete orders within Meta's active free messaging window.
 * High-volume safeguard: Strict 1-message anti-spam limit, free window verification.
 */
export async function runAbandonedCartRecovery(
  db: SupabaseClient,
  accountId: string
): Promise<RecoveryResult> {
  const result: RecoveryResult = { processed: 0, recoveredSent: 0, skipped: 0 };

  const now = new Date();
  const minIdleTime = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // at least 45 mins idle
  const maxIdleTime = new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(); // within 70 hours (under 72h)

  // Query conversations with purchase intent or collecting info that haven't ordered yet
  const { data: convs, error } = await db
    .from('conversations')
    .select(`
      id,
      account_id,
      status,
      ai_state,
      ai_followup_count,
      free_window_expires_at,
      last_customer_message_at,
      memory:conversation_memory(order_id, customer_name, customer_phone, interested_product_name, followups_disabled)
    `)
    .eq('account_id', accountId)
    .in('ai_state', ['COLLECTING_ORDER_INFORMATION', 'PURCHASE_INTENT', 'PRODUCT_INFORMATION_SENT'])
    .lt('last_customer_message_at', minIdleTime)
    .gt('last_customer_message_at', maxIdleTime)
    .limit(50);

  if (error || !convs || convs.length === 0) {
    return result;
  }

  for (const conv of convs) {
    result.processed++;
    const memory = Array.isArray(conv.memory) ? conv.memory[0] : conv.memory;

    // Safety Gate 1: If order is already placed or customer declined -> skip permanently
    if (
      memory?.order_id ||
      memory?.followups_disabled ||
      conv.ai_state === 'FUTURE_PURCHASE' ||
      conv.ai_state === 'DECLINED'
    ) {
      result.skipped++;
      continue;
    }

    const currentCount = conv.ai_followup_count || 0;

    // Safety Gate 2: Strict Anti-Spam cap of 3 follow-ups max within 72 hours
    if (currentCount >= 3) {
      result.skipped++;
      continue;
    }

    // Safety Gate 3: Free Messaging Window Protection (Must be within 72h Meta window)
    if (conv.free_window_expires_at && now > new Date(conv.free_window_expires_at)) {
      result.skipped++;
      continue;
    }

    // Safety Gate 4: Ensure progressive spacing between the 3 follow-ups
    const lastMsgMs = new Date(conv.last_customer_message_at || 0).getTime();
    const idleHours = (now.getTime() - lastMsgMs) / (1000 * 60 * 60);

    // Follow-up 1: ~2 hours idle (at least 1.5h)
    // Follow-up 2: ~24 hours idle (at least 20h)
    // Follow-up 3: ~48 hours idle (at least 44h)
    if (currentCount === 0 && idleHours < 1.5) {
      result.skipped++;
      continue;
    }
    if (currentCount === 1 && idleHours < 20) {
      result.skipped++;
      continue;
    }
    if (currentCount === 2 && idleHours < 44) {
      result.skipped++;
      continue;
    }

    const customerName = memory?.customer_name ? ` ${memory.customer_name}` : '';
    const productName = memory?.interested_product_name ? ` (${memory.interested_product_name})` : '';

    let recoveryMsg = '';

    if (currentCount === 0) {
      // Follow-up 1: Gentle check-in on color & questions
      recoveryMsg =
        `আসসালামু আলাইকুম${customerName}! 😊\n\n` +
        `আপনি আমাদের${productName} পণ্যটি সম্পর্কে জানতে চেয়েছিলেন। স্টক খুব সীমিত রয়েছে। আপনি কি পছন্দের ভ্যারিয়েন্ট/কালারটি কনফার্ম করতে চান? ডেলিভারি সংক্রান্ত যেকোনো তথ্যের জন্য জানাতে পারেন! ✨`;
    } else if (currentCount === 1) {
      // Follow-up 2: Free Delivery & Bonus Battery incentive (~24h)
      recoveryMsg =
        `আসসালামু আলাইকুম${customerName}! 😊\n\n` +
        `আপনার পছন্দের পণ্যটির${productName} জন্য একটি স্পেশাল অফার রয়েছে—আজ কনফার্ম করলে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি করে দেওয়া যাবে এবং সাথে স্পেশাল গিফট পাবেন! 🎁\n\n` +
        `অর্ডারটি কনফার্ম করতে চাইলে আপনার সম্পূর্ণ ঠিকানা ও মোবাইল নাম্বারটি পাঠিয়ে দিন। সাথে থাকার জন্য ধন্যবাদ! 🛍️`;
    } else {
      // Follow-up 3: Final courtesy check before releasing booking (~48h-60h)
      recoveryMsg =
        `আসসালামু আলাইকুম${customerName}! 😊\n\n` +
        `আপনার পছন্দের পণ্যটির${productName} স্টক প্রায় শেষ পর্যায়ে চলে এসেছে। আমরা কি পার্সেলটি পাঠিয়ে দিব নাকি বুকিংটি বাতিল করে দিব জানাবেন কি? আপনার সুবিধার জন্য ক্যাশ অন ডেলিভারিতে চেক করে নেওয়ার সুযোগ রয়েছে। ভালো থাকবেন! ❤️`;
    }

    try {
      await enqueueOutboundMessage({
        accountId: conv.account_id,
        conversationId: conv.id,
        messageType: 'text',
        contentText: recoveryMsg,
        splitBubbles: true,
      });

      // Increment follow-up count (up to 3 max)
      await db
        .from('conversations')
        .update({
          ai_followup_count: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conv.id);

      result.recoveredSent++;
    } catch (e) {
      console.warn(`[recovery] Failed to enqueue recovery for conv ${conv.id}:`, e);
      result.skipped++;
    }
  }

  return result;
}
