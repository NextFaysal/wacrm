import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export interface PurchaseOrderItem {
  product_id: string;
  product_name: string;
  variant_id?: string | null;
  variant_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

/**
 * GET /api/purchase-orders
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');

    let query = supabase
      .from('purchase_orders')
      .select('*, suppliers(id, name, company_name, phone)')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: purchaseOrders, error } = await query;

    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('[purchase-orders] fetch error:', error);
      }
      return NextResponse.json({ purchaseOrders: [] });
    }

    return NextResponse.json({ success: true, purchaseOrders: purchaseOrders || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/purchase-orders
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const items: PurchaseOrderItem[] = body.items.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name || 'Product',
      variant_id: item.variant_id || null,
      variant_name: item.variant_name || null,
      sku: item.sku || null,
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_cost: Math.max(0, Number(item.unit_cost) || 0),
      total_cost: Math.max(0, Number(item.quantity || 1) * Number(item.unit_cost || 0)),
    }));

    const subtotal = items.reduce((acc, it) => acc + it.total_cost, 0);
    const shippingCost = Number(body.shipping_cost) || 0;
    const tax = Number(body.tax) || 0;
    const totalAmount = subtotal + shippingCost + tax;
    const paidAmount = Number(body.paid_amount) || 0;

    let paymentStatus = 'unpaid';
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partially_paid';
    }

    // Auto-generate PO number if not provided
    const poNumber = body.po_number?.trim() || `PO-${Date.now().toString().slice(-6)}`;

    const { data: po, error } = await supabase
      .from('purchase_orders')
      .insert({
        account_id: accountId,
        supplier_id: body.supplier_id || null,
        po_number: poNumber,
        status: body.status || 'draft',
        items,
        subtotal,
        shipping_cost: shippingCost,
        tax,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        payment_status: paymentStatus,
        expected_delivery_date: body.expected_delivery_date || null,
        notes: body.notes?.trim() || null,
      })
      .select('*, suppliers(id, name, company_name, phone)')
      .single();

    if (error) {
      console.error('[purchase-orders] insert error:', error);
      return NextResponse.json({ error: error.message || 'Failed to create PO' }, { status: 500 });
    }

    // If created directly with 'received' status, perform stock replenishment
    if (po && body.status === 'received') {
      await processPoReceiving(supabase, accountId, po);
    }

    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PUT /api/purchase-orders
 */
export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    // 1. Fetch current PO state
    const { data: existingPo, error: fetchErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', body.id)
      .single();

    if (fetchErr || !existingPo) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    const wasAlreadyReceived = existingPo.status === 'received';
    const isNowReceiving = body.status === 'received' && !wasAlreadyReceived;

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.supplier_id !== undefined) updates.supplier_id = body.supplier_id;
    if (body.paid_amount !== undefined) {
      updates.paid_amount = Number(body.paid_amount) || 0;
      const total = Number(existingPo.total_amount) || 0;
      if (updates.paid_amount >= total && total > 0) {
        updates.payment_status = 'paid';
      } else if (updates.paid_amount > 0) {
        updates.payment_status = 'partially_paid';
      } else {
        updates.payment_status = 'unpaid';
      }
    }
    if (body.expected_delivery_date !== undefined) updates.expected_delivery_date = body.expected_delivery_date;

    if (isNowReceiving) {
      updates.received_at = new Date().toISOString();
    }

    const { data: updatedPo, error: updateErr } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('account_id', accountId)
      .eq('id', body.id)
      .select('*, suppliers(id, name, company_name, phone)')
      .single();

    if (updateErr) {
      console.error('[purchase-orders] update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update Purchase Order' }, { status: 500 });
    }

    // Process inventory receiving if transitioning to 'received'
    if (isNowReceiving && updatedPo) {
      await processPoReceiving(supabase, accountId, updatedPo);
    }

    return NextResponse.json({ success: true, purchaseOrder: updatedPo });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/purchase-orders?id=<po_id>
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('account_id', accountId)
      .eq('id', id)
      .single();

    if (po && po.status === 'received') {
      return NextResponse.json(
        { error: 'রিসিভ করা পারচেজ অর্ডার ডিলিট করা সম্ভব নয়। এটি স্টক হিসাব প্রভাবিত করে।' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('account_id', accountId)
      .eq('id', id);

    if (error) {
      console.error('[purchase-orders] delete error:', error);
      return NextResponse.json({ error: 'Failed to delete Purchase Order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Helper to process inventory restock when a PO is marked as received
 */
async function processPoReceiving(supabase: any, accountId: string, po: any) {
  const items = Array.isArray(po.items) ? po.items : [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) continue;

    try {
      // 1. Fetch current product
      const { data: product } = await supabase
        .from('products')
        .select('id, stock_quantity, name')
        .eq('account_id', accountId)
        .eq('id', item.product_id)
        .single();

      if (product) {
        const previousStock = Number(product.stock_quantity) || 0;
        const newStock = previousStock + Number(item.quantity);

        // Update product stock
        await supabase
          .from('products')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', accountId)
          .eq('id', item.product_id);

        // Update variant if applicable
        if (item.variant_id) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('id, stock_quantity')
            .eq('id', item.variant_id)
            .single();

          if (variant) {
            const vPrev = Number(variant.stock_quantity) || 0;
            await supabase
              .from('product_variants')
              .update({
                stock_quantity: vPrev + Number(item.quantity),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.variant_id);
          }
        }

        // Record stock audit log
        await supabase
          .from('product_stock_logs')
          .insert({
            account_id: accountId,
            product_id: item.product_id,
            change_qty: Number(item.quantity),
            previous_stock: previousStock,
            new_stock: newStock,
            reason: 'purchase_order',
            reference_id: po.po_number,
            note: `Received from PO #${po.po_number} (${item.variant_name || 'Standard'})`,
            created_by: 'PO Receiving System',
          });
      }
    } catch (itemErr) {
      console.error(`[purchase-orders] error restocking item ${item.product_id}:`, itemErr);
    }
  }

  // Update supplier total orders
  if (po.supplier_id) {
    try {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('total_orders')
        .eq('id', po.supplier_id)
        .single();

      if (supplier) {
        await supabase
          .from('suppliers')
          .update({
            total_orders: (Number(supplier.total_orders) || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', po.supplier_id);
      }
    } catch (suppErr) {
      console.warn('[purchase-orders] update supplier count error:', suppErr);
    }
  }
}
