import { useState, useEffect, useCallback } from 'react'
import { conversations as conversationsApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'

const MOCK_KEY = 'mock_conversations'

function loadMock() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || '[]')
  } catch {
    return []
  }
}

function saveMock(list) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(list))
  } catch {}
}

export function useConversations(enabled = true) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!enabled) {
      setConversations([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!isSupabaseConfigured) {
        setConversations(loadMock())
        return
      }
      const data = await conversationsApi.list()
      setConversations(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load messages')
      setConversations(isSupabaseConfigured ? [] : loadMock())
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  const startConversation = useCallback(async (artist) => {
    if (!artist?.id) return null

    const existing = conversations.find((c) => String(c.artistId) === String(artist.id))
    if (existing) return existing

    if (!isSupabaseConfigured) {
      const conv = {
        id: `conv-${Date.now()}`,
        artistId: artist.id,
        artistName: artist.name,
        avatar: artist.avatar || artist.name?.slice(0, 2),
        unread: false,
        lastMessage: '',
        time: 'Now',
        thread: [],
      }
      const next = [conv, ...loadMock()]
      saveMock(next)
      setConversations(next)
      return conv
    }

    const created = await conversationsApi.create(artist.id)
    setConversations((prev) => {
      if (prev.some((c) => c.id === created.id)) return prev
      return [created, ...prev]
    })
    return created
  }, [conversations])

  const sendMessage = useCallback(async (conversationId, text, senderOverride) => {
    const trimmed = text?.trim()
    if (!trimmed) return

    const appendLocal = (prev) =>
      prev.map((m) => {
        if (m.id !== conversationId) return m
        const sender = senderOverride || 'user'
        return {
          ...m,
          lastMessage: trimmed,
          time: 'Just now',
          unread: sender === 'artist',
          thread: [
            ...m.thread,
            { id: `local-${Date.now()}`, sender, text: trimmed, time: 'Just now' },
          ],
        }
      })

    setConversations((prev) => appendLocal(prev))

    if (!isSupabaseConfigured) {
      saveMock(appendLocal(loadMock()))
      return
    }

    try {
      const result = await conversationsApi.send(conversationId, trimmed)
      if (result?.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? result.conversation : c))
        )
      }
      return result
    } catch (err) {
      setError(err.message)
      refetch()
    }
  }, [refetch])

  const markRead = useCallback(async (conversationId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread: false } : c))
    )

    if (!isSupabaseConfigured) {
      const next = loadMock().map((c) =>
        c.id === conversationId ? { ...c, unread: false } : c
      )
      saveMock(next)
      return
    }

    try {
      await conversationsApi.markRead(conversationId)
    } catch {
      /* non-fatal */
    }
  }, [])

  const upsertConversation = useCallback((conversation) => {
    if (!conversation?.id) return
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversation.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = conversation
        return next
      }
      return [conversation, ...prev]
    })
  }, [])

  const applyRemoteMessage = useCallback((msgRow, viewerIsArtist) => {
    if (!msgRow?.conversation_id || !msgRow?.id) return

    setConversations((prev) => {
      const conv = prev.find((c) => c.id === msgRow.conversation_id)
      if (!conv) return prev
      if (conv.thread.some((t) => t.id === msgRow.id)) return prev

      const fromEmployer = msgRow.sender_role === 'employer'
      const sender = viewerIsArtist
        ? fromEmployer
          ? 'user'
          : 'artist'
        : fromEmployer
          ? 'user'
          : 'artist'
      const fromSelf = viewerIsArtist
        ? msgRow.sender_role === 'artist'
        : msgRow.sender_role === 'employer'

      const updated = {
        ...conv,
        lastMessage: msgRow.body,
        time: 'Just now',
        unread: fromSelf ? conv.unread : true,
        thread: [
          ...conv.thread,
          {
            id: msgRow.id,
            sender,
            text: msgRow.body,
            time: 'Just now',
            createdAt: msgRow.created_at,
          },
        ],
      }

      return [updated, ...prev.filter((c) => c.id !== conv.id)]
    })
  }, [])

  const applyRemoteConversationUpdate = useCallback((row, viewerIsArtist) => {
    if (!row?.id) return

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== row.id) return c
        const unread = viewerIsArtist
          ? (row.artist_unread ?? 0) > 0
          : (row.employer_unread ?? 0) > 0
        return {
          ...c,
          lastMessage: row.last_message ?? c.lastMessage,
          time: row.last_message_at
            ? new Date(row.last_message_at).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })
            : c.time,
          unread,
        }
      })
    )
  }, [])

  return {
    conversations,
    loading,
    error,
    refetch,
    startConversation,
    sendMessage,
    markRead,
    upsertConversation,
    applyRemoteMessage,
    applyRemoteConversationUpdate,
  }
}
