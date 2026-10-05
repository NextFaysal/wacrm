import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { generateAiInsights } from '@/lib/analytics/ai-insights';

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const insights = await generateAiInsights(supabase, accountId);
    return NextResponse.json({ insights });
  } catch (err) {
    return toErrorResponse(err);
  }
}
