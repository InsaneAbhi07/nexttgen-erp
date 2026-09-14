import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp } from 'lucide-react'

/** Card with optional header (title, subtitle, actions) and footer. */
export function Card({ title, subtitle, actions, children, footer, flush = false, plainHeader = false, className = '', bodyClassName = '', style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <header className={`card-header ${plainHeader ? 'plain' : ''}`}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="row row-wrap">{actions}</div>}
        </header>
      )}
      <div className={`card-body ${flush ? 'flush' : ''} ${bodyClassName}`}>{children}</div>
      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  )
}

/**
 * StatCard — KPI tile.
 * trend: number (percentage, positive = up). goodWhenDown flips the colour for costs.
 */
export function StatCard({ label, value, icon: Icon, tone = 'blue', foot, trend, trendLabel = 'vs last month', goodWhenDown = false, to, onClick, className = '' }) {
  const up = typeof trend === 'number' && trend >= 0
  const good = goodWhenDown ? !up : up
  const inner = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className={`stat-icon tone-${tone}`}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="stat-value" title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {(foot || typeof trend === 'number') && (
        <div className="stat-foot">
          {typeof trend === 'number' && (
            <span className={good ? 'trend-up' : 'trend-down'}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {typeof trend === 'number' && <span>{trendLabel}</span>}
          {foot && <span>{foot}</span>}
        </div>
      )}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`stat-card ${className}`}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={`stat-card ${className}`} onClick={onClick} style={{ border: '1px solid var(--border)', font: 'inherit' }}>
        {inner}
      </button>
    )
  }
  return <div className={`stat-card ${className}`}>{inner}</div>
}

export default Card
