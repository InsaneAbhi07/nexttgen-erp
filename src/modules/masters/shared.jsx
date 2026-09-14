/**
 * Shared helpers for master screens (frontend-only demo).
 * Usage guards prevent deleting masters that are referenced by transactions.
 */
import { stateCode } from '../../data/constants.js'

export const mastersCrumbs = (label) => [{ label: 'Masters', to: '/masters/items' }, { label }]

const LINE_DOCS = {
  purchaseRequisitions: 'purchase requisition',
  purchaseOrders: 'purchase order',
  grns: 'GRN',
  purchaseInvoices: 'purchase invoice',
  purchaseReturns: 'purchase return',
  quotations: 'quotation',
  salesOrders: 'sales order',
  deliveryChallans: 'delivery challan',
  salesInvoices: 'sales invoice',
  salesReturns: 'sales return',
  stockTransfers: 'stock transfer',
  materialIssues: 'material issue',
}

export function itemUsage(state, id) {
  for (const [c, label] of Object.entries(LINE_DOCS)) {
    const doc = (state[c] || []).find((d) => (d.lines || []).some((l) => l.itemId === id))
    if (doc) return `It is used in ${label} ${doc.number}.`
  }
  for (const [c, label] of [['stockIns', 'stock in'], ['stockOuts', 'stock out'], ['stockAdjustments', 'stock adjustment'], ['wastages', 'wastage entry']]) {
    const doc = (state[c] || []).find((d) => d.itemId === id)
    if (doc) return `It is used in ${label} ${doc.number}.`
  }
  const bom = state.boms.find((b) => b.productId === id || b.components.some((x) => x.itemId === id))
  if (bom) return `It is part of bill of material ${bom.code}.`
  const prd = state.productionOrders.find((p) => p.productId === id)
  if (prd) return `It is used in production order ${prd.number}.`
  return null
}

export function customerUsage(state, id) {
  for (const [c, label] of [['salesInvoices', 'sales invoice'], ['salesOrders', 'sales order'], ['quotations', 'quotation'], ['deliveryChallans', 'delivery challan'], ['receipts', 'receipt'], ['salesReturns', 'sales return']]) {
    const doc = state[c].find((d) => d.customerId === id)
    if (doc) return `The customer has transactions, for example ${label} ${doc.number}. Mark it inactive instead.`
  }
  return null
}

export function supplierUsage(state, id) {
  for (const [c, label] of [['purchaseInvoices', 'purchase invoice'], ['purchaseOrders', 'purchase order'], ['grns', 'GRN'], ['payments', 'payment'], ['purchaseReturns', 'purchase return']]) {
    const doc = state[c].find((d) => d.supplierId === id)
    if (doc) return `The supplier has transactions, for example ${label} ${doc.number}. Mark it inactive instead.`
  }
  return null
}

export function stockStatus(balance, minStock) {
  if (balance <= 0) return 'Out of Stock'
  if (Number(minStock) > 0 && balance <= Number(minStock)) return 'Low Stock'
  return 'In Stock'
}

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function validateGstin(gstin, state) {
  if (!gstin) return null
  const g = gstin.trim().toUpperCase()
  if (!GSTIN_RE.test(g)) return 'Enter a valid 15-character GSTIN, e.g. 09AAHCN7312E1Z5'
  const code = stateCode(state)
  if (state && code && g.slice(0, 2) !== code) return `GSTIN starts with ${g.slice(0, 2)} but ${state} uses state code ${code}`
  return null
}

export const mobileDigits = (m = '') => {
  const d = String(m).replace(/\D/g, '')
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d
}
export const validMobile = (m) => /^[6-9]\d{9}$/.test(mobileDigits(m))
export const formatMobile = (m) => {
  const d = mobileDigits(m)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : m
}
export const validEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

/** Compact table used inside view drawers. columns: [{ header, render(row), align }] */
export function MiniTable({ columns, rows, empty = 'Nothing to show yet.' }) {
  return (
    <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
      <table className="table compact">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={c.align ? `align-${c.align}` : ''}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted text-center" style={{ padding: 16 }}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id || r.key || i}>
              {columns.map((c) => (
                <td key={c.header} className={c.align ? `align-${c.align}` : ''}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="row-between" style={{ marginBottom: 8 }}>
      <div className="strong" style={{ fontSize: 13.5 }}>{children}</div>
      {action}
    </div>
  )
}
