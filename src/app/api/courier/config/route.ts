import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/courier/config
 * List all configured couriers for the current account.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data, error } = await supabase
      .from('courier_configs')
      .select('id, provider, is_active, api_key, secret_key, sender_name, sender_phone, metadata, updated_at')
      .eq('account_id', accountId);

    if (error) {
      console.error('[courier/config] fetch error:', error);
      return NextResponse.json({ error: 'Failed to load courier configs' }, { status: 500 });
    }

    // Mask secret keys and passwords for security
    const masked = (data || []).map((c) => {
      const meta = (c.metadata as Record<string, unknown>) || {};
      const safeMeta = { ...meta };
      if (safeMeta.password) {
        safeMeta.password_masked = '••••••';
        delete safeMeta.password;
      }
      return {
        ...c,
        api_key_masked: c.api_key ? `${c.api_key.slice(0, 4)}••••${c.api_key.slice(-4)}` : '',
        secret_key_masked: c.secret_key ? `${c.secret_key.slice(0, 2)}••••` : '',
        metadata: safeMeta,
      };
    });

    return NextResponse.json({ configs: masked });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/courier/config
 * Save or update API credentials for a courier provider (Admin only).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await request.json().catch(() => null);

    const provider = body?.provider;
    const apiKey = body?.api_key?.trim();
    const secretKey = body?.secret_key?.trim() || null;
    const isActive = body?.is_active ?? true;
    const senderName = body?.sender_name?.trim() || null;
    const senderPhone = body?.sender_phone?.trim() || null;
    const incomingMeta = body?.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API Key / Client ID are required' },
        { status: 400 }
      );
    }

    // If existing config has metadata, merge to preserve password/tokens if not resent
    let mergedMetadata = incomingMeta;
    if (incomingMeta) {
      const { data: existing } = await supabase
        .from('courier_configs')
        .select('metadata')
        .eq('account_id', accountId)
        .eq('provider', provider)
        .maybeSingle();

      const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
      mergedMetadata = {
        ...existingMeta,
        ...incomingMeta,
      };
      // If password wasn't provided or was blank, keep existing password
      if (!incomingMeta.password && existingMeta.password) {
        mergedMetadata.password = existingMeta.password;
      }
    }

    const { data, error } = await supabase
      .from('courier_configs')
      .upsert(
        {
          account_id: accountId,
          provider,
          api_key: apiKey,
          secret_key: secretKey,
          is_active: isActive,
          sender_name: senderName,
          sender_phone: senderPhone,
          metadata: mergedMetadata || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,provider' }
      )
      .select()
      .single();

    if (error) {
      console.error('[courier/config] upsert error:', error);
      return NextResponse.json({ error: 'Failed to save courier config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
