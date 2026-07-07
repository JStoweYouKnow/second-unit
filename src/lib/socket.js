import { io } from 'socket.io-client'
import { resolveSocketBaseUrl } from './apiBaseUrl.js'

const API_URL = resolveSocketBaseUrl()

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function connectSocket(userId) {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
    s.emit('register', userId)
  }
  return s
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
  }
}
