import { Worker, type Job } from 'bullmq';
import { createIsolatedRedisClient } from '@/lib/redis/client';
import { QUEUE_NAMES, type OutboundJobPayload } from '../queues';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { sendHumanLikeMessages } from '@/lib/ai/human-simulation';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

let outboundWorkerInstance: Worker | null = null;

export function startOutboundWorker(): Worker {
  if (outboundWorkerInstance) return outboundWorkerInstance;

  outboundWorkerInstance = new Worker<OutboundJobPayload>(
    QUEUE_NAMES.OUTBOUND,
    async (job: Job<OutboundJobPayload>) => {
      const payload = job.data;
      const admin = supabaseAdmin();

      console.log(`[outbound-worker] Sending message to conv ${payload.conversationId}`);

      if (payload.splitBubbles && payload.contentText) {
        // Resolve contactId from conversation
        const { data: conv } = await admin
          .from('conversations')
          .select('contact_id')
          .eq('id', payload.conversationId)
          .maybeSingle();

        const contactId = conv?.contact_id || '';

        await sendHumanLikeMessages({
          accountId: payload.accountId,
          userId: 'ai-assistant',
          conversationId: payload.conversationId,
          contactId,
          text: payload.contentText,
        });
      } else {
        await sendMessageToConversation(admin, payload.accountId, {
          conversationId: payload.conversationId,
          messageType: payload.messageType,
          contentText: payload.contentText,
          mediaUrl: payload.mediaUrl,
        });
      }
    },
    {
      connection: createIsolatedRedisClient() as any,
      concurrency: 5,
      limiter: {
        max: 15,
        duration: 1000, // Strict Meta compliance: max 15 requests per second
      },
    }
  );

  outboundWorkerInstance.on('completed', (job) => {
    console.log(`[outbound-worker] Outbound job ${job.id} delivered.`);
  });

  outboundWorkerInstance.on('failed', (job, err) => {
    console.warn(`[outbound-worker] Outbound job ${job?.id} failed:`, err.message);
  });

  return outboundWorkerInstance;
}
