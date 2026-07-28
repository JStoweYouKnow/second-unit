import { io } from 'socket.io-client'
import { resolveSocketBaseUrl } from './apiBaseUrl.js'
import { supabase, isSupabaseConfigured } from './supabase.js'

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

/**
 * Connect and authenticate.
 *
 * The server derives the user id from this token — it is never taken from the
 * client — so a session can only ever join its own notification room.
 */
export async function connectSocket() {
  const s = getSocket()
  if (s.connected) return s

  let token = null
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token ?? null
  }

  // Without a token the server will reject the handshake; don't bother dialing.
  if (!token) return s

  // Re-read on every (re)connect so a refreshed access token is used.
  s.auth = { token }
  s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
  }
}
