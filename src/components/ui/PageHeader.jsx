import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * PageHeader with breadcrumbs.
 * breadcrumbs: [{ label, to? }] — the last crumb is the current page.
 */
export default function PageHeader({ title, subtitle, breadcrumbs = [], actions, badge }) {
  return (
    <div className="page-header no-print">
      <div style={{ minWidth: 0 }}>
        {breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={`${b.label}-${i}`} className="row" style={{ gap: 6 }}>
                {i > 0 && <ChevronRight size={12} />}
                {b.to && i < breadcrumbs.length - 1 ? <Link to={b.to}>{b.label}</Link> : <span className={i === breadcrumbs.length - 1 ? 'current' : ''}>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-title">
          {title}
          {badge}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
