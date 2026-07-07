import webpush from 'web-push'
import { getNotificationPrefs } from './notifications.js'

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@thecallsheet.ai'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

let vapidReady = false

function ensureVapid() {
  if (vapidReady) return true
  const cfg = getVapidConfig()
  if (!cfg) return false
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  vapidReady = true
  return true
}

export function getVapidPublicKey() {
  return getVapidConfig()?.publicKey ?? null
}

export function isPushConfigured() {
  return !!getVapidConfig()
}

export function prefAllowsPush(prefs, type) {
  const merged = { messages: true, projects: true, billing: true, marketing: false, push: false, ...(prefs || {}) }
  if (merged.push !== true) return false
  if (type === 'marketing') return merged.marketing === true
  return true
}

export async function savePushSubscription(db, userId, subscription, userAgent = null) {
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription')
  }

  const row = {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removePushSubscription(db, userId, endpoint) {
  if (!endpoint) {
    const { error } = await db.from('push_subscriptions').delete().eq('user_id', userId)
    if (error) throw error
    return { removed: true }
  }

  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) throw error
  return { removed: true }
}

export async function sendPushToUser(db, userId, { title, body = '', link = null, type = 'system' }) {
  if (!db || !userId || !title || !ensureVapid()) {
    return { sent: 0, skipped: true }
  }

  const prefs = await getNotificationPrefs(db, userId)
  if (!prefAllowsPush(prefs, type)) {
    return { sent: 0, skipped: true }
  }

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('[push] load subscriptions failed:', error.message)
    return { sent: 0, error: error.message }
  }

  if (!subs?.length) return { sent: 0 }

  const payload = JSON.stringify({ title, body, link })
  let sent = 0
  const stale = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      sent += 1
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        stale.push(sub.endpoint)
      } else {
        console.error('[push] send failed:', err.statusCode, err.message)
      }
    }
  }

  if (stale.length) {
    await db.from('push_subscriptions').delete().in('endpoint', stale)
  }

  return { sent }
}
