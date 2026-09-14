/**
 * Purchase module shared helpers — frontend-only demo.
 * Supplier card, document trail, list filters, print-param handling.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileSearch, Plus, Trash2, Truck } from 'lucide-react'
import { byId, itemStock, purchaseInvoiceStatus } from '../../store/selectors.js'
import { isInterState } from '../../utils/calc.js'
import { fmtDate, inr, num, today } from '../../utils/format.js'
import { stateCode } from '../../data/constants.js'
import { uid } from '../../store/numbering.js'
import { Button, Card, DocNo, EmptyState, KeyValue, Select, StatusBadge } from '../../components/ui/index.js'

export const CRUMB = { label: 'Purchase', to: '/purchase/orders' }

export const PO_TERMS =
  '1. Material must conform to approved sample and drawing.\n2. Test certificate to accompany each consignment.\n3. Rejected material will be returned at supplier’s cost.\n4. Payment as per agreed credit terms from date of GRN.'

export const RETURN_REASONS = [
  'Rejected in QC – dimension mismatch',
  'Plating defects on castings',
  'Short hardness on shackles',
  'Wrong grade supplied (SS 202 instead of 304)',
  'Damaged in transit',
  'Excess quantity supplied',
  'Other',
]

export const termDays = (t) => parseInt(t, 10) || 0
export const monthStart = () => `${today().slice(0, 8)}01`

export const supplierOptions = (state, includeId) =>
  state.suppliers.filter((s) => s.status === 'Active' || s.id === includeId).map((s) => ({ value: s.id, label: s.name }))

export const warehouseOptions = (state, includeId) =>
  state.warehouses.filter((w) => w.status === 'Active' || w.id === includeId).map((w) => ({ value: w.id, label: w.name }))

export const partyFor = (supplier, heading = 'Supplier') =>
  supplier
    ? {
        heading,
        name: supplier.name,
        legalName: supplier.companyName,
        address: `${supplier.address}, ${supplier.city}, ${supplier.state} ${supplier.pincode || ''}`.trim(),
        gstin: supplier.gstin,
        state: supplier.state,
        phone: supplier.mobile,
      }
    : null

/** List filter state: date range + supplier + status */
export function useListFilters() {
  const blank = { range: { preset: 'all' }, supplierId: '', status: '' }
  const [values, setValues] = useState(blank)
  return {
    values,
    onChange: (k, v) => setValues((s) => ({ ...s, [k]: v })),
    onReset: () => setValues(blank),
  }
}

/** Opens the print preview when the URL has ?print=1 (used by list "Print" actions). */
export function usePrintParam() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(params.get('print') === '1')
  const close = () => {
    setOpen(false)
    if (params.get('print')) {
      const next = new URLSearchParams(params)
      next.delete('print')
      setParams(next, { replace: true })
    }
  }
  return [open, () => setOpen(true), close]
}

export function MissingRecord({ what, to }) {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon={FileSearch}
        title={`${what} not found`}
        description="It may have been deleted during this demo session."
        action={<Button to={to}>Back to list</Button>}
      />
    </div>
  )
}

export function SupplierCard({ supplier, title = 'Supplier' }) {
  if (!supplier) {
    return (
      <Card title={title}>
        <EmptyState compact icon={Truck} title="No supplier selected" description="Select a supplier to see GSTIN, state and payment terms." />
      </Card>
    )
  }
  const inter = isInterState(supplier.state)
  return (
    <Card
      title={title}
      actions={
        <Link to={`/masters/suppliers?view=${supplier.id}`} className="small">
          View profile
        </Link>
      }
    >
      <div className="stack-sm" style={{ gap: 12 }}>
        <div>
          <div className="strong">{supplier.name}</div>
          <div className="small muted">
            {supplier.address}, {supplier.city}
          </div>
        </div>
        <KeyValue
          cols={2}
          items={[
            { label: 'GSTIN', value: <span className="mono">{supplier.gstin}</span> },
            { label: 'State', value: `${supplier.state} (${stateCode(supplier.state)})` },
            { label: 'Payment terms', value: supplier.paymentTerms },
            { label: 'Tax type', value: inter ? 'IGST' : 'CGST + SGST' },
            { label: 'Contact', value: supplier.contactPerson },
            { label: 'Mobile', value: supplier.mobile },
          ]}
        />
      </div>
    </Card>
  )
}

