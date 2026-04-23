import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket'
import { useAuth } from './AuthContext'

const NotificationContext = createContext()

export function useNotifications() {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const socket = connectSocket(user.id)

    socket.on('connect', () => {
      setSocketConnected(true)
      socket.emit('register', user.id)
    })

    socket.on('disconnect', () => setSocketConnected(false))

    // Receive pending unread notifications on connect
    socket.on('notifications:unread', (unread) => {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newOnes = unread.filter(n => !existingIds.has(n.id))
        return [...newOnes, ...prev]
      })
    })

    // Receive new notification in real-time
    socket.on('notification:new', (notification) => {
      setNotifications(prev => [notification, ...prev])
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('notifications:unread')
      socket.off('notification:new')
      disconnectSocket()
    }
  }, [isAuthenticated, user])

  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = useCallback((notificationId) => {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ))
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('notifications:markRead', notificationId)
    }
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('notifications:markAllRead')
    }
  }, [])

  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  // Add a local notification (for client-side events)
  const addLocalNotification = useCallback(({ type, title, body, link, avatar }) => {
    const notification = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type, title, body, link, avatar,
      read: false,
      createdAt: new Date().toISOString(),
    }
    setNotifications(prev => [notification, ...prev])
  }, [])

  const value = {
    notifications,
    unreadCount,
    socketConnected,
    markRead,
    markAllRead,
    clearNotification,
    addLocalNotification,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
