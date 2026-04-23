import { useState, useEffect, useRef } from 'react'
import { Send, Check, HelpCircle, Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../lib/socket'

export default function Messages() {
  const { allMessages, sendMessage } = useApp()
  const { user } = useAuth()
  const [activeConv, setActiveConv] = useState(allMessages[0]?.id || null)
  const [input, setInput] = useState('')
  const [typingIndicator, setTypingIndicator] = useState({}) // { conversationId: senderName }
  const [socketOk, setSocketOk] = useState(false)
  const chatEndRef = useRef(null)
  const typingTimeout = useRef(null)

  const conversation = allMessages.find(m => m.id === activeConv)

  // Socket.io real-time listeners
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const checkConnection = () => setSocketOk(socket.connected)
    checkConnection()
    socket.on('connect', checkConnection)
    socket.on('disconnect', checkConnection)

    // Receive messages from other users
    socket.on('message:receive', (msg) => {
      if (msg.conversationId) {
        sendMessage(msg.conversationId, msg.text, 'artist')
      }
    })

    // Typing indicators
    socket.on('typing:update', ({ conversationId, senderName, isTyping }) => {
      setTypingIndicator(prev => {
        if (isTyping) return { ...prev, [conversationId]: senderName }
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    })

    // Read receipts
    socket.on('message:read', ({ conversationId }) => {
      // Could update UI to show read status
    })

    return () => {
      socket.off('connect', checkConnection)
      socket.off('disconnect', checkConnection)
      socket.off('message:receive')
      socket.off('typing:update')
      socket.off('message:read')
    }
  }, [sendMessage])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.thread?.length])

  // Mark conversation as read when opened
  useEffect(() => {
    if (!activeConv || !conversation) return
    const socket = getSocket()
    if (socket?.connected && conversation.artistId) {
      socket.emit('message:read', { conversationId: activeConv, recipientId: conversation.artistId })
    }
  }, [activeConv, conversation])

  const handleSend = () => {
    if (!input.trim() || !activeConv) return

    // Send via local state
    sendMessage(activeConv, input.trim())

    // Send via Socket.io for real-time delivery
    const socket = getSocket()
    if (socket?.connected && conversation) {
      socket.emit('message:send', {
        conversationId: activeConv,
        recipientId: conversation.artistId || `artist_${activeConv}`,
        text: input.trim(),
        senderName: user?.user_metadata?.full_name || 'User',
        senderAvatar: 'DU',
      })
      // Stop typing indicator
      socket.emit('typing:stop', { conversationId: activeConv, recipientId: conversation.artistId })
    }

    setInput('')
  }

  const handleTyping = (e) => {
    setInput(e.target.value)

    const socket = getSocket()
    if (!socket?.connected || !conversation) return

    // Send typing start
    socket.emit('typing:start', {
      conversationId: activeConv,
      recipientId: conversation.artistId || `artist_${activeConv}`,
      senderName: user?.user_metadata?.full_name || 'User',
    })

    // Clear previous timeout and set new one to stop typing after 2s
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: activeConv,
        recipientId: conversation.artistId || `artist_${activeConv}`,
      })
    }, 2000)
  }

  return (
    <div className="page-container" style={{ padding: 0, display: 'flex', height: 'calc(100vh)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>💬 Messages</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: socketOk ? 'var(--success)' : 'var(--text-muted)' }}>
            {socketOk ? <Wifi size={12} /> : <WifiOff size={12} />}
            {socketOk ? 'Live' : 'Offline'}
          </div>
        </div>
        <div className="message-list" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {allMessages.map(m => (
            <div key={m.id}
              className={`message-item ${m.id === activeConv ? 'active' : ''} ${m.unread ? 'unread' : ''}`}
              onClick={() => setActiveConv(m.id)}>
              <div className="avatar avatar-sm">{m.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="message-name">{m.artistName}</span>
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
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {conversation ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar avatar-sm">{conversation.avatar}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{conversation.artistName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {typingIndicator[activeConv]
                  ? <span style={{ color: 'var(--accent)' }}>typing...</span>
                  : 'Artist'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-success btn-sm"><Check size={14} /> Accept</button>
              <button className="btn btn-secondary btn-sm"><HelpCircle size={14} /> Ask Question</button>
            </div>
          </div>

          <div className="chat-messages">
            {conversation.thread.map(msg => (
              <div key={msg.id} className={`chat-bubble ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                {msg.text}
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: msg.sender === 'user' ? 'right' : 'left' }}>{msg.time}</div>
              </div>
            ))}
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
