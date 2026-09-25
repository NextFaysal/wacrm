import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  getSubscribedApps,
  listWabaPhoneNumbers,
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import {
  explainMetaError,
  metaErrorPayload,
  type MetaConnectStep,
  type MetaErrorContext,
} from '@/lib/whatsapp/meta-error-explain'
import {
  appSubscriptionState,
  describeWabaPhoneMismatch,
  isNumericMetaId,
  phoneNumberBelongsToWaba,
} from '@/lib/whatsapp/waba-pairing'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/**
 * Resolve the caller's account_id from their profile.
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// Lazy-initialised service-role client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * Shape every failed Meta call into `{ error, meta }`.
 */
function metaFailure(err: unknown, step: MetaConnectStep, ctx: MetaErrorContext) {
  const explained = explainMetaError(err, step, ctx)
  console.error(`[whatsapp/config] Meta ${step} failed:`, explained.metaMessage, {
    code: explained.code,
    subcode: explained.subcode,
    fbtrace_id: explained.fbtraceId,
  })
  return NextResponse.json(
    { error: explained.summary, meta: metaErrorPayload(explained) },
    { status: explained.httpStatus },
  )
}

/**
 * GET /api/whatsapp/config
 *
 * Returns ALL whatsapp_config rows for the authenticated account.
 * Each row includes connection health (decrypted token + Meta ping).
 *
 * Response shape:
 *   { configs: Array<{ id, phone_number_id, waba_id, status, label,
 *                       is_primary, connected, phone_info?, waba_subscription?,
 *                       reason?, message? }> }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_account',
          message: 'Your profile is not linked to an account.',
          configs: [],
        },
        { status: 200 },
      )
    }

    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, phone_number_id, waba_id, access_token, status, label, is_primary, registered_at, subscribed_apps_at, last_registration_error, mirror_inbound_media, connected_at')
      .eq('account_id', accountId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (configError) {
      console.error('Error fetching whatsapp_config:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration', configs: [] },
        { status: 200 }
      )
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: 'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
          configs: [],
        },
        { status: 200 }
      )
    }

    // For backward compatibility, also return legacy single-config fields
    // from the primary (or first) config row.
    const primaryConfig = configs.find(c => c.is_primary) ?? configs[0]

    // Verify the primary config with Meta for the top-level connected status
    let topLevelConnected = false
    let topLevelPhoneInfo = null
    let topLevelWabaSubscription = null
    let topLevelReason: string | null = null
    let topLevelMessage: string | null = null

    let primaryAccessToken: string | null = null
    try {
      primaryAccessToken = decrypt(primaryConfig.access_token)
    } catch {
      topLevelConnected = false
      topLevelReason = 'token_corrupted'
      topLevelMessage = 'The stored access token cannot be decrypted.'
    }

    if (primaryAccessToken) {
      try {
        topLevelPhoneInfo = await verifyPhoneNumber({
          phoneNumberId: primaryConfig.phone_number_id,
          accessToken: primaryAccessToken,
        })
        topLevelConnected = true

        if (primaryConfig.waba_id) {
          try {
            const subs = await getSubscribedApps({ wabaId: primaryConfig.waba_id, accessToken: primaryAccessToken })
            const state = appSubscriptionState(subs, process.env.META_APP_ID)
            topLevelWabaSubscription = {
              checked: true,
              subscribed: state.subscribed,
              app_id_match: state.appIdMatch,
            }
          } catch (err) {
            const explained = explainMetaError(err, 'subscribed_apps', { wabaId: primaryConfig.waba_id })
            topLevelWabaSubscription = {
              checked: true,
              subscribed: null,
              app_id_match: null,
              error: explained.summary,
            }
          }
        }
      } catch (err) {
        const explained = explainMetaError(err, 'verify_number', {
          phoneNumberId: primaryConfig.phone_number_id,
          wabaId: primaryConfig.waba_id,
        })
        topLevelConnected = false
        topLevelReason = 'meta_api_error'
        topLevelMessage = explained.summary
      }
    }

    // Return both: legacy single-config format (for backward compat with
    // existing UI code that expects `connected`) AND the full multi-config list.
    return NextResponse.json({
      // Legacy top-level fields (for the primary/first number)
      connected: topLevelConnected,
      phone_info: topLevelPhoneInfo,
      waba_subscription: topLevelWabaSubscription,
      ...(topLevelReason ? { reason: topLevelReason, message: topLevelMessage } : {}),
      // New: all configs for this account
      configs: configs.map(c => ({
        id: c.id,
        phone_number_id: c.phone_number_id,
        waba_id: c.waba_id,
        status: c.status,
        label: c.label,
        is_primary: c.is_primary,
        registered_at: c.registered_at,
        subscribed_apps_at: c.subscribed_apps_at,
        last_registration_error: c.last_registration_error,
        mirror_inbound_media: c.mirror_inbound_media,
        connected_at: c.connected_at,
      })),
    })
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error', configs: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Adds or updates a WhatsApp config for the authenticated account.
 * If `id` is provided in the body, it updates that specific row.
 * Otherwise it creates a new row (adding a new phone number).
 *
 * Body:
 *   { phone_number_id, waba_id?, access_token, verify_token?, pin?,
 *     label?, is_primary?, id? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { phone_number_id, waba_id, access_token, verify_token, pin, label, is_primary, id: configId } = body

    if (!access_token || !phone_number_id) {
      return NextResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      )
    }

    // Meta ids are decimal digit strings.
    if (!isNumericMetaId(phone_number_id)) {
      return NextResponse.json(
        {
          error:
            'Phone Number ID must contain only digits — it is the numeric id shown under Meta → WhatsApp → API Setup, not the phone number itself.',
          field: 'phone_number_id',
        },
        { status: 400 }
      )
    }
    if (waba_id !== undefined && waba_id !== null && waba_id !== '' && !isNumericMetaId(waba_id)) {
      return NextResponse.json(
        {
          error:
            'WhatsApp Business Account ID must contain only digits — copy it from Meta → WhatsApp → API Setup.',
          field: 'waba_id',
        },
        { status: 400 }
      )
    }
    const metaCtx: MetaErrorContext = { phoneNumberId: phone_number_id, wabaId: waba_id || null }

    if (pin !== undefined && pin !== null && pin !== '') {
      if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN must be exactly 6 digits.' },
          { status: 400 }
        )
      }
    }

    // Reject if another account has already claimed this phone_number_id.
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('account_id, id')
      .eq('phone_number_id', phone_number_id)
      .neq('account_id', accountId)
      .maybeSingle()

    if (claimedError) {
      console.error('Error checking phone_number_id ownership:', claimedError)
      return NextResponse.json(
        { error: 'Failed to validate configuration' },
        { status: 500 }
      )
    }

    if (claimed) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected to one wacrm user.',
        },
        { status: 409 }
      )
    }

    // Verify credentials with Meta BEFORE saving
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: access_token,
      })
    } catch (err) {
      return metaFailure(err, 'verify_number', metaCtx)
    }

    if (waba_id) {
      let wabaNumbers
      try {
        wabaNumbers = await listWabaPhoneNumbers({
          wabaId: waba_id,
          accessToken: access_token,
        })
      } catch (err) {
        return metaFailure(err, 'waba_phone_numbers', metaCtx)
      }
      if (!phoneNumberBelongsToWaba(wabaNumbers, phone_number_id)) {
        return NextResponse.json(
          {
            error: describeWabaPhoneMismatch(wabaNumbers, phone_number_id, waba_id),
            field: 'waba_id',
            meta: {
              code: null,
              subcode: null,
              fbtrace_id: null,
              step: 'waba_phone_numbers',
              field: 'waba_id',
              message: 'phone_number_id is not listed under waba_id',
            },
          },
          { status: 400 }
        )
      }
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    try {
      encryptedAccessToken = encrypt(access_token)
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('Encryption failed:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
        },
        { status: 500 }
      )
    }

    // Look up the existing row for this account+phone combo OR by explicit id
    const existingQuery = configId
      ? supabase.from('whatsapp_config').select('id, registered_at, phone_number_id').eq('id', configId).eq('account_id', accountId).maybeSingle()
      : supabase.from('whatsapp_config').select('id, registered_at, phone_number_id').eq('account_id', accountId).eq('phone_number_id', phone_number_id).maybeSingle()

    const { data: existing } = await existingQuery

    const sameNumber =
      existing?.phone_number_id === phone_number_id &&
      existing?.registered_at != null

    let registeredAt: string | null = existing?.registered_at ?? null
    let registrationError: string | null = null
    let registrationMeta: ReturnType<typeof metaErrorPayload> | null = null
    let registrationSkipped = false

    const needsRegistration = !sameNumber || (typeof pin === 'string' && pin.length > 0)
    if (needsRegistration) {
      if (!pin) {
        registrationSkipped = true
      } else {
        try {
          await registerPhoneNumber({
            phoneNumberId: phone_number_id,
            accessToken: access_token,
            pin,
          })
          registeredAt = new Date().toISOString()
        } catch (err) {
          const explained = explainMetaError(err, 'register', metaCtx)
          registrationError = explained.summary
          registrationMeta = metaErrorPayload(explained)
          console.error('Phone number /register failed:', explained.metaMessage, registrationMeta)
        }
      }
    }

    let subscribedAppsAt: string | null = null
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: access_token,
        })
        subscribedAppsAt = new Date().toISOString()
      } catch (err) {
        return metaFailure(err, 'subscribe_waba', metaCtx)
      }
    }

    const baseRow = {
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : new Date().toISOString(),
      registered_at: registrationError ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      last_registration_error: registrationError,
      updated_at: new Date().toISOString(),
      ...(label !== undefined ? { label: label || null } : {}),
    }

    if (existing) {
      // If user is setting this as primary, clear any other primary first
      if (is_primary) {
        await supabase
          .from('whatsapp_config')
          .update({ is_primary: false })
          .eq('account_id', accountId)
          .neq('id', existing.id)
      }

      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update({
          ...baseRow,
          ...(is_primary !== undefined ? { is_primary: Boolean(is_primary) } : {}),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating whatsapp_config:', updateError)
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        )
      }
    } else {
      // New number being added.
      // Check if this account already has any configs — if not, auto-set as primary.
      const { count } = await supabase
        .from('whatsapp_config')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)

      const shouldBePrimary = is_primary !== undefined ? Boolean(is_primary) : (count === 0)

      // If this is to be primary, clear existing primary first
      if (shouldBePrimary) {
        await supabase
          .from('whatsapp_config')
          .update({ is_primary: false })
          .eq('account_id', accountId)
      }

      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({
          account_id: accountId,
          user_id: user.id,
          is_primary: shouldBePrimary,
          ...baseRow,
        })

      if (insertError) {
        console.error('Error inserting whatsapp_config:', insertError)
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        )
      }
    }

    if (registrationError) {
      return NextResponse.json({
        success: false,
        saved: true,
        registered: false,
        registration_error: registrationError,
        error: registrationError,
        meta: registrationMeta,
        phone_info: phoneInfo,
      })
    }

    return NextResponse.json({
      success: true,
      saved: true,
      registered: registeredAt != null,
      registration_skipped: registrationSkipped,
      phone_info: phoneInfo,
    })
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removes a specific WhatsApp config row.
 * Body: { id: string } — the specific config row to delete.
 * If no id is provided, removes ALL configs for the account
 * (full reset — backward-compatible behavior for "Reset Configuration").
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    // Try to parse body — optional, so swallow parse errors.
    let configId: string | null = null
    try {
      const body = await request.json()
      configId = body?.id ?? null
    } catch {
      // No body or non-JSON body — treat as full account reset.
    }

    if (configId) {
      // Delete a specific number
      const { error: deleteError } = await supabase
        .from('whatsapp_config')
        .delete()
        .eq('id', configId)
        .eq('account_id', accountId) // RLS belt-and-suspenders

      if (deleteError) {
        console.error('Error deleting whatsapp_config row:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete configuration' },
          { status: 500 }
        )
      }

      // If the deleted row was primary, promote the oldest remaining row.
      const { data: remaining } = await supabase
        .from('whatsapp_config')
        .select('id, is_primary')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (remaining && remaining.length > 0 && !remaining[0].is_primary) {
        await supabase
          .from('whatsapp_config')
          .update({ is_primary: true })
          .eq('id', remaining[0].id)
      }
    } else {
      // Full reset — delete all configs for the account
      const { error: deleteError } = await supabase
        .from('whatsapp_config')
        .delete()
        .eq('account_id', accountId)

      if (deleteError) {
        console.error('Error deleting whatsapp_config:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete configuration' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/whatsapp/config
 *
 * Lightweight update for fields that don't need Meta re-validation:
 *   - label (rename a number)
 *   - is_primary (set as default number)
 *   - mirror_inbound_media (toggle media mirroring)
 *
 * Body: { id: string, label?: string, is_primary?: boolean, mirror_inbound_media?: boolean }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { id: configId, label, is_primary, mirror_inbound_media } = body

    if (!configId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (label !== undefined) patch.label = label || null
    if (mirror_inbound_media !== undefined) patch.mirror_inbound_media = Boolean(mirror_inbound_media)

    if (is_primary === true) {
      // Clear existing primary first
      await supabase
        .from('whatsapp_config')
        .update({ is_primary: false })
        .eq('account_id', accountId)
      patch.is_primary = true
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update(patch)
      .eq('id', configId)
      .eq('account_id', accountId)

    if (updateError) {
      console.error('Error patching whatsapp_config:', updateError)
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
