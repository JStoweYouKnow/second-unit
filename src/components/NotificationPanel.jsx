import { useState, useRef, useEffect } from 'react'
import { Bell, MessageSquare, Calendar, CreditCard, Check, CheckCheck, X } from './icons'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

const typeIcons = {
  message: MessageSquare,
  booking: Calendar,
  payment: CreditCard,
}

const typeColors = {
  message: 'var(--accent)',
  booking: 'var(--warning)',
  payment: 'var(--success)',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead, clearNotification } = useNotifications()

  // Close on outside click — defer so we don't steal mousedown from controls below (e.g. Sign Out)
  // before their click event fires.
  useEffect(() => {
    function handlePointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setTimeout(() => setOpen(false), 0)
      }
    }
    if (open) document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleClick = (notif) => {
    markRead(notif.id)
    if (notif.link) navigate(notif.link)
    setOpen(false)
  }

  return (
    <div className="notif-container" ref={panelRef}>
      <button type="button" className="notif-bell" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-expanded={open} aria-haspopup="true" aria-label="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel slide-up">
          <div className="notif-panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={24} style={{ opacity: 0.3 }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(notif => {
                const Icon = typeIcons[notif.type] || Bell
                const color = typeColors[notif.type] || 'var(--text-muted)'
                return (
                  <div
                    key={notif.id}
                    className={`notif-item ${notif.read ? '' : 'unread'}`}
                    onClick={() => handleClick(notif)}
                  >
                    <div className="notif-item-icon" style={{ color, background: `${color}15` }}>
                      <Icon size={16} />
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-title">{notif.title}</div>
                      <div className="notif-item-body">{notif.body}</div>
                      <div className="notif-item-time">{timeAgo(notif.createdAt)}</div>
                    </div>
                    <button className="notif-item-dismiss" onClick={(e) => { e.stopPropagation(); clearNotification(notif.id) }}>
                      <X size={14} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
