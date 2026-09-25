import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { runAbandonedCartRecovery } from '@/lib/ai/agent/abandoned-recovery';

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleRecoveryCron(request);
}

export async function POST(request: Request) {
  return handleRecoveryCron(request);
}

async function handleRecoveryCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();

  // Fetch all accounts
  const { data: accounts, error } = await db.from('accounts').select('id');
  if (error || !accounts) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  const totalResults = {
    accountsProcessed: accounts.length,
    totalProcessed: 0,
    totalRecoveredSent: 0,
    totalSkipped: 0,
  };

  for (const acc of accounts) {
    const res = await runAbandonedCartRecovery(db, acc.id);
    totalResults.totalProcessed += res.processed;
    totalResults.totalRecoveredSent += res.recoveredSent;
    totalResults.totalSkipped += res.skipped;
  }

  return NextResponse.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    ...totalResults,
  });
}
