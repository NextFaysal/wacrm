import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'Delivery area name is required' }, { status: 400 });
    }

    const charge = Math.max(0, Number(body.charge) || 0);
    const isFree = Boolean(body.is_free) || charge === 0;

    const { data: newZone, error } = await supabase
      .from('delivery_zones')
      .insert({
        account_id: accountId,
        name: body.name.trim(),
        code: body.code?.trim() || null,
        charge: isFree ? 0 : charge,
        is_free: isFree,
        estimated_time: body.estimated_time?.trim() || '24 - 48 Hours',
        sort_order: Number(body.sort_order) || 0,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[delivery-zones] insert error:', error);
      return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zone: newZone });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating delivery zone';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.id) {
      return NextResponse.json({ error: 'Zone ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.code !== undefined) updates.code = body.code?.trim() || null;
    if (body.charge !== undefined) updates.charge = Math.max(0, Number(body.charge));
    if (body.is_free !== undefined) {
      updates.is_free = Boolean(body.is_free);
      if (body.is_free) updates.charge = 0;
    }
    if (body.estimated_time !== undefined) updates.estimated_time = body.estimated_time?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    const { data: updatedZone, error } = await supabase
      .from('delivery_zones')
      .update(updates)
      .eq('id', body.id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[delivery-zones] update error:', error);
      return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zone: updatedZone });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating delivery zone';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Zone ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[delivery-zones] delete error:', error);
      return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting delivery zone';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
