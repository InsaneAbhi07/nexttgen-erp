import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { initials } from '../../utils/format.js'

const AVATAR_COLORS = ['#1f3561', '#1f5fd6', '#0e7c86', '#5f45c4', '#8a6417', '#177a52', '#a8322a']

export function Avatar({ name = '', size, className = '' }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return (
    <span className={`avatar ${size || ''} ${className}`} style={{ background: AVATAR_COLORS[idx] }} aria-hidden>
      {initials(name)}
    </span>
  )
}

/** Progress bar. value 0–100 */
export function Progress({ value = 0, tone, style }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const auto = tone || (v >= 100 ? 'green' : v >= 50 ? '' : 'amber')
  return (
    <div className={`progress ${auto}`} style={style} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  )
}

/** Key/value grid for detail pages. items: [{ label, value, span? }] */
export function KeyValue({ items = [], cols }) {
  return (
    <div className={`kv-grid ${cols ? `cols-${cols}` : ''}`}>
      {items
        .filter(Boolean)
        .map((it) => (
          <div key={it.label} style={it.span ? { gridColumn: `span ${it.span}` } : undefined}>
            <div className="kv-label">{it.label}</div>
            <div className="kv-value">{it.value === undefined || it.value === null || it.value === '' ? '—' : it.value}</div>
          </div>
        ))}
    </div>
  )
}

export function Callout({ tone = 'blue', icon, children, style }) {
  const Icon = icon || (tone === 'amber' || tone === 'red' ? AlertTriangle : tone === 'green' ? CheckCircle2 : Info)
  return (
    <div className={`callout ${tone === 'blue' ? '' : tone}`} style={style}>
      <Icon size={16} />
      <div>{children}</div>
    </div>
  )
}

/** Monospace document number, optionally linked. */
export function DocNo({ children, to }) {
  if (to) {
    return (
      <Link className="doc-no" to={to} onClick={(e) => e.stopPropagation()}>
        {children}
      </Link>
    )
  }
  return <span className="doc-no">{children}</span>
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />
}

/** Full-page loading skeleton for detail pages. */
export function PageSkeleton() {
  return (
    <div className="stack">
      <span className="skeleton" style={{ width: 220, height: 20 }} />
      <div className="grid-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card card-body stack-sm">
            <span className="skeleton" style={{ width: '50%' }} />
            <span className="skeleton" style={{ width: '70%', height: 18 }} />
          </div>
        ))}
      </div>
      <div className="card card-body stack-sm">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="skeleton" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  )
}
