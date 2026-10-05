import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { evaluateAndExecuteAdRules } from '@/lib/marketing/ad-rules';

export const maxDuration = 120;

export async function GET(request: Request) {
  return handleAdRulesCron(request);
}

export async function POST(request: Request) {
  return handleAdRulesCron(request);
}

async function handleAdRulesCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();

  // Fetch active accounts with growth or business tier (or any active accounts)
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id, name, plan_tier');

  if (error || !accounts) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  const results = {
    accountsProcessed: accounts.length,
    totalPaused: 0,
    totalScaled: 0,
    totalCapiSynced: 0,
    details: [] as any[],
  };

  for (const acc of accounts) {
    try {
      const execResult = await evaluateAndExecuteAdRules(acc.id);
      results.totalPaused += execResult.pausedCampaigns.length;
      results.totalScaled += execResult.scaledCampaigns.length;
      results.totalCapiSynced += execResult.syncedDeliveriesToCAPI;

      results.details.push({
        accountId: acc.id,
        name: acc.name,
        pausedCount: execResult.pausedCampaigns.length,
        scaledCount: execResult.scaledCampaigns.length,
        capiSynced: execResult.syncedDeliveriesToCAPI,
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
