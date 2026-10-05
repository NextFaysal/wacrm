import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[coupons] get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();

    const {
      code,
      discount_type = 'fixed',
      discount_value = 100,
      min_order_amount = 0,
      max_discount = null,
      usage_limit = 500,
      expires_at = null,
      is_active = true,
    } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Valid coupon code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        account_id: accountId,
        code: cleanCode,
        discount_type,
        discount_value: Number(discount_value),
        min_order_amount: Number(min_order_amount) || 0,
        max_discount: max_discount ? Number(max_discount) : null,
        usage_limit: usage_limit ? Number(usage_limit) : 500,
        expires_at: expires_at || null,
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      console.error('[coupons] insert error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: `Coupon code '${cleanCode}' already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupon: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    if (updates.code) {
      updates.code = updates.code.trim().toUpperCase();
    }
    if (updates.discount_value !== undefined) {
      updates.discount_value = Number(updates.discount_value);
    }
    if (updates.min_order_amount !== undefined) {
      updates.min_order_amount = Number(updates.min_order_amount);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[coupons] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupon: data });
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
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[coupons] delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
