import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { runAccountFollowupQueue } from '@/lib/followup/dispatcher';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const summary = await runAccountFollowupQueue(supabase, accountId);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
