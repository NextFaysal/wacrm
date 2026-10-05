import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET() {
  try {
    const { accountId } = await requireRole('viewer');
    const db = supabaseAdmin();

    const { data, error } = await db
      .from('sms_gateways')
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

    const { provider, is_enabled, api_key, api_secret, sender_id, config } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // If enabling this gateway, optionally disable others to have one primary gateway
    if (is_enabled) {
      await db
        .from('sms_gateways')
        .update({ is_enabled: false })
        .eq('account_id', accountId);
    }

    const { data, error } = await db
      .from('sms_gateways')
      .upsert(
        {
          account_id: accountId,
          provider,
          is_enabled: Boolean(is_enabled),
          api_key: api_key || '',
          api_secret: api_secret || null,
          sender_id: sender_id || null,
          config: config || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id, provider' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gateway: data, message: 'SMS Gateway configured successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
