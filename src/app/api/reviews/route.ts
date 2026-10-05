import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id');

    let query = supabase
      .from('product_reviews')
      .select('*, product:products(id, name, sku, image_url)')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[reviews] get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();

    const {
      product_id,
      customer_name,
      customer_city = 'Dhaka',
      rating = 5,
      review_text,
      image_url = null,
      is_verified_purchase = true,
      is_active = true,
    } = body;

    if (!product_id || !customer_name || !review_text) {
      return NextResponse.json(
        { error: 'product_id, customer_name, and review_text are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        account_id: accountId,
        product_id,
        customer_name: customer_name.trim(),
        customer_city: (customer_city || 'Dhaka').trim(),
        rating: Math.max(1, Math.min(5, Number(rating) || 5)),
        review_text: review_text.trim(),
        image_url: image_url || null,
        is_verified_purchase: Boolean(is_verified_purchase),
        is_active: Boolean(is_active),
      })
      .select('*, product:products(id, name, sku, image_url)')
      .single();

    if (error) {
      console.error('[reviews] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ review: data }, { status: 201 });
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
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    if (updates.rating !== undefined) {
      updates.rating = Math.max(1, Math.min(5, Number(updates.rating)));
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select('*, product:products(id, name, sku, image_url)')
      .single();

    if (error) {
      console.error('[reviews] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ review: data });
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
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[reviews] delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
