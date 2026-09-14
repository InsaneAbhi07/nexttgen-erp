import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Boxes, CheckCheck, Factory, FileText, IndianRupee, Settings2, ShoppingCart, UserPlus, Receipt } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { timeAgo } from '../../utils/format.js'

export const NOTIFICATION_ICON = {
  stock: { icon: Boxes, tone: 'tone-amber' },
  purchase: { icon: ShoppingCart, tone: 'tone-violet' },
  sales: { icon: Receipt, tone: 'tone-blue' },
  payment: { icon: IndianRupee, tone: 'tone-red' },
  production: { icon: Factory, tone: 'tone-brass' },
  customer: { icon: UserPlus, tone: 'tone-teal' },
  invoice: { icon: FileText, tone: 'tone-green' },
  system: { icon: Settings2, tone: 'tone-gray' },
}

export default function NotificationMenu() {
  const { state, markNotificationRead, markAllNotificationsRead } = useErp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = state.notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`}>
        <Bell size={18} />
        {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu notif-pop">
          <div className="row-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="strong">Notifications</div>
              <div className="tiny muted">{unread ? `${unread} unread` : 'You are all caught up'}</div>
            </div>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={markAllNotificationsRead}>
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {state.notifications.slice(0, 7).map((n) => {
              const meta = NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.system
              const Icon = meta.icon
              return (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    markNotificationRead(n.id)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                >
                  <span className={`activity-icon ${meta.tone}`}>
                    <Icon size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong" style={{ color: 'var(--ink)' }}>{n.title}</div>
                    <div className="small muted" style={{ lineHeight: 1.4 }}>{n.message}</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>{timeAgo(n.at)}</div>
                  </div>
                  {!n.read && <span className="unread-dot" />}
                </div>
              )
            })}
            {state.notifications.length === 0 && <div className="empty-state" style={{ padding: 28 }}><div className="empty-title">No notifications</div></div>}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
