import { Worker, type Job } from 'bullmq';
import { createIsolatedRedisClient } from '@/lib/redis/client';
import { QUEUE_NAMES, scheduleDelayedFollowup, type AiAgentJobPayload } from '../queues';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { executeAiCommerceAgent } from '@/lib/ai/agent/executor';
import { loadAiConfig } from '@/lib/ai/config';

let aiWorkerInstance: Worker | null = null;

export function startAiWorker(): Worker {
  if (aiWorkerInstance) return aiWorkerInstance;

  aiWorkerInstance = new Worker<AiAgentJobPayload>(
    QUEUE_NAMES.AI_AGENT,
    async (job: Job<AiAgentJobPayload>) => {
      const payload = job.data;
      const admin = supabaseAdmin();

      console.log(`[ai-worker] Processing AI job for conv ${payload.conversationId}`);

      const aiConfig = await loadAiConfig(admin, payload.accountId);
      if (!aiConfig || !aiConfig.isActive || !aiConfig.autoReplyEnabled) {
        console.log(`[ai-worker] AI auto-reply disabled for account ${payload.accountId}`);
        return;
      }

      // 1. Run Commerce AI Agent
      const agentResult = await executeAiCommerceAgent({
        db: admin,
        accountId: payload.accountId,
        conversationId: payload.conversationId,
        contactId: payload.contactId,
        configOwnerUserId: 'admin',
        inboundText: payload.inboundText,
        referral: payload.referral,
        config: aiConfig,
      });

      // 2. If product info was sent and customer didn't order yet,
      // schedule an automated BullMQ delayed follow-up in 45 minutes!
      if (agentResult.handled && agentResult.nextState === 'PRODUCT_INFORMATION_SENT') {
        await scheduleDelayedFollowup(
          payload.conversationId,
          45 * 60 * 1000, // 45 minutes delay
          {
            accountId: payload.accountId,
            prompt: 'Customer viewed product details. Ask if they prefer Black or Silver color.',
          }
        );
      }
    },
    {
      connection: createIsolatedRedisClient() as any,
      concurrency: 4, // Max 4 parallel LLM requests to avoid OpenAI rate limits
    }
  );

  aiWorkerInstance.on('completed', (job) => {
    console.log(`[ai-worker] Completed AI job ${job.id}`);
  });

  aiWorkerInstance.on('failed', (job, err) => {
    console.warn(`[ai-worker] AI job ${job?.id} failed:`, err.message);
  });

  return aiWorkerInstance;
}
