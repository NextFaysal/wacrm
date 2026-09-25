import { Worker, type Job } from 'bullmq';
import { createIsolatedRedisClient } from '@/lib/redis/client';
import { QUEUE_NAMES, enqueueAiAgentExecution, cancelDelayedFollowup, type InboundJobPayload } from '../queues';
import { acquireLock, releaseLock, bufferInboundMessage, flushBufferedInboundMessages } from '@/lib/redis/cache';
import { supabaseAdmin } from '@/lib/ai/admin-client';

let inboundWorkerInstance: Worker | null = null;

export function startInboundWorker(): Worker {
  if (inboundWorkerInstance) return inboundWorkerInstance;

  inboundWorkerInstance = new Worker<InboundJobPayload>(
    QUEUE_NAMES.INBOUND,
    async (job: Job<InboundJobPayload>) => {
      const payload = job.data;
      const admin = supabaseAdmin();

      // 1. Resolve contact and conversation from phone number
      const { data: contact } = await admin
        .from('contacts')
        .select('id, account_id, phone, name')
        .eq('phone', payload.senderPhone)
        .maybeSingle();

      if (!contact) {
        console.warn(`[inbound-worker] Contact not found for ${payload.senderPhone}`);
        return;
      }

      const { data: conversation } = await admin
        .from('conversations')
        .select('id, status, is_ad_referral')
        .eq('contact_id', contact.id)
        .maybeSingle();

      if (!conversation) {
        console.warn(`[inbound-worker] Conversation not found for contact ${contact.id}`);
        return;
      }

      // 2. Cancel any pending automated follow-up because customer just sent a new message!
      await cancelDelayedFollowup(conversation.id);

      // 3. Acquire Distributed Lock per Conversation (prevents concurrent AI replies)
      const lockKey = `conv:${conversation.id}`;
      const acquired = await acquireLock(lockKey, 10000);
      if (!acquired) {
        console.log(`[inbound-worker] Conversation ${conversation.id} locked, retrying job in 1.5s`);
        throw new Error('CONVERSATION_LOCKED');
      }

      try {
        const rawText = payload.text?.trim() || '';

        // 4. Smart Message Debouncing (combining rapid customer bubbles)
        if (rawText) {
          await bufferInboundMessage(conversation.id, rawText);

          // Give a short 2000ms breathing room for the customer to finish typing subsequent bubbles
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const buffered = await flushBufferedInboundMessages(conversation.id);
          const combinedText = buffered.length > 0 ? buffered.join('\n') : rawText;

          // 5. Enqueue Heavy AI Agent Job
          await enqueueAiAgentExecution({
            accountId: contact.account_id,
            conversationId: conversation.id,
            contactId: contact.id,
            customerPhone: contact.phone,
            customerName: contact.name,
            inboundText: combinedText,
            referral: payload.referral,
            messageId: payload.messageId,
          });
        }
      } finally {
        await releaseLock(lockKey);
      }
    },
    {
      connection: createIsolatedRedisClient() as any,
      concurrency: 5,
    }
  );

  inboundWorkerInstance.on('completed', (job) => {
    console.log(`[inbound-worker] Processed inbound job ${job.id}`);
  });

  inboundWorkerInstance.on('failed', (job, err) => {
    console.warn(`[inbound-worker] Job ${job?.id} failed:`, err.message);
  });

  return inboundWorkerInstance;
}
