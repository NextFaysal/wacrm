import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/suppliers
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q')?.trim();

    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: suppliers, error } = await query;

    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('[suppliers] fetch error:', error);
      }
      return NextResponse.json({ suppliers: [] });
    }

    return NextResponse.json({ success: true, suppliers: suppliers || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/suppliers
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        account_id: accountId,
        name: body.name.trim(),
        company_name: body.company_name?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[suppliers] insert error:', error);
      return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true, supplier });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PUT /api/suppliers
 */
export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.id || !body?.name?.trim()) {
      return NextResponse.json({ error: 'Supplier ID and name are required' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        name: body.name.trim(),
        company_name: body.company_name?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('[suppliers] update error:', error);
      return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true, supplier });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/suppliers?id=<supplier_id>
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('account_id', accountId)
      .eq('id', id);

    if (error) {
      console.error('[suppliers] delete error:', error);
      return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
