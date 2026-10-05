import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { DEFAULT_AI_ACTION_SETTINGS } from '@/types/ai-actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const { data, error } = await supabase
      .from('ai_action_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[ai-actions] get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        settings: {
          account_id: accountId,
          ...DEFAULT_AI_ACTION_SETTINGS,
        },
      });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();

    const allowedKeys = [
      'auto_order_creation',
      'auto_courier_booking',
      'risk_engine',
      'auto_followup',
      'send_product_images',
      'voice_notes',
      'smart_courier_routing',
      'meta_capi_tracking',
      'vip_loyalty',
      'live_tracking_bot',
      'dynamic_upsell',
    ] as const;

    const updates: Record<string, boolean | string> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = Boolean(body[key]);
      }
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_action_settings')
      .upsert({
        account_id: accountId,
        ...updates,
      }, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) {
      console.error('[ai-actions] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
