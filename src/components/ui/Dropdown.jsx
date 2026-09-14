import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'

/**
 * Dropdown menu rendered in a portal (so it is never clipped by scrolling tables).
 * items: [{ label, icon, onClick, to, danger, disabled, divider, heading }]
 * trigger: ({ open, toggle }) => node   OR  a node (clicking it toggles)
 */
export function Dropdown({ trigger, items = [], align = 'right', width = 200, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const anchor = useRef(null)
  const menu = useRef(null)
  const navigate = useNavigate()

  const place = () => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    const menuH = menu.current?.offsetHeight || 240
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow < menuH + 12 && r.top > menuH + 12 ? r.top - menuH - 6 : r.bottom + 6
    let left = align === 'left' ? r.left : r.right - width
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !anchor.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const toggle = (e) => {
    e?.stopPropagation?.()
    setOpen((o) => !o)
  }

  return (
    <>
      <span ref={anchor} className="dropdown" onClick={typeof trigger === 'function' ? undefined : toggle}>
        {typeof trigger === 'function' ? trigger({ open, toggle }) : trigger}
      </span>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="menu"
            role="menu"
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, right: 'auto', width, visibility: pos ? 'visible' : 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            {items
              .filter((it) => it && !it.hidden)
              .map((it, i) => {
                if (it.divider) return <div key={`d${i}`} className="menu-sep" />
                if (it.heading) return <div key={`h${i}`} className="menu-heading">{it.heading}</div>
                const Icon = it.icon
                return (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    className={`menu-item ${it.danger ? 'danger' : ''}`}
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(false)
                      if (it.to) navigate(it.to)
                      it.onClick?.()
                    }}
                  >
                    {Icon && <Icon size={15} />}
                    {it.label}
                  </button>
                )
              })}
          </div>,
          document.body,
        )}
    </>
  )
}

/** Three-dot row action menu. */
export function ActionMenu({ items, label = 'Actions' }) {
  return (
    <Dropdown
      items={items}
      width={184}
      trigger={({ toggle }) => (
        <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={toggle} aria-label={label}>
          <MoreHorizontal size={17} />
        </button>
      )}
    />
  )
}

export default Dropdown
