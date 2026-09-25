import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BFudZ8oWqUkMCwXA6nZAYHwgMJu_YZ9gkHUdnXOQryi2jsc5T7Lq61oHikBfuidp3M7y-j7oIpFSXj37qTLfpLk'

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'mFmWuLm5_3s6BECXg3FocDJEhFbapGPGzMZzuUxZxx8'

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@wacrm.local'

// Initialize VAPID details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} catch (err) {
  console.error('[web-push] Failed to set VAPID details:', err)
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: {
    url?: string
    conversationId?: string
    messageId?: string
  }
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Dispatch web push notifications to all subscribed devices for an account
 * (or optionally targeted to a specific assigned user).
 */
export async function sendPushToAccount(
  db: SupabaseClient,
  accountId: string,
  payload: PushNotificationPayload,
  targetUserId?: string | null
): Promise<{ sent: number; failed: number }> {
  try {
    let query = db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('account_id', accountId)

    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }

    const { data: subs, error } = await query
    if (error) {
      console.error('[web-push] Error fetching subscriptions:', error)
      return { sent: 0, failed: 0 }
    }

    if (!subs || subs.length === 0) {
      return { sent: 0, failed: 0 }
    }

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      tag: payload.tag || 'wacrm-msg',
      data: payload.data || { url: '/inbox' },
    })

    let sent = 0
    let failed = 0
    const staleIds: string[] = []

    await Promise.all(
      (subs as PushSubscriptionRow[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            jsonPayload
          )
          sent++
        } catch (err: unknown) {
          failed++
          const statusCode = (err as { statusCode?: number })?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or uninstalled
            staleIds.push(sub.id)
          } else {
            console.error('[web-push] Send error for endpoint:', sub.endpoint, err)
          }
        }
      })
    )

    // Clean up expired subscriptions
    if (staleIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', staleIds)
    }

    return { sent, failed }
  } catch (err) {
    console.error('[web-push] Unexpected error sending push:', err)
    return { sent: 0, failed: 0 }
  }
}
