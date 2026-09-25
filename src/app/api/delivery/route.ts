import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const [{ data: zones, error: zonesErr }, { data: settings, error: setErr }] =
      await Promise.all([
        supabase
          .from('delivery_zones')
          .select('*')
          .eq('account_id', accountId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('delivery_settings')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle(),
      ]);

    if (zonesErr) {
      console.error('[delivery] zones fetch error:', zonesErr);
      return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 });
    }

    // Default settings fallback if none exists yet
    const resolvedSettings = settings || {
      account_id: accountId,
      free_delivery_global: false,
      free_delivery_min_qty: 2,
      free_delivery_min_amount: 0,
      free_delivery_banner_text: '🎁 ধামাকা অফার: ২ বা ততোধিক পিস অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!',
      cod_enabled: true,
      advance_charge_required: false,
    };

    return NextResponse.json({
      success: true,
      zones: zones || [],
      settings: resolvedSettings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching delivery configuration';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