/** Build PR → PO → GRN → Invoice → Payment/Return groups from any purchase document. */
export function buildPurchaseTrail(state, { prId, poId, grnId, invoiceId, returnId }) {
  const poMap = byId(state.purchaseOrders)
  const grnMap = byId(state.grns)
  const invMap = byId(state.purchaseInvoices)
  const ret = returnId ? byId(state.purchaseReturns).get(returnId) : null
  const inv = invoiceId ? invMap.get(invoiceId) : ret ? invMap.get(ret.invoiceId) : null
  const grn = grnId ? grnMap.get(grnId) : inv?.grnId ? grnMap.get(inv.grnId) : null
  let po = poId ? poMap.get(poId) : null
  if (!po && (grn?.poId || inv?.poId)) po = poMap.get(grn?.poId || inv?.poId)
  const pr = prId ? byId(state.purchaseRequisitions).get(prId) : po?.prId ? byId(state.purchaseRequisitions).get(po.prId) : null

  const pos = po ? [po] : pr ? state.purchaseOrders.filter((p) => p.prId === pr.id) : []
  const poIds = new Set(pos.map((p) => p.id))
  const grns = poIds.size ? state.grns.filter((g) => poIds.has(g.poId)) : grn ? [grn] : []
  const grnIds = new Set(grns.map((g) => g.id))
  const invoices = state.purchaseInvoices.filter((i) => (i.poId && poIds.has(i.poId)) || (i.grnId && grnIds.has(i.grnId)))
  if (inv && !invoices.includes(inv)) invoices.push(inv)
  const invIds = new Set(invoices.map((i) => i.id))
  const payments = state.payments.filter((p) => invIds.has(p.invoiceId))
  const returns = state.purchaseReturns.filter((r) => invIds.has(r.invoiceId))

  const doc = (d, to, status, extra) => ({ id: d.id, number: d.number, date: d.date, to, status, extra })
  return [
    { key: 'pr', label: 'Purchase requisition', docs: pr ? [doc(pr, `/purchase/requisitions/${pr.id}`, pr.status)] : [] },
    { key: 'po', label: 'Purchase order', docs: pos.map((p) => doc(p, `/purchase/orders/${p.id}`, p.status, inr(p.totals.grandTotal))) },
    { key: 'grn', label: 'Goods receipt', docs: grns.map((g) => doc(g, `/purchase/grn/${g.id}`, null, `${num(g.lines.reduce((a, l) => a + Number(l.acceptedQty || 0), 0))} accepted`)) },
    { key: 'inv', label: 'Purchase invoice', docs: invoices.map((i) => doc(i, `/purchase/invoices/${i.id}`, purchaseInvoiceStatus(state, i).status, inr(i.totals.grandTotal))) },
    { key: 'pay', label: 'Supplier payment', docs: payments.map((p) => doc(p, '/accounts/payments', null, `${inr(p.amount)} by ${p.mode}`)) },
    { key: 'ret', label: 'Purchase return', docs: returns.map((r) => doc(r, `/purchase/returns/${r.id}`, r.status, inr(r.amount))) },
  ]
}

export function DocTrail({ groups, currentId }) {
  return (
    <Card title="Document trail" subtitle="Linked documents for this purchase">
      <ol className="pur-trail">
        {groups.map((g) => (
          <li key={g.key} className={`pur-trail-step ${g.docs.length ? 'done' : ''}`}>
            <span className="pur-trail-dot" />
            <div className="pur-trail-body">
              <div className="small muted">{g.label}</div>
              {g.docs.length ? (
                g.docs.map((d) => (
                  <div key={d.id} className={`row row-wrap pur-trail-doc ${d.id === currentId ? 'current' : ''}`}>
                    <DocNo to={d.id === currentId ? undefined : d.to}>{d.number}</DocNo>
                    <span className="tiny muted">{fmtDate(d.date)}</span>
                    {d.extra && <span className="tiny ink-2">{d.extra}</span>}
                    {d.status && <StatusBadge status={d.status} />}
                  </div>
                ))
              ) : (
                <div className="small" style={{ color: 'var(--ink-4)' }}>
                  Not created yet
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export const newQtyLine = (overrides = {}) => ({ id: uid('ln'), itemId: '', qty: 1, remarks: '', ...overrides })

/** Simple item + quantity grid (requisitions). */
export function QtyLinesEditor({ state, lines, onChange, error }) {
  const items = byId(state.items)
  const options = state.items.filter((i) => i.status !== 'Inactive').map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))
  const update = (idx, changes) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...changes } : l)))
  return (
    <div>
      <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        <table className="table pur-lines" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th className="align-center" style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 260 }}>Item</th>
              <th className="align-right">In stock</th>
              <th className="align-right">Min. level</th>
              <th style={{ width: 120 }}>Qty</th>
              <th style={{ width: 60 }}>Unit</th>
              <th style={{ minWidth: 160 }}>Remarks</th>
              <th style={{ width: 40 }} aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const it = items.get(l.itemId)
              const stock = it ? itemStock(state, it.id) : null
              return (
                <tr key={l.id}>
                  <td className="align-center muted">{idx + 1}</td>
                  <td>
                    <Select size="sm" options={options} placeholder="Select item" value={l.itemId} onChange={(e) => update(idx, { itemId: e.target.value })} aria-label={`Item for line ${idx + 1}`} />
                  </td>
                  <td className={`align-right num ${it && stock <= Number(it.minStock) ? 'text-red' : ''}`}>{it ? num(stock) : '—'}</td>
                  <td className="align-right num muted">{it ? num(it.minStock) : '—'}</td>
                  <td>
                    <input className="input" type="number" min="0" step="any" value={l.qty} onChange={(e) => update(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Quantity" />
                  </td>
                  <td className="muted">{it?.unit || '—'}</td>
                  <td>
                    <input className="input" value={l.remarks || ''} placeholder="Optional" onChange={(e) => update(idx, { remarks: e.target.value })} aria-label="Line remarks" />
                  </td>
                  <td>
                    <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onChange(lines.length === 1 ? [newQtyLine()] : lines.filter((_, i) => i !== idx))} aria-label={`Remove line ${idx + 1}`}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row-between mt-8">
        <Button size="sm" variant="soft" icon={Plus} onClick={() => onChange([...lines, newQtyLine()])}>
          Add item
        </Button>
        {error ? <span className="field-error">{error}</span> : <span className="tiny muted">{lines.filter((l) => l.itemId).length} item(s)</span>}
      </div>
    </div>
  )
}
