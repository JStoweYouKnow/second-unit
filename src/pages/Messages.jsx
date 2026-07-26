import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Send, Check, CheckCheck, HelpCircle, Wifi, WifiOff, User, Plus, X, Search, ChevronLeft } from '../components/icons'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useArtists } from '../hooks/useData'
import { getSocket } from '../lib/socket'
import { isSupabaseConfigured } from '../lib/supabase'
import { useTypingBroadcast } from '../hooks/useTypingBroadcast'
import { isArtistProfile } from '../lib/roleView'
import { getMessagePrompts } from '../lib/messagePrompts'

const ARTIST_ACCEPT_MESSAGE = /^I've accepted the project "/i
const ARTIST_READY_ACCEPT_MESSAGE = /^I'm ready to accept!/i

function artistHasAcceptedConversation(conversation) {
  if (!conversation?.thread?.length) return false
  return conversation.thread.some(
    (msg) =>
      msg.sender === 'artist' &&
      (ARTIST_ACCEPT_MESSAGE.test(msg.text) || ARTIST_READY_ACCEPT_MESSAGE.test(msg.text))
  )
}

export default function Messages() {
  const { allMessages, sendMessage, startConversation, localProjects, markConversationRead, realtimeConnected } = useApp()
  const { user, profile } = useAuth()
  const { artists } = useArtists()
  const isArtist = isArtistProfile(profile)
  const [showCompose, setShowCompose] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')
  const [composeBusy, setComposeBusy] = useState(false)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [showQuestionMenu, setShowQuestionMenu] = useState(false)

  // Show every thread the user is part of, from either side (hirer or artist).
  // Each conversation carries its own `viewerIsArtist`, so a dual-role user no
  // longer loses hirer-side threads they started.
  const visibleMessages = useMemo(() => allMessages, [allMessages])

  const [activeConv, setActiveConv] = useState(null)
  const [input, setInput] = useState('')
  // On phones the list and thread are separate panes; this toggles which shows.
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)

  const openThread = (id) => {
    setActiveConv(id)
    setMobileThreadOpen(true)
  }

  useEffect(() => {
    if (visibleMessages.length > 0 && (!activeConv || !visibleMessages.find(m => m.id === activeConv))) {
      setActiveConv(visibleMessages[0].id)
    }
  }, [visibleMessages, activeConv])

  const [typingIndicator, setTypingIndicator] = useState({})
  const [socketOk, setSocketOk] = useState(false)
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const questionMenuRef = useRef(null)
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
  // Role of the viewer *for the active thread* (a user can be artist on one and hirer on another).
  const convIsArtist = conversation?.viewerIsArtist ?? isArtist
  const showAcceptButton =
    convIsArtist && conversation && !artistHasAcceptedConversation(conversation)
  const quickQuestions = useMemo(() => getMessagePrompts(convIsArtist), [convIsArtist])

  useEffect(() => {
    setShowQuestionMenu(false)
  }, [activeConv])

  useEffect(() => {
    if (!showQuestionMenu) return
    const onPointerDown = (e) => {
      if (questionMenuRef.current?.contains(e.target)) return
      setShowQuestionMenu(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [showQuestionMenu])

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
    const conv = visibleMessages.find((m) => m.id === activeConv)
    if (!conv?.unread) return
    markConversationRead(activeConv)
  }, [activeConv, visibleMessages, markConversationRead])

  useEffect(() => {
    if (!activeConv) return
    const conv = visibleMessages.find((m) => m.id === activeConv)
    if (!conv) return
    const socket = getSocket()
    if (!socket?.connected) return
    const convIsArtistForThread = conv.viewerIsArtist ?? isArtist
    const recipientId = convIsArtistForThread ? conv.employerId : conv.artistProfileId
    if (recipientId) {
      socket.emit('message:read', { conversationId: activeConv, recipientId })
    }
  }, [activeConv, visibleMessages, isArtist])

  const recipientProfileId = convIsArtist
    ? conversation?.employerId
    : conversation?.artistProfileId

  const handleSend = async () => {
    if (!input.trim() || !activeConv) return

    const senderRole = convIsArtist ? 'artist' : 'user'
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

  const handleAcceptProject = async () => {
    if (!activeConv || !showAcceptButton || acceptBusy) return
    setAcceptBusy(true)
    try {
      const project = localProjects.find((p) => String(p.artistId) === String(conversation.artistId))
      const text = project
        ? `I've accepted the project "${project.title}"! Let's get started.`
        : "I'm ready to accept! Please send over the project details."
      await sendMessage(activeConv, text, 'artist')
    } finally {
      setAcceptBusy(false)
    }
  }

  const handleSelectQuestion = useCallback((text) => {
    setInput(text)
    setShowQuestionMenu(false)
    requestAnimationFrame(() => chatInputRef.current?.focus())
  }, [])

  const liveConnected = realtimeConnected || socketOk

  const handleStartConversation = async (artist) => {
    if (composeBusy) return
    setComposeBusy(true)
    try {
      const id = await startConversation(artist)
      if (id) openThread(id)
      setShowCompose(false)
      setComposeSearch('')
    } finally {
      setComposeBusy(false)
    }
  }

  const composeCandidates = useMemo(() => {
    const q = composeSearch.trim().toLowerCase()
    return artists
      .filter((a) => !q || a.name?.toLowerCase().includes(q) || a.role?.toLowerCase().includes(q))
      .slice(0, 40)
  }, [artists, composeSearch])

  return (
    <div className="page-container messages-page" data-view={mobileThreadOpen ? 'thread' : 'list'}>
      <div className="messages-list-pane">
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Messages</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isArtist && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCompose(true)}>
                <Plus size={14} /> New
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: liveConnected ? 'var(--success)' : 'var(--text-muted)' }}>
              {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {liveConnected ? 'Live' : isSupabaseConfigured ? 'Connecting…' : 'Offline'}
            </div>
          </div>
        </div>
        <div className="message-list" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {visibleMessages.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No messages yet.{!isArtist && ' Tap “New” to start a conversation with an artist.'}
            </div>
          ) : (
            visibleMessages.map(m => (
              <div key={m.id}
                className={`message-item ${m.id === (activeConv || visibleMessages[0]?.id) ? 'active' : ''} ${m.unread ? 'unread' : ''}`}
                onClick={() => openThread(m.id)}>
                <div className="avatar avatar-sm">{m.viewerIsArtist ? <User size={16} /> : m.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="message-name">{m.viewerIsArtist ? 'Client' : m.artistName}</span>
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
        <div className="messages-thread-pane">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn-icon messages-back-btn"
              aria-label="Back to conversations"
              onClick={() => setMobileThreadOpen(false)}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="avatar avatar-sm">{convIsArtist ? <User size={16} /> : conversation.avatar}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{convIsArtist ? 'Client' : conversation.artistName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {typingIndicator[activeConv]
                  ? <span style={{ color: 'var(--accent)' }}>typing...</span>
                  : 'Direct message'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {showAcceptButton && (
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={acceptBusy}
                  onClick={handleAcceptProject}
                >
                  <Check size={14} /> {acceptBusy ? 'Accepting…' : 'Accept'}
                </button>
              )}
              <div ref={questionMenuRef} className="messages-quick-questions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-expanded={showQuestionMenu}
                  aria-haspopup="menu"
                  onClick={() => setShowQuestionMenu((open) => !open)}
                >
                  <HelpCircle size={14} /> Quick questions
                </button>
                {showQuestionMenu && (
                  <div className="messages-quick-questions__menu" role="menu">
                    <div className="messages-quick-questions__heading">
                      {convIsArtist ? 'Ask your client' : 'Ask the artist'}
                    </div>
                    {quickQuestions.map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        role="menuitem"
                        className="messages-quick-questions__item"
                        onClick={() => handleSelectQuestion(prompt.text)}
                      >
                        <span className="messages-quick-questions__label">{prompt.label}</span>
                        <span className="messages-quick-questions__text">{prompt.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {(conversation.thread || []).map(msg => {
              const isMe = convIsArtist ? msg.sender === 'artist' : msg.sender === 'user'
              return (
                <div key={msg.id} className={`chat-bubble ${isMe ? 'sent' : 'received'}`}>
                  {msg.text}
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: isMe ? 'right' : 'left', display: 'flex', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 4 }}>
                    <span>{msg.time}</span>
                    {isMe && (
                      msg.read
                        ? <CheckCheck size={12} aria-label="Read" style={{ opacity: 0.9 }} />
                        : <Check size={12} aria-label="Sent" style={{ opacity: 0.6 }} />
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-bar">
            <input
              ref={chatInputRef}
              value={input}
              onChange={handleTyping}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="btn btn-primary" onClick={handleSend}><Send size={16} /></button>
          </div>
        </div>
      ) : (
        <div className="messages-thread-pane" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select a conversation to start messaging
        </div>
      )}

      {showCompose && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowCompose(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="compose-title">New message</h2>
              <button type="button" className="btn-icon" onClick={() => setShowCompose(false)}><X size={18} /></button>
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Search artists by name or role…"
                value={composeSearch}
                onChange={(e) => setComposeSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {composeCandidates.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No artists found.</div>
              ) : (
                composeCandidates.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="message-item"
                    style={{ textAlign: 'left', width: '100%', opacity: composeBusy ? 0.6 : 1 }}
                    disabled={composeBusy}
                    onClick={() => handleStartConversation(a)}
                  >
                    <div className="avatar avatar-sm">{a.avatar || a.name?.slice(0, 2)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="message-name">{a.name}</div>
                      <div className="message-preview">{a.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
