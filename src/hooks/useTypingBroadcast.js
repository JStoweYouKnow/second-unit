import { useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Production typing indicators via Supabase Broadcast (no Socket.io required).
 */
export function useTypingBroadcast(conversationId, profileId, senderName) {
  const channelRef = useRef(null)
  const onTypingRef = useRef(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !conversationId || !profileId) return

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.userId === profileId) return
      onTypingRef.current?.(payload.isTyping ? payload.senderName : null)
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [conversationId, profileId])

  const setTypingHandler = useCallback((handler) => {
    onTypingRef.current = handler
  }, [])

  const emitTyping = useCallback(
    (isTyping) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profileId, senderName, isTyping },
      })
    },
    [profileId, senderName]
  )

  return { emitTyping, setTypingHandler }
}
