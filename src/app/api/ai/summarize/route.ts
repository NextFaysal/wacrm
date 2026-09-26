import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { loadAiConfig } from '@/lib/ai/config';
import { buildConversationContext } from '@/lib/ai/context';
import { generateReply } from '@/lib/ai/generate';
import { logAiUsage } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { AiError } from '@/lib/ai/types';

/**
 * POST /api/ai/summarize  (agent+)
 *
 * Body: { conversation_id }
 * Returns: { summary, aiPowered }
 *
 * Generates an executive 3-point briefing of the active customer thread:
 * 1. Customer Intent
 * 2. Order/Deal Status
 * 3. Next Recommended Action
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');

    const userLimit = checkRateLimit(`ai-summarize:${userId}`, RATE_LIMITS.aiDraft);
    if (!userLimit.success) return rateLimitResponse(userLimit);

    const body = await request.json().catch(() => null);
    const conversationId =
      body && typeof body.conversation_id === 'string' ? body.conversation_id : '';
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 },
      );
    }

    // Verify conversation ownership via RLS
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id, status, assigned_agent_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Load recent message context (chronological order)
    const messages = await buildConversationContext(supabase, conversationId);
    if (messages.length === 0) {
      return NextResponse.json({
        summary: 'No messages in this conversation yet to summarize.',
        aiPowered: false,
      });
    }

    // Check if BYO AI provider is configured
    const config = await loadAiConfig(supabase, accountId).catch(() => null);

    if (config) {
      try {
        const systemPrompt = `You are a high-performance CRM conversation analyst.
Analyze the customer conversation turns and generate a crystal-clear, structured 3-part bulleted briefing in markdown:
- 🎯 **Customer Intent**: What the customer requested, asked, or complained about.
- 📦 **Order / Deal Status**: Products, sizes, payment, or delivery discussed (or none).
- ⚡ **Next Action**: Concrete next step for the human sales/support agent.

Keep it direct, professional, and under 80 words. If the customer wrote in Bengali, output in Bengali. Otherwise output in English.`;

        const { text, usage } = await generateReply({ config, systemPrompt, messages });

        // Best effort usage logging
        try {
          void logAiUsage(supabaseAdmin(), {
            accountId,
            conversationId,
            mode: 'draft',
            provider: config.provider,
            model: config.model,
            usage,
          });
        } catch {
          // ignore
        }

        return NextResponse.json({
          summary: text,
          aiPowered: true,
        });
      } catch (err) {
        console.warn('[ai/summarize] AI provider call failed, falling back to heuristic summary:', err);
      }
    }

    // Smart heuristic summary fallback when AI provider is not connected
    const customerMsgs = messages.filter((m) => m.role === 'user');
    const lastCustomerMsg = customerMsgs[customerMsgs.length - 1]?.content || 'None';
    const totalMsgs = messages.length;

    const fallbackSummary = `### Heuristic Summary (${totalMsgs} messages)
- 🎯 **Recent Customer Query**: "${lastCustomerMsg.slice(0, 120)}${lastCustomerMsg.length > 120 ? '...' : ''}"
- 📦 **Conversation Status**: Currently **${conversation.status.toUpperCase()}**
- ⚡ **Next Action**: Review the latest customer message and reply.
*(Connect OpenAI, Gemini, or Anthropic in Settings → AI Assistant for full generative summaries)*`;

    return NextResponse.json({
      summary: fallbackSummary,
      aiPowered: false,
    });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return toErrorResponse(err);
  }
}
