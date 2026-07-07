import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { profileApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import { syncPushSubscriptionIfEnabled } from '../lib/pushNotifications'

export default function PushNotificationSync() {
  const { isAuthenticated, profile } = useAuth()

  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return

    let cancelled = false

    profileApi
      .getNotificationPrefs()
      .then((prefs) => {
        if (!cancelled && prefs?.push) {
          syncPushSubscriptionIfEnabled(true)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, profile?.id])

  return null
}
