import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { loadEmbeddingsKey } from '@/lib/ai/config';
import { loadAiPersonaConfig } from '@/lib/ai/persona-config';
import { triggerAutoLearn } from '@/lib/ai/auto-learn';

export async function POST() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const persona = await loadAiPersonaConfig(supabase, accountId);
    const { key: embeddingsApiKey } = await loadEmbeddingsKey(supabase, accountId);

    const { productCount, ordersLearned } = await triggerAutoLearn(
      supabase,
      accountId,
      { embeddingsApiKey },
      persona
    );

    let message = `${productCount} টি প্রোডাক্ট সফলভাবে AI-তে ইনডেক্স করা হয়েছে!`;
    if (ordersLearned) {
      message += ' এবং সফল অর্ডার প্যাটার্ন থেকে AI শিখে নিয়েছে।';
    }

    return NextResponse.json({
      success: true,
      message,
      productCount,
      ordersLearned,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
