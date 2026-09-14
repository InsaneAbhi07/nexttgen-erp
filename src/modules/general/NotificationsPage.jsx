/**
 * Notification centre — frontend-only demo (notifications live in the mock store).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOff, CheckCheck, ExternalLink, Mail, MailOpen, Settings2, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { usePageTitle } from '../../utils/hooks.js'
import { fmtDateTime, timeAgo } from '../../utils/format.js'
import { NOTIFICATION_ICON } from '../../components/layout/NotificationMenu.jsx'
import { ActionMenu, Badge, Button, EmptyState, PageHeader, Pagination, Select, Tabs, useConfirm, useToast } from '../../components/ui/index.js'
import './general.css'

const TYPE_LABEL = {
  stock: 'Stock alerts',
  purchase: 'Purchase',
  sales: 'Sales',
  payment: 'Payments',
  production: 'Production',
  customer: 'Customers',
  invoice: 'Invoices',
  system: 'System',
}
const PAGE_SIZE = 10

export default function NotificationsPage() {
  usePageTitle('Notifications')
  const { state, markNotificationRead, markAllNotificationsRead, removeNotification } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState('all')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)

  const all = state.notifications
  const unread = all.filter((n) => !n.read).length
  const list = useMemo(() => all.filter((n) => (tab === 'all' || !n.read) && (!type || n.type === type)), [all, tab, type])
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const open = (n) => {
    markNotificationRead(n.id)
    if (n.link) navigate(n.link)
  }

  const del = async (n) => {
    const ok = await confirm({ title: 'Delete notification?', message: n.title, confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    removeNotification(n.id)
    toast.success('Notification deleted')
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Stock alerts, approvals, overdue payments and production updates across the business."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Notifications' }]}
        actions={
          <>
            <Button icon={Settings2} to="/profile?tab=notifications">
              Preferences
            </Button>
            <Button
              variant="primary"
              icon={CheckCheck}
              disabled={!unread}
              onClick={() => {
                markAllNotificationsRead()
                toast.success('All notifications marked as read')
              }}
            >
              Mark all as read
            </Button>
          </>
        }
      />

      <div className="card">
        <div className="row-between row-wrap" style={{ padding: '4px 14px 0', borderBottom: '1px solid var(--border)' }}>
          <Tabs
            style={{ borderBottom: 0 }}
            value={tab}
            onChange={(k) => {
              setTab(k)
              setPage(1)
            }}
            tabs={[
              { key: 'all', label: 'All', count: all.length },
              { key: 'unread', label: 'Unread', count: unread },
            ]}
          />
          <Select
            size="sm"
            style={{ width: 170, margin: '6px 0' }}
            placeholder="All types"
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            aria-label="Notification type"
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications'}
            description={tab === 'unread' ? 'You have read everything. New alerts will appear here.' : 'Alerts appear here when stock runs low, orders need approval or payments fall due.'}
            action={tab === 'unread' && <Button size="sm" onClick={() => setTab('all')}>Show all notifications</Button>}
          />
        ) : (
          <div>
            {visible.map((n) => {
              const meta = NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.system
              const Icon = meta.icon
              return (
                <div key={n.id} className={`notif-row ${n.read ? '' : 'unread'}`}>
                  <span className={`activity-icon ${meta.tone}`}>
                    <Icon size={15} />
                  </span>
                  <button type="button" className="notif-row-body" onClick={() => open(n)}>
                    <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="strong" style={{ color: 'var(--ink)' }}>{n.title}</span>
                      <Badge tone="gray">{TYPE_LABEL[n.type] || 'System'}</Badge>
                      {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} aria-label="Unread" />}
                    </span>
                    <span className="small ink-2">{n.message}</span>
                    <span className="tiny muted" title={fmtDateTime(n.at)}>{timeAgo(n.at)}</span>
                  </button>
                  <ActionMenu
                    items={[
                      n.link && { label: 'Open', icon: ExternalLink, onClick: () => open(n) },
                      { label: n.read ? 'Mark as unread' : 'Mark as read', icon: n.read ? Mail : MailOpen, onClick: () => markNotificationRead(n.id, !n.read) },
                      { divider: true },
                      { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(n) },
                    ].filter(Boolean)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {list.length > PAGE_SIZE && (
          <div className="table-footer">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, list.length)} of {list.length}
            </span>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>
    </>
  )
}
