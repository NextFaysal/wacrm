import Redis, { type RedisOptions } from 'ioredis';

let redisInstance: Redis | null = null;
let isConnected = false;

const REDIS_URL =
  process.env.REDIS_URL ||
  'redis://default:6ojhSMmQeJaZ4fgKgeUob0A7MFMJrrEo@jaunty-impulse-saddle-75209.db.redis.io:16276';

/**
 * Common Redis configuration for BullMQ and general cache.
 * Note: BullMQ strictly requires `maxRetriesPerRequest: null`.
 */
export const redisConfig: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 10000,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

/**
 * Returns a shared singleton Redis client instance.
 */
export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, redisConfig);

    redisInstance.on('connect', () => {
      isConnected = true;
      console.log('[redis] Connected to Redis Cloud successfully.');
    });

    redisInstance.on('ready', () => {
      isConnected = true;
    });

    redisInstance.on('error', (err) => {
      console.warn('[redis] Connection error:', err.message);
      isConnected = false;
    });

    redisInstance.on('close', () => {
      isConnected = false;
    });

    // Initiate non-blocking connection
    redisInstance.connect().catch((err) => {
      console.warn('[redis] Failed initial connect:', err.message);
    });
  }

  return redisInstance;
}

/**
 * Creates an isolated Redis client instance (required by BullMQ Workers & Subscribers).
 */
export function createIsolatedRedisClient(): Redis {
  const client = new Redis(REDIS_URL, redisConfig);
  client.connect().catch((err) => {
    console.warn('[redis-isolated] Connect error:', err.message);
  });
  return client;
}

/**
 * Checks if Redis connection is currently healthy.
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const res = await client.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}
