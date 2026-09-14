/**
 * Sales module — shared helpers & widgets (frontend-only demo).
 * Customer card, read-only line table, document trail, form shell, list filters.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileQuestion, UserRound } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, outstandingRows, salesInvoiceStatus } from '../../store/selectors.js'
import { calcLine } from '../../utils/calc.js'
import { fmtDate, inr, inr2, num, today } from '../../utils/format.js'
import { SALES_PERSONS } from '../../data/constants.js'
import { Button, Callout, Card, DocNo, EmptyState, FormField, KeyValue, Progress, StatusBadge, inDateRange } from '../../components/ui/index.js'
import './sales.css'

export const SALES_CRUMB = { label: 'Sales', to: '/sales/orders' }

export const isSellable = (i) => ['Finished Good', 'Trading Goods'].includes(i.type)
export const termDays = (t) => parseInt(t, 10) || 0

export const QUOTATION_TERMS =
  'Prices are ex-works Aligarh.\nGST extra as applicable.\nDelivery within 7–10 working days from order confirmation.\nFreight to be borne by the buyer.'

export const effectiveQuotationStatus = (q) =>
  ['Draft', 'Sent', 'Accepted'].includes(q.status) && q.validTill && q.validTill < today() ? 'Expired' : q.status

export const customerAddress = (c) => (c ? `${c.address}, ${c.city}, ${c.state} ${c.pincode || ''}`.trim() : '')

export const customerOptions = (state, selectedId) =>
  state.customers
    .filter((c) => c.status === 'Active' || c.id === selectedId)
    .map((c) => ({ value: c.id, label: `${c.name}, ${c.city}` }))

export const warehouseOptions = (state, selectedId) =>
  state.warehouses.filter((w) => w.status === 'Active' || w.id === selectedId).map((w) => ({ value: w.id, label: w.name }))

export const customerOutstanding = (state, customerId) =>
  outstandingRows(state, 'receivable')
    .filter((r) => r.partyId === customerId)
    .reduce((a, r) => a + r.balance, 0)

export const partyOf = (c, heading = 'Bill To') =>
  c ? { heading, name: c.name, legalName: c.companyName, address: customerAddress(c), gstin: c.gstin, state: c.state, phone: c.mobile } : null

export const lineQty = (lines = [], key = 'qty') => lines.reduce((a, l) => a + (Number(l[key]) || 0), 0)

/* ---------------- Customer card ---------------- */
export function CustomerCard({ customerId, title = 'Customer' }) {
  const { state } = useErp()
  const c = byId(state.customers).get(customerId)
  if (!c) {
    return (
      <Card title={title}>
        <EmptyState compact icon={UserRound} title="No customer selected" description="Choose a customer to see GSTIN, credit limit and outstanding." />
      </Card>
    )
  }
  const outstanding = customerOutstanding(state, c.id)
  const limit = Number(c.creditLimit) || 0
  const used = limit ? (outstanding / limit) * 100 : 0
  return (
    <Card title={title} actions={<Button size="sm" variant="ghost" to={`/masters/customers?view=${c.id}`}>Open</Button>}>
      <div className="stack-sm" style={{ gap: 12 }}>
        <div>
          <div className="strong">{c.name}</div>
          {c.companyName !== c.name && <div className="small muted">{c.companyName}</div>}
          <div className="small muted">{customerAddress(c)}</div>
        </div>
        <KeyValue
          cols={2}
          items={[
            { label: 'GSTIN', value: <span className="mono">{c.gstin}</span> },
            { label: 'State', value: c.state },
            { label: 'Payment terms', value: c.paymentTerms },
            { label: 'Mobile', value: c.mobile },
          ]}
        />
        {limit > 0 && (
          <div>
            <div className="row-between small" style={{ marginBottom: 5 }}>
              <span className="muted">Credit used</span>
              <span className="num">
                {inr(outstanding)} of {inr(limit)}
              </span>
            </div>
            <Progress value={used} tone={used > 100 ? 'red' : used > 80 ? 'amber' : 'green'} />
          </div>
        )}
        {limit > 0 && outstanding > limit && (
          <Callout tone="amber">
            Outstanding of {inr(outstanding)} is above the credit limit of {inr(limit)}. Collect payment before the next dispatch.
          </Callout>
        )}
        <Link to={`/accounts/customer-ledger?customer=${c.id}`} className="small">
          View customer ledger
        </Link>
      </div>
    </Card>
  )
}

