import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

function formatMessageTime(iso) {
  if (!iso) return 'Just now'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Subscribe to Supabase Realtime for messages (production live updates).
 */
export function useMessageRealtime({
  enabled = true,
  profileId,
  isArtist,
  applyRemoteMessage,
  applyRemoteConversationUpdate,
  refetch,
}) {
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !supabase || !profileId) {
      setRealtimeConnected(false)
      return
    }

    const channel = supabase
      .channel(`messages:${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          applyRemoteMessage?.(payload.new, isArtist)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          applyRemoteConversationUpdate?.(payload.new, isArtist)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          refetch?.()
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [
    enabled,
    profileId,
    isArtist,
    applyRemoteMessage,
    applyRemoteConversationUpdate,
    refetch,
  ])

  return { realtimeConnected }
}

export { formatMessageTime }
