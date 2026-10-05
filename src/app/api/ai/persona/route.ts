import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account';
import { loadAiPersonaConfig, DEFAULT_PERSONA } from '@/lib/ai/persona-config';

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const persona = await loadAiPersonaConfig(supabase, accountId);
    return NextResponse.json({ persona });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await request.json().catch(() => ({}));

    const updatePayload = {
      account_id: accountId,
      tone: body.tone || DEFAULT_PERSONA.tone,
      response_language: body.response_language || DEFAULT_PERSONA.response_language,
      custom_greeting: body.custom_greeting ?? null,
      custom_sign_off: body.custom_sign_off ?? null,
      max_discount_percent: typeof body.max_discount_percent === 'number' ? body.max_discount_percent : DEFAULT_PERSONA.max_discount_percent,
      negotiation_style: body.negotiation_style || DEFAULT_PERSONA.negotiation_style,
      require_advance_above: body.require_advance_above ?? null,
      min_order_amount: body.min_order_amount ?? null,
      blocked_phrases: Array.isArray(body.blocked_phrases) ? body.blocked_phrases : [],
      custom_rules: body.custom_rules ?? null,
      auto_learn_from_products: body.auto_learn_from_products ?? true,
      auto_learn_from_orders: body.auto_learn_from_orders ?? true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('ai_persona_config')
      .upsert(updatePayload, { onConflict: 'account_id' });

    if (error) {
      console.error('[api/ai/persona] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to update AI Persona' }, { status: 500 });
    }

    return NextResponse.json({ success: true, persona: updatePayload });
  } catch (err) {
    return toErrorResponse(err);
  }
}
