import { NextResponse } from 'next/server';
import {
  getInboundQueue,
  getAiAgentQueue,
  getOutboundQueue,
  getFollowupQueue,
} from '@/lib/queue/queues';
import { initQueueWorkers } from '@/lib/queue/init';
import { isRedisHealthy } from '@/lib/redis/client';

export async function GET() {
  const redisOk = await isRedisHealthy();

  if (!redisOk) {
    return NextResponse.json(
      {
        status: 'degraded',
        redis: 'offline',
        message: 'Redis is not reachable. System running in fallback synchronous mode.',
      },
      { status: 200 }
    );
  }

  // Ensure workers are booted
  await initQueueWorkers();

  const queues = [
    { name: 'inbound', q: getInboundQueue() },
    { name: 'aiAgent', q: getAiAgentQueue() },
    { name: 'outbound', q: getOutboundQueue() },
    { name: 'followup', q: getFollowupQueue() },
  ];

  const stats: Record<string, any> = {};

  for (const { name, q } of queues) {
    try {
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      stats[name] = counts;
    } catch (e: any) {
      stats[name] = { error: e.message };
    }
  }

  return NextResponse.json({
    status: 'healthy',
    redis: 'connected',
    timestamp: new Date().toISOString(),
    queues: stats,
  });
}

/**
 * POST /api/admin/queues
 * Action handler for queue management (e.g., retrying failed jobs).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'retry-failed') {
      const queues = [getInboundQueue(), getAiAgentQueue(), getOutboundQueue(), getFollowupQueue()];
      for (const q of queues) {
        const failed = await q.getFailed();
        for (const job of failed) {
          await job.retry();
        }
      }
      return NextResponse.json({ success: true, message: 'All failed jobs retried' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