/* ---------------- Read-only line table ---------------- */
export function LinesTable({ lines = [], interState = false }) {
  const { state } = useErp()
  const items = byId(state.items)
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="align-center" style={{ width: 36 }}>#</th>
            <th>Item</th>
            <th>HSN</th>
            <th className="align-right">Qty</th>
            <th className="align-right">Rate</th>
            <th className="align-right">Disc.</th>
            <th className="align-right">Taxable</th>
            <th className="align-right">{interState ? 'IGST' : 'CGST + SGST'}</th>
            <th className="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const it = items.get(l.itemId)
            const c = calcLine(l)
            return (
              <tr key={l.id || i}>
                <td className="align-center muted">{i + 1}</td>
                <td>
                  <div className="cell-primary">{it?.name || 'Item'}</div>
                  <div className="cell-secondary">{it?.code}</div>
                </td>
                <td className="mono small">{it?.hsn}</td>
                <td className="align-right num">
                  {num(l.qty)} <span className="muted small">{it?.unit}</span>
                </td>
                <td className="align-right num">{inr2(l.rate)}</td>
                <td className="align-right num">{Number(l.discount) ? `${l.discount}%` : '—'}</td>
                <td className="align-right num">{inr2(c.taxable)}</td>
                <td className="align-right num">
                  {inr2(c.gstAmt)}
                  <div className="cell-secondary">@{l.gst}%</div>
                </td>
                <td className="align-right num strong">{inr2(c.total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Document trail ---------------- */
function buildTrail(state, type, doc) {
  const orders = byId(state.salesOrders)
  const invoicesById = byId(state.salesInvoices)
  const dcById = byId(state.deliveryChallans)
  let so = null
  let quotation = null
  let dcs = []
  let invoices = []
  if (type === 'quotation') {
    quotation = doc
    so = state.salesOrders.find((o) => o.quotationId === doc.id) || null
  } else if (type === 'so') {
    so = doc
  } else if (type === 'dc') {
    so = orders.get(doc.soId) || null
    if (!so) dcs = [doc]
  } else if (type === 'invoice' || type === 'return') {
    const inv = type === 'invoice' ? doc : invoicesById.get(doc.invoiceId)
    so = inv ? orders.get(inv.soId) || null : null
    if (!so && inv) {
      invoices = [inv]
      dcs = inv.dcId && dcById.get(inv.dcId) ? [dcById.get(inv.dcId)] : []
    }
  }
  if (so) {
    quotation = quotation || (so.quotationId ? byId(state.quotations).get(so.quotationId) || null : null)
    dcs = state.deliveryChallans.filter((d) => d.soId === so.id)
    invoices = state.salesInvoices.filter((i) => i.soId === so.id)
  }
  const invIds = new Set(invoices.map((i) => i.id))
  return {
    quotation,
    so,
    dcs,
    invoices,
    receipts: state.receipts.filter((r) => invIds.has(r.invoiceId)),
    returns: state.salesReturns.filter((r) => invIds.has(r.invoiceId)),
  }
}

export function RelatedDocs({ type, doc }) {
  const { state } = useErp()
  const t = useMemo(() => buildTrail(state, type, doc), [state, type, doc])
  const steps = [
    { label: 'Quotation', docs: t.quotation ? [t.quotation] : [], to: (d) => `/sales/quotations/${d.id}`, status: (d) => effectiveQuotationStatus(d), amount: (d) => d.totals?.grandTotal },
    { label: 'Sales order', docs: t.so ? [t.so] : [], to: (d) => `/sales/orders/${d.id}`, status: (d) => d.status, amount: (d) => d.totals?.grandTotal },
    { label: 'Delivery challans', docs: t.dcs, to: (d) => `/sales/challans/${d.id}`, status: (d) => d.status, extra: (d) => `${num(lineQty(d.lines, 'deliveredQty'))} units` },
    { label: 'Invoices', docs: t.invoices, to: (d) => `/sales/invoices/${d.id}`, status: (d) => salesInvoiceStatus(state, d).status, amount: (d) => d.totals?.grandTotal },
    { label: 'Receipts', docs: t.receipts, to: () => '/accounts/receipts', extra: (d) => d.mode, amount: (d) => d.amount },
    { label: 'Returns', docs: t.returns, to: (d) => `/sales/returns/${d.id}`, status: (d) => d.status, amount: (d) => d.amount },
  ]
  return (
    <Card title="Document trail" subtitle="From quotation to payment">
      <ol className="trail">
        {steps.map((s) => (
          <li key={s.label} className={`trail-step ${s.docs.length ? 'done' : ''}`}>
            <span className="trail-dot" />
            <div className="trail-label">{s.label}</div>
            {s.docs.length === 0 && <div className="small muted">Not created yet</div>}
            {s.docs.map((d) => (
              <div key={d.id} className={`trail-doc ${d.id === doc.id ? 'current' : ''}`}>
                <span className="row" style={{ gap: 6, minWidth: 0 }}>
                  <DocNo to={d.id === doc.id ? undefined : s.to(d)}>{d.number}</DocNo>
                  <span className="tiny muted">{fmtDate(d.date)}</span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {s.amount && <span className="small num">{inr(s.amount(d))}</span>}
                  {s.extra && <span className="small muted">{s.extra(d)}</span>}
                  {s.status && <StatusBadge status={s.status(d)} />}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ---------------- Form shell ---------------- */
export function FormShell({ onSubmit, main, side, actions }) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="sales-split">
        <div className="stack">{main}</div>
        <div className="stack">{side}</div>
      </div>
      <div className="sticky-actions form-actions">{actions}</div>
    </form>
  )
}

/** Render FormField definitions in a grid. */
export function Fields({ defs, values, errors = {}, onChange, cols = 3 }) {
  return (
    <div className={`form-grid ${cols === 3 ? '' : `cols-${cols}`}`}>
      {defs.filter(Boolean).map((d) => (
        <FormField key={d.name} def={d} value={d.value !== undefined ? d.value : values[d.name]} error={errors[d.name]} onChange={(v) => onChange(d.name, v)} />
      ))}
    </div>
  )
}

export function DocNotFound({ label, to }) {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon={FileQuestion}
        title={`${label} not found`}
        description="It may have been deleted, or the demo data was reset."
        action={<Button variant="primary" to={to}>Back to list</Button>}
      />
    </div>
  )
}

/* ---------------- List filters ---------------- */
export function useSalesFilters(initial = {}) {
  const base = { range: { preset: 'all', from: '', to: '' }, customer: '', status: '', salesPerson: '', ...initial }
  const [values, setValues] = useState(base)
  const onChange = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const reset = () => setValues({ range: { preset: 'all', from: '', to: '' }, customer: '', status: '', salesPerson: '' })
  return { values, onChange, reset }
}

export const filterDefs = (state, statuses, extra = []) => [
  { key: 'range', type: 'daterange' },
  { key: 'customer', label: 'Customers', options: state.customers.map((c) => ({ value: c.id, label: c.name })), width: 190 },
  { key: 'status', label: 'Statuses', options: statuses, width: 150 },
  ...extra,
]

export const salesPersonFilter = { key: 'salesPerson', label: 'Sales persons', options: SALES_PERSONS, width: 150 }

export const matchCommon = (row, values, status) =>
  inDateRange(row.date, values.range) &&
  (!values.customer || row.customerId === values.customer) &&
  (!values.status || status === values.status) &&
  (!values.salesPerson || row.salesPerson === values.salesPerson)

export const monthStart = () => `${today().slice(0, 8)}01`
