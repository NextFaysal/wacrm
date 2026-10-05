import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET() {
  try {
    const { accountId } = await requireRole('viewer');

    const { data, error } = await supabaseAdmin()
      .from('payment_gateways')
      .select('*')
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gateways: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const body = await request.json();

    const { gateway, is_enabled, is_sandbox, config, display_name, instructions } = body;

    if (!gateway) {
      return NextResponse.json({ error: 'Gateway type is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from('payment_gateways')
      .upsert(
        {
          account_id: accountId,
          gateway,
          is_enabled: Boolean(is_enabled),
          is_sandbox: Boolean(is_sandbox),
          config: config || {},
          display_name: display_name || null,
          instructions: instructions || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,gateway' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('[payment/gateways] POST upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gateway: data, message: 'Gateway configured successfully' });
  } catch (err) {
    console.error('[payment/gateways] POST catch error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
