import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className="empty-state" style={compact ? { padding: '24px 16px' } : undefined}>
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <div className="empty-title">{title}</div>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  )
}
