import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Route } from 'lucide-react'
import { NAV } from '../../config/navigation.js'
import { useAuth } from '../../store/AuthContext.jsx'
import BrandMark from './BrandMark.jsx'

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { can } = useAuth()
  const activeGroup = NAV.find((g) => g.base && pathname.startsWith(g.base))?.key
  const [open, setOpen] = useState(() => new Set(activeGroup ? [activeGroup] : []))

  useEffect(() => {
    if (activeGroup) setOpen((s) => (s.has(activeGroup) ? s : new Set([...s, activeGroup])))
  }, [activeGroup])

  const toggle = (key) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const items = NAV.filter((g) => can(g.module))

  return (
    <>
      <div className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`} onClick={onCloseMobile} />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <BrandMark size={32} className="brand-mark" />
          <div className="brand-text">
            <div className="brand-name">
              NexttGen <b>ERP</b>
            </div>
            <div className="brand-sub">Manufacturing &amp; Trading</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map((g) => {
            const Icon = g.icon
            if (!g.children) {
              return (
                <div className="nav-group" key={g.key}>
                  <NavLink to={g.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? g.label : undefined}>
                    <Icon size={18} strokeWidth={1.9} />
                    <span className="nav-label">{g.label}</span>
                  </NavLink>
                </div>
              )
            }
            const isOpen = open.has(g.key)
            const isActive = activeGroup === g.key
            return (
              <div className="nav-group" key={g.key}>
                <button
                  type="button"
                  className={`nav-link ${isActive && (collapsed || !isOpen) ? 'active' : ''}`}
                  onClick={() => (collapsed ? navigate(g.children[0].to) : toggle(g.key))}
                  aria-expanded={isOpen}
                  title={collapsed ? g.label : undefined}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span className="nav-label">{g.label}</span>
                  <ChevronRight size={14} className={`chev ${isOpen ? 'open' : ''}`} />
                </button>
                {isOpen && (
                  <div className="nav-children">
                    {g.children.map((c) => (
                      <NavLink key={c.to} to={c.to} end={c.end} className={({ isActive: a }) => `nav-child ${a ? 'active' : ''}`}>
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-demo">
          <strong>Demo workspace</strong>
          Sample data is saved in this browser only. Reset it anytime from your profile menu.
        </div>
        <div className="sidebar-foot">
          <NavLink to="/demo-flow" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? 'Demo walkthrough' : undefined}>
            <Route size={18} strokeWidth={1.9} />
            <span className="nav-label">Demo walkthrough</span>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
