import { Worker, type Job } from 'bullmq';
import { createIsolatedRedisClient } from '@/lib/redis/client';
import { QUEUE_NAMES, enqueueOutboundMessage } from '../queues';
import { supabaseAdmin } from '@/lib/ai/admin-client';

let followupWorkerInstance: Worker | null = null;

export function startFollowupWorker(): Worker {
  if (followupWorkerInstance) return followupWorkerInstance;

  followupWorkerInstance = new Worker(
    QUEUE_NAMES.FOLLOWUP,
    async (job: Job<{ conversationId: string; accountId: string; prompt?: string }>) => {
      const { conversationId, accountId } = job.data;
      const admin = supabaseAdmin();

      console.log(`[followup-worker] Checking delayed follow-up for conv ${conversationId}`);

      // 1. Fetch conversation details & memory
      const { data: conv } = await admin
        .from('conversations')
        .select(`
          id,
          status,
          is_ad_referral,
          free_window_expires_at,
          ai_followup_count,
          last_customer_message_at,
          memory:conversation_memory(order_id, customer_name)
        `)
        .eq('id', conversationId)
        .maybeSingle();

      if (!conv) return;

      const memory = Array.isArray(conv.memory) ? conv.memory[0] : conv.memory;

      // Safety Gate 1: Customer already ordered -> Cancel!
      if (memory?.order_id) {
        console.log(`[followup-worker] Conv ${conversationId} already placed an order. Follow-up cancelled.`);
        return;
      }

      // Safety Gate 2: Strict Anti-Spam (max 1 follow-up)
      if ((conv.ai_followup_count || 0) >= 1) {
        console.log(`[followup-worker] Conv ${conversationId} reached max follow-up limit (1). Cancelled.`);
        return;
      }

      // Safety Gate 3: Free Window Expiration Check (Cost Optimization)
      const now = new Date();
      if (conv.free_window_expires_at && now > new Date(conv.free_window_expires_at)) {
        console.log(`[followup-worker] Conv ${conversationId} free window expired. Cancelled to protect cost.`);
        return;
      }

      // Safety Gate 4: Customer replied recently (within last 30 mins)
      if (conv.last_customer_message_at) {
        const lastMsgTime = new Date(conv.last_customer_message_at).getTime();
        const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
        if (lastMsgTime > thirtyMinsAgo) {
          console.log(`[followup-worker] Customer replied recently. Follow-up cancelled.`);
          return;
        }
      }

      // All safety gates passed: Send 1 polite Bengali follow-up
      const followUpText =
        `ভাইয়া, ঘড়িটির কালার বা মডেল নিয়ে কোনো প্রশ্ন থাকলে নির্দ্বিধায় জানাতে পারেন! আমাদের কাছে Black ও Silver দুটি কালারই রেডি স্টকে রয়েছে। 😊\n\nআপনি কি অর্ডারটি কনফার্ম করতে চান?`;

      await enqueueOutboundMessage({
        accountId,
        conversationId,
        messageType: 'text',
        contentText: followUpText,
        splitBubbles: false,
      });

      // Increment follow-up count so system NEVER sends another follow-up
      await admin
        .from('conversations')
        .update({
          ai_followup_count: (conv.ai_followup_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      console.log(`[followup-worker] Successfully sent 1 safe follow-up to conv ${conversationId}`);
    },
    {
      connection: createIsolatedRedisClient() as any,
      concurrency: 3,
    }
  );

  followupWorkerInstance.on('completed', (job) => {
    console.log(`[followup-worker] Job ${job.id} completed.`);
  });

  followupWorkerInstance.on('failed', (job, err) => {
    console.warn(`[followup-worker] Job ${job?.id} failed:`, err.message);
  });

  return followupWorkerInstance;
}
