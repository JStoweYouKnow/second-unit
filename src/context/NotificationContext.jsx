import { useState, useEffect, useCallback, useContext, createContext } from 'react'
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { notifications as notificationsApi } from '../lib/api'

const NotificationContext = createContext()

export function useNotifications() {
  return useContext(NotificationContext)
}

function upsertNotification(list, notification) {
  if (!notification?.id) return list
  if (list.some((n) => n.id === notification.id)) return list
  return [notification, ...list]
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !isSupabaseConfigured) return
    try {
      const data = await notificationsApi.list()
      setNotifications(Array.isArray(data) ? data : [])
    } catch {
      /* non-fatal */
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([])
      return
    }

    if (isSupabaseConfigured) {
      refetch()

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => upsertNotification(prev, payload.new ? {
              id: payload.new.id,
              type: payload.new.type,
              title: payload.new.title,
              body: payload.new.body ?? '',
              link: payload.new.link ?? null,
              avatar: payload.new.avatar ?? null,
              read: !!payload.new.read,
              createdAt: payload.new.created_at,
            } : null))
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new
            if (!row) return
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === row.id
                  ? {
                      ...n,
                      read: !!row.read,
                      title: row.title,
                      body: row.body ?? '',
                    }
                  : n
              )
            )
          }
        )
        .subscribe((status) => {
          setRealtimeConnected(status === 'SUBSCRIBED')
        })

      return () => {
        supabase.removeChannel(channel)
        setRealtimeConnected(false)
      }
    }

    const socket = connectSocket(user.id)
    socket.on('connect', () => {
      setSocketConnected(true)
      socket.emit('register', user.id)
    })
    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('notifications:unread', (unread) => {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id))
        const newOnes = unread.filter((n) => !existingIds.has(n.id))
        return [...newOnes, ...prev]
      })
    })
    socket.on('notification:new', (notification) => {
      setNotifications((prev) => upsertNotification(prev, notification))
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('notifications:unread')
      socket.off('notification:new')
      disconnectSocket()
    }
  }, [isAuthenticated, user?.id, refetch])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = useCallback(async (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )

    if (isSupabaseConfigured) {
      try {
        await notificationsApi.markRead(notificationId)
      } catch {
        refetch()
      }
      return
    }

    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('notifications:markRead', notificationId)
    }
  }, [refetch])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    if (isSupabaseConfigured) {
      try {
        await notificationsApi.markAllRead()
      } catch {
        refetch()
      }
      return
    }

    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('notifications:markAllRead')
    }
  }, [refetch])

  const clearNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }, [])

  const addLocalNotification = useCallback(({ type, title, body, link, avatar }) => {
    const notification = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      body,
      link,
      avatar,
      read: false,
      createdAt: new Date().toISOString(),
    }
    setNotifications((prev) => [notification, ...prev])
  }, [])

  const value = {
    notifications,
    unreadCount,
    socketConnected,
    realtimeConnected,
    markRead,
    markAllRead,
    clearNotification,
    addLocalNotification,
    refetchNotifications: refetch,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
