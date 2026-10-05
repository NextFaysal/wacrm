import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/warranties
 * List warranties for account, optionally filtered by contact_id or search.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const code = searchParams.get('code');
    const search = searchParams.get('search');

    let query = supabase
      .from('warranties')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    if (code) {
      query = query.eq('warranty_code', code);
    }

    if (search) {
      query = query.or(`customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%,warranty_code.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[warranties] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch warranties' }, { status: 500 });
    }

    return NextResponse.json({ warranties: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/warranties
 * Issue a new digital warranty certificate for a customer.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.product_name || !body?.customer_name || !body?.customer_phone) {
      return NextResponse.json(
        { error: 'Product name, customer name, and customer phone are required' },
        { status: 400 }
      );
    }

    const durationMonths = Number(body.duration_months) || 12;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // Generate unique warranty code like WT-2609-4821
    const prefix = now.toISOString().slice(2, 4) + (now.getMonth() + 1).toString().padStart(2, '0');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const warrantyCode = `WT-${prefix}-${randomPart}`;

    const { data, error } = await supabase
      .from('warranties')
      .insert({
        account_id: accountId,
        contact_id: body.contact_id || null,
        warranty_code: warrantyCode,
        product_name: body.product_name.trim(),
        serial_number: body.serial_number?.trim() || `SN-${Date.now().toString().slice(-6)}`,
        customer_name: body.customer_name.trim(),
        customer_phone: body.customer_phone.trim(),
        duration_months: durationMonths,
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        coverage_details: body.coverage_details?.trim() || `${durationMonths} Months Official Warranty & Service Support`,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[warranties] insert error:', error);
      return NextResponse.json({ error: 'Failed to issue warranty certificate' }, { status: 500 });
    }

    return NextResponse.json({ success: true, warranty: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
