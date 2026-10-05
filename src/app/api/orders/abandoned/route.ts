import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // 'all' | 'recovered' | 'unrecovered'

    let query = supabase
      .from('abandoned_checkouts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (filter === 'unrecovered') {
      query = query.eq('recovered', false);
    } else if (filter === 'recovered') {
      query = query.eq('recovered', true);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      if (error.code === 'PGRST205') {
        // Table not yet created in Supabase
        return NextResponse.json({ abandoned: [] });
      }
      console.error('[orders/abandoned] get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ abandoned: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await req.json();
    const { id, recovered, recovery_order_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Abandoned ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('abandoned_checkouts')
      .update({
        recovered: Boolean(recovered),
        recovery_order_id: recovery_order_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[orders/abandoned] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ abandoned: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('abandoned_checkouts')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[orders/abandoned] delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
