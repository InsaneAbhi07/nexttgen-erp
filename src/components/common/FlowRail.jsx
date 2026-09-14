/**
 * FlowRail — the "operations line": Purchase → Production → Sales → Accounts,
 * drawn like a factory conveyor with live figures from the mock store.
 * steps: [{ key, label, value, sub, icon, to }]
 */
import { Link } from 'react-router-dom'
import './FlowRail.css'

export default function FlowRail({ steps = [], dark = false, compact = false }) {
  return (
    <ol className={`flow-rail ${dark ? 'dark' : ''} ${compact ? 'compact' : ''}`}>
      {steps.map((s, i) => {
        const Icon = s.icon
        const body = (
          <>
            <span className="flow-node">{Icon && <Icon size={compact ? 15 : 17} />}</span>
            <span className="flow-text">
              <span className="flow-label">{s.label}</span>
              <span className="flow-value">{s.value}</span>
              {s.sub && <span className="flow-sub">{s.sub}</span>}
            </span>
          </>
        )
        return (
          <li key={s.key || s.label} className="flow-step" style={{ '--i': i }}>
            {s.to ? (
              <Link to={s.to} className="flow-inner">
                {body}
              </Link>
            ) : (
              <div className="flow-inner">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
