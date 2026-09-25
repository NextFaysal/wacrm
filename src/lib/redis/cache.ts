import { getRedisClient } from './client';

/**
 * Get cached JSON value from Redis.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.warn(`[redis-cache] get error for ${key}:`, err);
    return null;
  }
}

/**
 * Set cached JSON value in Redis with optional TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await client.set(key, serialized);
    }
  } catch (err) {
    console.warn(`[redis-cache] set error for ${key}:`, err);
  }
}

/**
 * Delete key from Redis cache.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (err) {
    console.warn(`[redis-cache] del error for ${key}:`, err);
  }
}

/**
 * Acquire a distributed Redis lock (used to prevent concurrent AI replies to the same conversation).
 * Returns true if lock was acquired, false if another worker is currently processing this conversation.
 */
export async function acquireLock(lockKey: string, ttlMs = 15000): Promise<boolean> {
  try {
    const client = getRedisClient();
    // 'NX': Set only if key does not exist; 'PX': Expiry time in milliseconds
    const result = await client.set(`lock:${lockKey}`, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch {
    return true; // Fallback to allow progress if Redis has issues
  }
}

/**
 * Release a previously acquired distributed lock.
 */
export async function releaseLock(lockKey: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(`lock:${lockKey}`);
  } catch (err) {
    console.warn(`[redis-cache] releaseLock error:`, err);
  }
}

/**
 * Buffers a customer message into Redis for debouncing.
 * If customer sends 3 messages in rapid succession (e.g., within 2-3 seconds),
 * they are gathered into this list and processed as a single conversational turn.
 */
export async function bufferInboundMessage(
  conversationId: string,
  messageText: string
): Promise<number> {
  try {
    const client = getRedisClient();
    const key = `debounce:${conversationId}`;
    const count = await client.rpush(key, messageText);
    await client.expire(key, 30); // 30s TTL safety
    return count;
  } catch {
    return 1;
  }
}

/**
 * Fetches and flushes all buffered messages for a conversation.
 */
export async function flushBufferedInboundMessages(conversationId: string): Promise<string[]> {
  try {
    const client = getRedisClient();
    const key = `debounce:${conversationId}`;
    const messages = await client.lrange(key, 0, -1);
    await client.del(key);
    return messages;
  } catch {
    return [];
  }
}
