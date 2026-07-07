import { push as pushApi } from './api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function getPushPublicKey() {
  const res = await fetch('/api/push/vapid-public-key')
  if (!res.ok) throw new Error('Could not load push configuration')
  const data = await res.json()
  if (!data.configured || !data.publicKey) {
    throw new Error('Push notifications are not configured on this server')
  }
  return data.publicKey
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied')
  }

  const registration = await registerServiceWorker()
  if (!registration) throw new Error('Could not register service worker')

  await navigator.serviceWorker.ready

  const publicKey = await getPushPublicKey()
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await pushApi.subscribe(subscription.toJSON())
  return subscription
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return { ok: true }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  const endpoint = subscription?.endpoint ?? null

  if (subscription) {
    await subscription.unsubscribe()
  }

  await pushApi.unsubscribe(endpoint)
  return { ok: true }
}

export async function syncPushSubscriptionIfEnabled(pushEnabled) {
  if (!pushEnabled || !isPushSupported()) return
  if (Notification.permission !== 'granted') return

  try {
    const registration = await registerServiceWorker()
    if (!registration) return
    await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await pushApi.subscribe(existing.toJSON())
      return
    }
    await subscribeToPushNotifications()
  } catch {
    // Non-fatal — user can re-enable from Account settings
  }
}
