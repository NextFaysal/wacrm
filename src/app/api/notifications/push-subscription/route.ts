import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { VAPID_PUBLIC_KEY } from '@/lib/notifications/web-push'

/**
 * GET /api/notifications/push-subscription
 * Returns the VAPID public key for the browser to create a subscription.
 */
export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY })
}

/**
 * POST /api/notifications/push-subscription
 * Saves or updates a Web Push subscription for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('viewer')
    const body = await request.json().catch(() => null)

    const endpoint = body?.endpoint as string | undefined
    const p256dh = body?.keys?.p256dh as string | undefined
    const auth = body?.keys?.auth as string | undefined
    const userAgent = request.headers.get('user-agent') || ''

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Invalid subscription data: endpoint, p256dh, and auth are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        account_id: accountId,
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      console.error('[push-subscription] Upsert error:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/notifications/push-subscription
 * Removes a Web Push subscription when the user turns off push notifications.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await requireRole('viewer')
    const body = await request.json().catch(() => null)
    const endpoint = body?.endpoint as string | undefined

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) {
      console.error('[push-subscription] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
