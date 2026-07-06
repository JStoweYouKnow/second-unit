import { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Check, HelpCircle, Wifi, WifiOff, User } from '../components/icons'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../lib/socket'
import { isSupabaseConfigured } from '../lib/supabase'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { useTypingBroadcast } from '../hooks/useTypingBroadcast'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'

export default function Messages() {
  const { allMessages, sendMessage, localProjects, markConversationRead, realtimeConnected } = useApp()
  const { user, profile } = useAuth()
  const { artist: myArtistRecord } = useArtistProfile(profile?.id)
  const isArtist = isArtistProfile(profile)

  const visibleMessages = useMemo(() => {
    if (isArtist) {
      const persona = demoArtistPersona(profile, myArtistRecord)
      return allMessages.filter((m) => m.artistId === persona?.id)
    }
    return allMessages
  }, [allMessages, profile, myArtistRecord, isArtist])

  const [activeConv, setActiveConv] = useState(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    if (visibleMessages.length > 0 && (!activeConv || !visibleMessages.find(m => m.id === activeConv))) {
      setActiveConv(visibleMessages[0].id)
    }
  }, [visibleMessages, activeConv])

  const [typingIndicator, setTypingIndicator] = useState({})
  const [socketOk, setSocketOk] = useState(false)
  const chatEndRef = useRef(null)
  const typingTimeout = useRef(null)
  const senderName = profile?.full_name || user?.user_metadata?.full_name || 'User'

  const { emitTyping, setTypingHandler } = useTypingBroadcast(
    activeConv,
    profile?.id,
    senderName
  )

  useEffect(() => {
    setTypingHandler((name) => {
      if (!activeConv) return
      setTypingIndicator((prev) => {
        if (!name) {
          const next = { ...prev }
          delete next[activeConv]
          return next
        }
        return { ...prev, [activeConv]: name }
      })
    })
  }, [activeConv, setTypingHandler])

  const conversation = visibleMessages.find(m => m.id === activeConv) || visibleMessages[0]

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const checkConnection = () => setSocketOk(socket.connected)
    checkConnection()
    socket.on('connect', checkConnection)
    socket.on('disconnect', checkConnection)

    socket.on('message:receive', (msg) => {
      if (!msg.conversationId) return
      const fromArtist = msg.senderRole === 'artist'
      sendMessage(
        msg.conversationId,
        msg.text,
        fromArtist ? 'artist' : 'user'
      )
    })

    socket.on('typing:update', ({ conversationId, senderName, isTyping }) => {
      setTypingIndicator(prev => {
        if (isTyping) return { ...prev, [conversationId]: senderName }
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    })

    return () => {
      socket.off('connect', checkConnection)
      socket.off('disconnect', checkConnection)
      socket.off('message:receive')
      socket.off('typing:update')
    }
  }, [sendMessage])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.thread?.length])

  useEffect(() => {
    if (!activeConv) return
    markConversationRead(activeConv)
    const socket = getSocket()
    if (socket?.connected && conversation) {
      const recipientId = isArtist ? conversation.employerId : conversation.artistProfileId
      if (recipientId) {
        socket.emit('message:read', { conversationId: activeConv, recipientId })
      }
    }
  }, [activeConv, conversation, isArtist, markConversationRead])

  const recipientProfileId = isArtist
    ? conversation?.employerId
    : conversation?.artistProfileId

  const handleSend = async () => {
    if (!input.trim() || !activeConv) return

    const senderRole = isArtist ? 'artist' : 'user'
    await sendMessage(activeConv, input.trim(), senderRole)

    if (isSupabaseConfigured) {
      emitTyping(false)
    }

    const socket = getSocket()
    if (socket?.connected && conversation && recipientProfileId) {
      socket.emit('message:send', {
        conversationId: activeConv,
        recipientId: recipientProfileId,
        text: input.trim(),
        senderName: profile?.full_name || user?.user_metadata?.full_name || 'User',
        senderRole,
      })
      socket.emit('typing:stop', { conversationId: activeConv, recipientId: recipientProfileId })
    }

    setInput('')
  }

  const handleTyping = (e) => {
    setInput(e.target.value)

    if (isSupabaseConfigured && activeConv) {
      emitTyping(true)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      typingTimeout.current = setTimeout(() => emitTyping(false), 2000)
      return
    }

    const socket = getSocket()
    if (!socket?.connected || !conversation || !recipientProfileId) return

    socket.emit('typing:start', {
      conversationId: activeConv,
      recipientId: recipientProfileId,
      senderName: profile?.full_name || 'User',
    })

    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConv, recipientId: recipientProfileId })
    }, 2000)
  }

  const liveConnected = realtimeConnected || socketOk

  return (
    <div className="page-container" style={{ padding: 0, display: 'flex', height: 'calc(100vh)', overflow: 'hidden' }}>
      <div style={{ width: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Messages</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: liveConnected ? 'var(--success)' : 'var(--text-muted)' }}>
            {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {liveConnected ? 'Live' : isSupabaseConfigured ? 'Connecting…' : 'Offline'}
          </div>
        </div>
        <div className="message-list" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {visibleMessages.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No messages yet. Start a conversation from an artist profile.
            </div>
          ) : (
            visibleMessages.map(m => (
              <div key={m.id}
                className={`message-item ${m.id === (activeConv || visibleMessages[0]?.id) ? 'active' : ''} ${m.unread ? 'unread' : ''}`}
                onClick={() => setActiveConv(m.id)}>
                <div className="avatar avatar-sm">{isArtist ? <User size={16} /> : m.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="message-name">{isArtist ? 'Client' : m.artistName}</span>
                    <span className="message-time">{m.time}</span>
                  </div>
                  <div className="message-preview">
                    {typingIndicator[m.id]
                      ? <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>typing...</span>
                      : m.lastMessage}
                  </div>
                </div>
                {m.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, alignSelf: 'center' }} />}
              </div>
            ))
          )}
        </div>
      </div>

      {conversation ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar avatar-sm">{isArtist ? <User size={16} /> : conversation.avatar}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{isArtist ? 'Client' : conversation.artistName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {typingIndicator[activeConv]
                  ? <span style={{ color: 'var(--accent)' }}>typing...</span>
                  : 'Direct message'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                className="btn btn-success btn-sm"
                onClick={() => {
                  const project = localProjects.find(p => String(p.artistId) === String(conversation.artistId))
                  if (project) {
                    sendMessage(activeConv, `I've accepted the project "${project.title}"! Let's get started.`, isArtist ? 'artist' : 'user')
                  } else {
                    sendMessage(activeConv, "I'm ready to accept! Please send over the project details.", isArtist ? 'artist' : 'user')
                  }
                }}
              >
                <Check size={14} /> Accept
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setInput("I have a question regarding the timeline and deliverables: ")
                  document.querySelector('.chat-input-bar input')?.focus()
                }}
              >
                <HelpCircle size={14} /> Ask Question
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {(conversation.thread || []).map(msg => {
              const isMe = isArtist ? msg.sender === 'artist' : msg.sender === 'user'
              return (
                <div key={msg.id} className={`chat-bubble ${isMe ? 'sent' : 'received'}`}>
                  {msg.text}
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{msg.time}</div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-bar">
            <input value={input} onChange={handleTyping} placeholder="Type a message..."
              onKeyDown={e => e.key === 'Enter' && handleSend()} />
            <button className="btn btn-primary" onClick={handleSend}><Send size={16} /></button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select a conversation to start messaging
        </div>
      )}
    </div>
  )
}
