import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/meta/config - Fetch Meta & Instagram Configuration
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data: config, error } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.warn('[meta-config] fetch error:', error);
      return NextResponse.json({ config: null });
    }

    // Mask access tokens for security
    const maskedConfig = config
      ? {
          ...config,
          page_access_token: config.page_access_token
            ? `${config.page_access_token.slice(0, 10)}...${config.page_access_token.slice(-6)}`
            : null,
          capi_access_token: config.capi_access_token
            ? `${config.capi_access_token.slice(0, 10)}...${config.capi_access_token.slice(-6)}`
            : null,
          has_token: !!config.page_access_token,
          has_capi_token: !!config.capi_access_token,
        }
      : null;

    return NextResponse.json({ success: true, config: maskedConfig });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/meta/config - Update Meta & Instagram Configuration
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Request body required' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('meta_integrations')
      .select('page_access_token, capi_access_token')
      .eq('account_id', accountId)
      .maybeSingle();

    // Only update page_access_token if a new, unmasked token is supplied
    let tokenToSave = existing?.page_access_token || null;
    if (body.page_access_token && !body.page_access_token.includes('...')) {
      tokenToSave = body.page_access_token.trim();
    }

    let capiTokenToSave = existing?.capi_access_token || null;
    if (body.capi_access_token && !body.capi_access_token.includes('...')) {
      capiTokenToSave = body.capi_access_token.trim();
    }

    const updatePayload = {
      account_id: accountId,
      page_id: body.page_id?.trim() || null,
      page_name: body.page_name?.trim() || null,
      page_access_token: tokenToSave,
      instagram_account_id: body.instagram_account_id?.trim() || null,
      instagram_username: body.instagram_username?.trim() || null,
      ad_account_id: body.ad_account_id?.trim() || null,
      pixel_id: body.pixel_id?.trim() || null,
      capi_access_token: capiTokenToSave,
      capi_test_event_code: body.capi_test_event_code?.trim() || null,
      capi_enabled: body.capi_enabled ?? true,
      app_id: body.app_id?.trim() || null,
      app_secret: body.app_secret?.trim() || null,
      verify_token: body.verify_token?.trim() || 'wacrm_meta_verify_token',
      ai_comment_reply_enabled: body.ai_comment_reply_enabled ?? true,
      ai_comment_private_dm_enabled: body.ai_comment_private_dm_enabled ?? true,
      ai_comment_prompt: body.ai_comment_prompt?.trim() || undefined,
      status: tokenToSave ? 'connected' : 'disconnected',
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabase
      .from('meta_integrations')
      .upsert(updatePayload, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      config: {
        ...saved,
        page_access_token: saved.page_access_token
          ? `${saved.page_access_token.slice(0, 10)}...`
          : null,
        has_token: !!saved.page_access_token,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
