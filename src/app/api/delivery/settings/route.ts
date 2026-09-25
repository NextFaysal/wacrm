import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Settings payload required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      account_id: accountId,
      updated_at: new Date().toISOString(),
    };

    if (body.free_delivery_global !== undefined) {
      updates.free_delivery_global = Boolean(body.free_delivery_global);
    }
    if (body.free_delivery_min_qty !== undefined) {
      updates.free_delivery_min_qty = Math.max(0, parseInt(body.free_delivery_min_qty, 10) || 0);
    }
    if (body.free_delivery_min_amount !== undefined) {
      updates.free_delivery_min_amount = Math.max(0, Number(body.free_delivery_min_amount) || 0);
    }
    if (body.free_delivery_banner_text !== undefined) {
      updates.free_delivery_banner_text = body.free_delivery_banner_text?.trim() || null;
    }
    if (body.cod_enabled !== undefined) {
      updates.cod_enabled = Boolean(body.cod_enabled);
    }
    if (body.advance_charge_required !== undefined) {
      updates.advance_charge_required = Boolean(body.advance_charge_required);
    }

    const { data: updated, error } = await supabase
      .from('delivery_settings')
      .upsert(updates)
      .select()
      .single();

    if (error) {
      console.error('[delivery-settings] upsert error:', error);
      return NextResponse.json({ error: 'Failed to update delivery settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating delivery settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
