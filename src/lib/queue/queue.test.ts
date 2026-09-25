import { describe, it, expect, afterAll } from 'vitest';
import { isRedisHealthy, getRedisClient } from '@/lib/redis/client';
import { cacheSet, cacheGet, cacheDel, acquireLock, releaseLock } from '@/lib/redis/cache';
import { getInboundQueue, scheduleDelayedFollowup, cancelDelayedFollowup } from './queues';

describe('Redis and BullMQ Integration', () => {
  afterAll(async () => {
    try {
      const client = getRedisClient();
      await client.quit();
    } catch {
      // ignore
    }
  });

  it('connects to live Redis Cloud successfully', async () => {
    const healthy = await isRedisHealthy();
    expect(healthy).toBe(true);
  });

  it('performs cacheSet, cacheGet, and cacheDel operations', async () => {
    const testKey = 'test:wacrm:ping';
    const testPayload = { message: 'hello from wacrm', time: Date.now() };

    await cacheSet(testKey, testPayload, 30);
    const retrieved = await cacheGet<{ message: string; time: number }>(testKey);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.message).toBe('hello from wacrm');

    await cacheDel(testKey);
    const afterDel = await cacheGet(testKey);
    expect(afterDel).toBeNull();
  });

  it('manages distributed locks correctly', async () => {
    const lockKey = 'conv-test-lock-1';

    // First acquire should succeed
    const firstAcquire = await acquireLock(lockKey, 5000);
    expect(firstAcquire).toBe(true);

    // Second acquire on the same key while locked should fail
    const secondAcquire = await acquireLock(lockKey, 5000);
    expect(secondAcquire).toBe(false);

    // Release lock
    await releaseLock(lockKey);

    // Third acquire should now succeed
    const thirdAcquire = await acquireLock(lockKey, 5000);
    expect(thirdAcquire).toBe(true);
    await releaseLock(lockKey);
  });

  it('schedules and cancels delayed follow-ups in BullMQ', async () => {
    const testConvId = `conv-unit-test-${Date.now()}`;

    await scheduleDelayedFollowup(testConvId, 60000, {
      accountId: 'test-account',
      prompt: 'Test follow-up prompt',
    });

    const cancelled = await cancelDelayedFollowup(testConvId);
    expect(cancelled).toBe(true);
  });

  it('reads BullMQ queue job counts', async () => {
    const queue = getInboundQueue();
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    expect(typeof counts.waiting).toBe('number');
    expect(typeof counts.active).toBe('number');
  });
});
