import { startInboundWorker } from './workers/inbound-worker';
import { startAiWorker } from './workers/ai-worker';
import { startOutboundWorker } from './workers/outbound-worker';
import { startFollowupWorker } from './workers/followup-worker';
import { isRedisHealthy } from '@/lib/redis/client';

let workersInitialized = false;

/**
 * Initializes all BullMQ workers in the background.
 * Idempotent: only boots once per process.
 */
export async function initQueueWorkers(): Promise<{ success: boolean; reason?: string }> {
  if (workersInitialized) {
    return { success: true, reason: 'ALREADY_INITIALIZED' };
  }

  const healthy = await isRedisHealthy();
  if (!healthy) {
    console.warn('[queue-init] Redis is unreachable. Worker initialization skipped.');
    return { success: false, reason: 'REDIS_UNREACHABLE' };
  }

  try {
    startInboundWorker();
    startAiWorker();
    startOutboundWorker();
    startFollowupWorker();

    workersInitialized = true;
    console.log('[queue-init] All BullMQ workers successfully initialized.');
    return { success: true };
  } catch (err) {
    console.error('[queue-init] Failed to initialize queue workers:', err);
    return { success: false, reason: String(err) };
  }
}
