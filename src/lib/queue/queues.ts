import { Queue } from 'bullmq';
import { createIsolatedRedisClient } from '@/lib/redis/client';

export const QUEUE_NAMES = {
  INBOUND: 'whatsapp-inbound',
  AI_AGENT: 'ai-agent',
  OUTBOUND: 'whatsapp-outbound',
  FOLLOWUP: 'delayed-followup',
  COURIER_SYNC: 'courier-sync',
} as const;

// Queue singletons
let inboundQueue: Queue | null = null;
let aiAgentQueue: Queue | null = null;
let outboundQueue: Queue | null = null;
let followupQueue: Queue | null = null;
let courierSyncQueue: Queue | null = null;

export function getInboundQueue(): Queue {
  if (!inboundQueue) {
    inboundQueue = new Queue(QUEUE_NAMES.INBOUND, {
      connection: createIsolatedRedisClient() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return inboundQueue;
}

export function getAiAgentQueue(): Queue {
  if (!aiAgentQueue) {
    aiAgentQueue = new Queue(QUEUE_NAMES.AI_AGENT, {
      connection: createIsolatedRedisClient() as any,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return aiAgentQueue;
}

export function getOutboundQueue(): Queue {
  if (!outboundQueue) {
    outboundQueue = new Queue(QUEUE_NAMES.OUTBOUND, {
      connection: createIsolatedRedisClient() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return outboundQueue;
}

export function getFollowupQueue(): Queue {
  if (!followupQueue) {
    followupQueue = new Queue(QUEUE_NAMES.FOLLOWUP, {
      connection: createIsolatedRedisClient() as any,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return followupQueue;
}

export function getCourierSyncQueue(): Queue {
  if (!courierSyncQueue) {
    courierSyncQueue = new Queue(QUEUE_NAMES.COURIER_SYNC, {
      connection: createIsolatedRedisClient() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return courierSyncQueue;
}

// ----------------------------------------------------
// Enqueue Dispatch Helpers
// ----------------------------------------------------

export interface InboundJobPayload {
  messageId: string;
  senderPhone: string;
  businessPhoneId: string;
  timestamp: string;
  messageType: string;
  text?: string;
  mediaId?: string;
  mimeType?: string;
  referral?: any;
  interactiveData?: any;
  buttonPayload?: string;
  contextMessageId?: string;
}

export async function enqueueInboundWebhook(payload: InboundJobPayload): Promise<string> {
  const queue = getInboundQueue();
  // Group jobs by customer phone to ensure strict sequential processing
  const job = await queue.add('process-inbound', payload, {
    jobId: `in-${payload.messageId}`,
  });
  return job.id || payload.messageId;
}

export interface AiAgentJobPayload {
  accountId: string;
  conversationId: string;
  contactId: string;
  customerPhone: string;
  customerName?: string | null;
  inboundText: string;
  referral?: any;
  messageId: string;
}

export async function enqueueAiAgentExecution(payload: AiAgentJobPayload): Promise<string> {
  const queue = getAiAgentQueue();
  const job = await queue.add('run-ai-agent', payload, {
    jobId: `ai-${payload.conversationId}-${Date.now()}`,
  });
  return job.id || payload.conversationId;
}

export interface OutboundJobPayload {
  accountId: string;
  conversationId: string;
  messageType: 'text' | 'image' | 'interactive';
  contentText?: string;
  mediaUrl?: string;
  caption?: string;
  interactive?: any;
  splitBubbles?: boolean;
}

export async function enqueueOutboundMessage(
  payload: OutboundJobPayload,
  options?: { delayMs?: number }
): Promise<string> {
  const queue = getOutboundQueue();
  const job = await queue.add('send-whatsapp', payload, {
    delay: options?.delayMs || 0,
  });
  return job.id || '';
}

/**
 * Schedule a delayed follow-up check using BullMQ.
 * Automatically keyed by conversationId so an existing pending follow-up is replaced.
 */
export async function scheduleDelayedFollowup(
  conversationId: string,
  delayMs: number,
  payload: { accountId: string; productId?: string; prompt?: string }
): Promise<void> {
  const queue = getFollowupQueue();
  const jobId = `followup-${conversationId}`;

  // Remove any previously scheduled follow-up for this conversation
  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }
  } catch {
    // Ignore error if job doesn't exist
  }

  await queue.add('check-and-send-followup', { conversationId, ...payload }, {
    jobId,
    delay: delayMs,
  });
}

/**
 * Cancel a pending follow-up when the customer replies.
 */
export async function cancelDelayedFollowup(conversationId: string): Promise<boolean> {
  try {
    const queue = getFollowupQueue();
    const jobId = `followup-${conversationId}`;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
  } catch (err) {
    console.warn(`[queue] cancelDelayedFollowup error for ${conversationId}:`, err);
  }
  return false;
}
