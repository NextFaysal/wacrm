import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Fetch payment link with order
    const { data: link, error: linkErr } = await supabaseAdmin()
      .from('payment_links')
      .select('*, order:orders(*)')
      .eq('payment_token', token)
      .single();

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Payment link not found or expired' }, { status: 404 });
    }

    // 2. Fetch business storefront settings
    const { data: store } = await supabaseAdmin()
      .from('business_settings')
      .select('store_name, logo_url, tagline, support_phone, currency_symbol')
      .eq('account_id', link.account_id)
      .single();

    // 3. Fetch active gateways for this account
    const { data: gateways } = await supabaseAdmin()
      .from('payment_gateways')
      .select('gateway, is_enabled, is_sandbox, display_name, instructions, config')
      .eq('account_id', link.account_id)
      .eq('is_enabled', true);

    // Sanitize configs to avoid leaking app_secret or private_keys to public UI
    const sanitizedGateways = (gateways || []).map((gw: Record<string, any>) => {
      const cfg = (gw.config as Record<string, unknown>) || {};
      return {
        gateway: gw.gateway,
        display_name: gw.display_name,
        instructions: gw.instructions,
        is_sandbox: gw.is_sandbox,
        has_pgw: Boolean(cfg.app_key && cfg.username),
        personal_number: cfg.personal_number as string | undefined,
        merchant_number: cfg.merchant_number as string | undefined,
        account_type: cfg.account_type as string | undefined,
      };
    });

    // 4. Fetch customer loyalty rewards if customer phone exists
    let loyalty = null;
    if (link.customer_phone) {
      const { data: loyaltyProfile } = await supabaseAdmin()
        .from('customer_loyalty')
        .select('tier, points_balance, cashback_balance')
        .eq('account_id', link.account_id)
        .eq('customer_phone', link.customer_phone)
        .maybeSingle();

      if (loyaltyProfile) {
        loyalty = loyaltyProfile;
      }
    }

    return NextResponse.json({
      link,
      store: store || {
        store_name: 'WACRM Store',
        tagline: 'Secure Online Payment',
        currency_symbol: '৳',
      },
      gateways: sanitizedGateways,
      loyalty,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
