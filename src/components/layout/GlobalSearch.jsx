import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Factory, FileText, Search, ShoppingCart, Truck, Users, X } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId } from '../../store/selectors.js'
import { inr } from '../../utils/format.js'

/**
 * Global search across customers, suppliers, items, purchase orders, sales orders,
 * invoices and production orders — entirely in-memory. Ctrl/⌘ + K focuses it.
 */
export default function GlobalSearch() {
  const { state } = useErp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onDown = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const has = (...vals) => vals.some((v) => v && String(v).toLowerCase().includes(term))
    const customers = byId(state.customers)
    const suppliers = byId(state.suppliers)
    const items = byId(state.items)
    const newest = (list) => [...list].sort((a, b) => (a.date < b.date ? 1 : -1))
    return [
      {
        label: 'Customers', icon: Users, tone: 'tone-blue',
        rows: state.customers.filter((c) => has(c.name, c.code, c.city, c.gstin, c.mobile, c.contactPerson)).slice(0, 4)
          .map((c) => ({ id: c.id, title: c.name, sub: `${c.code}, ${c.city}`, to: `/masters/customers?view=${c.id}` })),
      },
      {
        label: 'Suppliers', icon: Truck, tone: 'tone-teal',
        rows: state.suppliers.filter((s) => has(s.name, s.code, s.city, s.gstin, s.mobile)).slice(0, 4)
          .map((s) => ({ id: s.id, title: s.name, sub: `${s.code}, ${s.city}`, to: `/masters/suppliers?view=${s.id}` })),
      },
      {
        label: 'Items', icon: Box, tone: 'tone-brass',
        rows: state.items.filter((i) => has(i.name, i.code, i.hsn, i.category)).slice(0, 5)
          .map((i) => ({ id: i.id, title: i.name, sub: `${i.code}, ${i.type}`, to: `/masters/items?view=${i.id}` })),
      },
      {
        label: 'Purchase orders', icon: ShoppingCart, tone: 'tone-violet',
        rows: newest(state.purchaseOrders).filter((p) => has(p.number, suppliers.get(p.supplierId)?.name)).slice(0, 4)
          .map((p) => ({ id: p.id, title: p.number, sub: `${suppliers.get(p.supplierId)?.name}, ${inr(p.totals.grandTotal)}`, to: `/purchase/orders/${p.id}`, mono: true })),
      },
      {
        label: 'Sales orders', icon: FileText, tone: 'tone-green',
        rows: newest(state.salesOrders).filter((s) => has(s.number, customers.get(s.customerId)?.name)).slice(0, 4)
          .map((s) => ({ id: s.id, title: s.number, sub: `${customers.get(s.customerId)?.name}, ${inr(s.totals.grandTotal)}`, to: `/sales/orders/${s.id}`, mono: true })),
      },
      {
        label: 'Invoices', icon: FileText, tone: 'tone-blue',
        rows: [
          ...newest(state.salesInvoices).filter((i) => has(i.number, customers.get(i.customerId)?.name)).slice(0, 4)
            .map((i) => ({ id: i.id, title: i.number, sub: `Sales, ${customers.get(i.customerId)?.name}, ${inr(i.totals.grandTotal)}`, to: `/sales/invoices/${i.id}`, mono: true })),
          ...newest(state.purchaseInvoices).filter((i) => has(i.number, i.supplierInvoiceNo, suppliers.get(i.supplierId)?.name)).slice(0, 2)
            .map((i) => ({ id: i.id, title: i.number, sub: `Purchase, ${suppliers.get(i.supplierId)?.name}, ${inr(i.totals.grandTotal)}`, to: `/purchase/invoices/${i.id}`, mono: true })),
        ],
      },
      {
        label: 'Production orders', icon: Factory, tone: 'tone-brass',
        rows: newest(state.productionOrders).filter((p) => has(p.number, items.get(p.productId)?.name)).slice(0, 4)
          .map((p) => ({ id: p.id, title: p.number, sub: `${items.get(p.productId)?.name}, ${p.plannedQty} units`, to: `/production/orders/${p.id}`, mono: true })),
      },
    ].filter((g) => g.rows.length)
  }, [q, state])

  const flat = groups.flatMap((g) => g.rows)

  const go = (row) => {
    navigate(row.to)
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && flat[active]) {
      go(flat[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  let idx = -1
  return (
    <div className="topbar-search" ref={boxRef}>
      <div className="search-bar" style={{ maxWidth: 'none' }}>
        <span className="search-icon">
          <Search size={15} />
        </span>
        <input
          ref={inputRef}
          className="input"
          style={{ background: 'var(--surface-2)' }}
          placeholder="Search customers, items, orders, invoices…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Global search"
        />
        {q ? (
          <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : (
          <span className="desktop-only" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
            <span className="kbd">Ctrl K</span>
          </span>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="search-pop" role="listbox">
          {groups.length === 0 && (
            <div className="empty-state" style={{ padding: '26px 12px' }}>
              <div className="empty-title">No matches for “{q}”</div>
              <p className="empty-desc">Search by name, code, GSTIN, city or document number such as PO/26-27/0012.</p>
            </div>
          )}
          {groups.map((g) => {
            const Icon = g.icon
            return (
              <div key={g.label}>
                <div className="search-group-title">{g.label}</div>
                {g.rows.map((r) => {
                  idx += 1
                  const i = idx
                  return (
                    <button key={`${g.label}-${r.id}`} type="button" className={`search-result ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                      <span className={`sr-icon ${g.tone}`}>
                        <Icon size={15} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <div className={`sr-title ${r.mono ? 'doc-no' : ''}`}>{r.title}</div>
                        <div className="sr-sub truncate">{r.sub}</div>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
