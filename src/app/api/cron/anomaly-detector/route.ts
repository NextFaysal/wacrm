import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { scanAndDetectBusinessAnomalies } from '@/lib/ai/anomaly-detector';

export const maxDuration = 120;

export async function GET(request: Request) {
  return handleAnomalyCron(request);
}

export async function POST(request: Request) {
  return handleAnomalyCron(request);
}

async function handleAnomalyCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();

  // Fetch accounts
  const { data: accounts, error } = await db.from('accounts').select('id, name');
  if (error || !accounts) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  const results = {
    accountsProcessed: accounts.length,
    totalAnomaliesDetected: 0,
    details: [] as any[],
  };

  for (const acc of accounts) {
    try {
      const anomalies = await scanAndDetectBusinessAnomalies(acc.id);
      results.totalAnomaliesDetected += anomalies.length;
      results.details.push({
        accountId: acc.id,
        name: acc.name,
        anomaliesCount: anomalies.length,
      });
    } catch (err: any) {
      results.details.push({
        accountId: acc.id,
        name: acc.name,
        error: err.message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
