/**
 * Sales returns / credit notes — goods come back into stock and the amount
 * reduces the invoice outstanding (frontend-only demo).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, Clock, Eye, FileText, MoreHorizontal, Pencil, Plus, Printer, Trash2, Undo2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { calcLine, calcTotals } from '../../utils/calc.js'
import { fmtDate, inr, inr2, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { STATUS } from '../../data/constants.js'
import { Button, Callout, Card, DataTable, DocNo, Dropdown, EmptyState, FilterPanel, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import {
  CustomerCard, DocNotFound, Fields, FormShell, LinesTable, RelatedDocs, SALES_CRUMB,
  customerOptions, filterDefs, lineQty, matchCommon, monthStart, partyOf, useSalesFilters, warehouseOptions,
} from './shared.jsx'

const CRUMBS = [SALES_CRUMB, { label: 'Sales returns', to: '/sales/returns' }]
const REASONS = ['Damaged in transit', 'Manufacturing defect', 'Wrong item or finish supplied', 'Excess quantity supplied', 'Packing damaged – party refused', 'Other']
const toScrap = (reason) => /damag|defect|refused/i.test(reason || '')

function useReturnActions() {
  const { patch, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  return {
    setStatus: (r, status) => {
      patch('salesReturns', r.id, { status })
      toast.success(status === 'Approved' ? 'Return approved' : 'Credit note issued', r.number)
    },
    del: async (r, after) => {
      const ok = await confirm({ title: 'Delete sales return?', message: `${r.number} will be removed. The returned stock is taken out again and the invoice balance goes back up.`, confirmLabel: 'Delete', tone: 'danger' })
      if (!ok) return
      remove('salesReturns', r.id)
      toast.success('Sales return deleted', r.number)
      after?.()
    },
  }
}

/* ---------------- List ---------------- */
export function ReturnList() {
  usePageTitle('Sales returns')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const f = useSalesFilters()
  const act = useReturnActions()
  const customers = byId(state.customers)
  const invoices = byId(state.salesInvoices)
  const warehouses = byId(state.warehouses)

  const all = useMemo(
    () => state.salesReturns.map((r) => ({ ...r, _customer: customers.get(r.customerId), _inv: invoices.get(r.invoiceId), _qty: lineQty(r.lines) })),
    [state.salesReturns, customers, invoices],
  )
  const rows = useMemo(() => all.filter((r) => matchCommon(r, { ...f.values, salesPerson: '' }, r.status)), [all, f.values])
  const month = all.filter((r) => r.date >= monthStart())

  const columns = [
    { key: 'number', header: 'Return no.', render: (r) => <DocNo to={`/sales/returns/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'customer', header: 'Customer', accessor: (r) => r._customer?.name, render: (r) => (<><div className="cell-primary">{r._customer?.name}</div><div className="cell-secondary">{r._customer?.city}</div></>) },
    { key: 'invoice', header: 'Invoice', accessor: (r) => r._inv?.number, render: (r) => (r._inv ? <DocNo to={`/sales/invoices/${r._inv.id}`}>{r._inv.number}</DocNo> : '—') },
    { key: 'qty', header: 'Qty', align: 'right', accessor: (r) => r._qty, render: (r) => <span className="num">{num(r._qty)}</span> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="truncate" style={{ display: 'inline-block', maxWidth: 220 }} title={r.reason}>{r.reason}</span> },
    { key: 'warehouse', header: 'Received into', accessor: (r) => warehouses.get(r.warehouseId)?.name },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.amount, render: (r) => <span className="num strong">{inr(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const rowActions = (r) => [
    { label: 'View details', icon: Eye, onClick: () => navigate(`/sales/returns/${r.id}`) },
    can('Sales', 'approve') && r.status === 'Pending' && { label: 'Approve', icon: CheckCircle2, onClick: () => act.setStatus(r, 'Approved') },
    can('Sales', 'approve') && r.status === 'Approved' && { label: 'Issue credit note', icon: BadgeCheck, onClick: () => act.setStatus(r, 'Credit Note Issued') },
    { label: 'Print', icon: Printer, onClick: () => navigate(`/sales/returns/${r.id}?print=1`) },
    can('Sales', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/returns/${r.id}/edit`) },
    can('Sales', 'delete') && { divider: true },
    can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(r) },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Sales returns"
        subtitle="Goods returned by customers. Damaged pieces go to the rejection yard; the amount is credited against the invoice."
        breadcrumbs={[SALES_CRUMB, { label: 'Sales returns' }]}
        actions={can('Sales', 'add') && <Button variant="primary" icon={Plus} to="/sales/returns/new">New sales return</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Returns this month" value={inr(month.reduce((a, r) => a + r.amount, 0))} icon={Undo2} tone="blue" foot={`${month.length} returns`} />
        <StatCard label="Pending approval" value={all.filter((r) => r.status === 'Pending').length} icon={Clock} tone="amber" foot="Waiting for manager review" />
        <StatCard label="Credit notes issued" value={all.filter((r) => r.status === 'Credit Note Issued').length} icon={BadgeCheck} tone="green" foot="Adjusted in customer ledgers" />
        <StatCard label="Total credited" value={inr(all.reduce((a, r) => a + r.amount, 0))} icon={FileText} tone="brass" foot="All returns on record" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/sales/returns/${r.id}`)}
        rowActions={rowActions}
        exportName="sales-returns"
        searchPlaceholder="Search return no., customer, reason…"
        filters={<FilterPanel filters={filterDefs(state, STATUS.returns)} values={f.values} onChange={f.onChange} onReset={f.reset} />}
        emptyTitle="No sales returns match"
        emptyDescription="Record goods returned against an invoice."
        emptyAction={can('Sales', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/sales/returns/new">New sales return</Button>}
      />
    </>
  )
}

/* ---------------- Form ---------------- */
export function ReturnForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('salesReturns', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New sales return')

  const [doc, setDoc] = useState(() => {
    if (existing) return { ...existing, qtys: Object.fromEntries(existing.lines.map((l) => [l.itemId, l.qty])) }
    const inv = params.get('invoice') ? get('salesInvoices', params.get('invoice')) : null
    return { date: today(), customerId: inv?.customerId || '', invoiceId: inv?.id || '', warehouseId: 'wh-fgg', reason: REASONS[0], status: 'Approved', remarks: '', qtys: {} }
  })
  const [whTouched, setWhTouched] = useState(Boolean(existing))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !existing) return <DocNotFound label="Sales return" to="/sales/returns" />

  const items = byId(state.items)
  const customer = get('customers', doc.customerId)
  const invoice = doc.invoiceId ? get('salesInvoices', doc.invoiceId) : null
  const invoiceOptions = state.salesInvoices
    .filter((i) => i.customerId === doc.customerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((i) => ({ value: i.id, label: `${i.number}, ${fmtDate(i.date)}, ${inr(i.totals.grandTotal)}` }))

  const returnedBefore = {}
  if (invoice) {
    state.salesReturns
      .filter((r) => r.invoiceId === invoice.id && r.id !== existing?.id)
      .forEach((r) => r.lines.forEach((l) => { returnedBefore[l.itemId] = (returnedBefore[l.itemId] || 0) + Number(l.qty) }))
  }
  const rows = invoice
    ? invoice.lines.map((l) => {
        const max = Math.max(0, Number(l.qty) - (returnedBefore[l.itemId] || 0))
        const qty = doc.qtys[l.itemId] ?? 0
        return { src: l, item: items.get(l.itemId), max, qty }
      })
    : []
  const lines = rows
    .filter((r) => Number(r.qty) > 0)
    .map((r) => ({ id: existing?.lines.find((x) => x.itemId === r.src.itemId)?.id || `${r.src.id}-r`, itemId: r.src.itemId, qty: Number(r.qty), rate: r.src.rate, discount: r.src.discount || 0, gst: r.src.gst }))
  const totals = calcTotals(lines, { interState: invoice?.totals?.interState })

  const set = (k, v) => {
    setErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'customerId') setDoc((d) => ({ ...d, customerId: v, invoiceId: '', qtys: {} }))
    else if (k === 'invoiceId') setDoc((d) => ({ ...d, invoiceId: v, qtys: {} }))
    else if (k === 'reason') setDoc((d) => ({ ...d, reason: v, warehouseId: whTouched ? d.warehouseId : toScrap(v) ? 'wh-scr' : 'wh-fgg' }))
    else if (k === 'warehouseId') {
      setWhTouched(true)
      setDoc((d) => ({ ...d, warehouseId: v }))
    } else setDoc((d) => ({ ...d, [k]: v }))
  }
  const setQty = (itemId, v) => {
    setDoc((d) => ({ ...d, qtys: { ...d.qtys, [itemId]: v === '' ? '' : Number(v) } }))
    setErrors((e) => ({ ...e, lines: undefined, [`q-${itemId}`]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!doc.customerId) errs.customerId = 'Select a customer'
    if (!doc.invoiceId) errs.invoiceId = 'Select the original invoice'
    if (!doc.date) errs.date = 'Enter the return date'
    if (!doc.reason) errs.reason = 'Select a reason'
    rows.forEach((r) => {
      if (Number(r.qty) < 0) errs[`q-${r.src.itemId}`] = 'Can’t be negative'
      else if (Number(r.qty) > r.max) errs[`q-${r.src.itemId}`] = `Max ${num(r.max)}`
    })
    if (invoice && !lines.length) errs.lines = 'Enter a return quantity for at least one item'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay()
    const { qtys, ...rest } = doc
    const saved = save('salesReturns', { ...rest, lines, amount: totals.grandTotal })
    setSaving(false)
    toast.success(existing ? 'Sales return updated' : 'Sales return saved', `${saved.number}: ${inr(totals.grandTotal)} credited, stock added to ${get('warehouses', doc.warehouseId)?.name}.`)
    navigate(`/sales/returns/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New sales return'}
        subtitle="Only quantities not already returned can be taken back."
        breadcrumbs={[...CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      <FormShell
        onSubmit={submit}
        main={
          <>
            <Card title="Return details">
              <Fields
                values={doc}
                errors={errors}
                onChange={set}
                defs={[
                  { name: 'number', label: 'Return no.', readOnly: true, value: existing?.number || previewNumber('salesReturns', doc.date) },
                  { name: 'date', label: 'Return date', type: 'date', required: true },
                  { name: 'status', label: 'Status', type: 'select', options: STATUS.returns },
                  { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customerOptions(state, doc.customerId), placeholder: 'Select customer', span: 2 },
                  { name: 'invoiceId', label: 'Original invoice', type: 'select', required: true, options: invoiceOptions, placeholder: doc.customerId ? 'Select invoice' : 'Select customer first' },
                  { name: 'reason', label: 'Reason', type: 'select', required: true, options: REASONS, span: 2 },
                  { name: 'warehouseId', label: 'Receive into', type: 'select', options: warehouseOptions(state, doc.warehouseId), hint: toScrap(doc.reason) ? 'Damaged goods go to the scrap yard' : undefined },
                ]}
              />
            </Card>
            <Card title="Items returned" subtitle={invoice ? `From ${invoice.number}` : 'Select an invoice to load its items'} flush>
              {!invoice ? (
                <EmptyState compact icon={Undo2} title="No invoice selected" description="Choose the customer and the invoice the goods were billed on." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="align-right">Invoiced</th>
                        <th className="align-right">Returned earlier</th>
                        <th className="align-right">Rate</th>
                        <th style={{ width: 120 }}>Return qty</th>
                        <th className="align-right">Amount incl. GST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const amt = calcLine({ ...r.src, qty: Number(r.qty) || 0 }).total
                        return (
                          <tr key={r.src.id}>
                            <td><div className="cell-primary">{r.item?.name}</div><div className="cell-secondary">{r.item?.code}, GST {r.src.gst}%</div></td>
                            <td className="align-right num">{num(r.src.qty)} <span className="muted small">{r.item?.unit}</span></td>
                            <td className="align-right num">{num(returnedBefore[r.src.itemId] || 0)}</td>
                            <td className="align-right num">{inr2(r.src.rate)}</td>
                            <td>
                              <input className={`input input-sm ${errors[`q-${r.src.itemId}`] ? 'has-error' : ''}`} type="number" min="0" max={r.max} step="any" value={r.qty} onChange={(e) => setQty(r.src.itemId, e.target.value)} aria-label={`Return qty for ${r.item?.name}`} />
                              <div className={errors[`q-${r.src.itemId}`] ? 'field-error' : 'tiny muted'}>{errors[`q-${r.src.itemId}`] || `Max ${num(r.max)}`}</div>
                            </td>
                            <td className="align-right num strong">{inr2(amt)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.lines && <div className="card-body"><span className="field-error">{errors.lines}</span></div>}
            </Card>
            <Card title="Remarks">
              <Fields cols={1} values={doc} onChange={set} defs={[{ name: 'remarks', label: 'Remarks', type: 'textarea', rows: 2, placeholder: 'Checked by QC, 6 pieces with broken lever' }]} />
            </Card>
          </>
        }
        side={
          <>
            <CustomerCard customerId={doc.customerId} />
            <Card title="Credit amount">
              <TotalsSummary totals={totals} showWords />
              <Callout tone="gray" style={{ marginTop: 12 }}>This amount reduces the outstanding on the original invoice.</Callout>
            </Card>
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(existing ? `/sales/returns/${existing.id}` : '/sales/returns')} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save sales return</Button>
          </>
        }
      />
    </>
  )
}

/* ---------------- View ---------------- */
export function ReturnView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { get } = useErp()
  const { can } = useAuth()
  const act = useReturnActions()
  const r = get('salesReturns', id)
  usePageTitle(r?.number || 'Sales return')
  const [preview, setPreview] = useState(params.get('print') === '1')

  if (!r) return <DocNotFound label="Sales return" to="/sales/returns" />

  const customer = get('customers', r.customerId)
  const invoice = get('salesInvoices', r.invoiceId)
  const warehouse = get('warehouses', r.warehouseId)
  const interState = invoice?.totals?.interState
  const lines = r.lines.map((l) => ({ discount: 0, ...l }))
  const totals = calcTotals(lines, { interState })

  return (
    <>
      <PageHeader
        title={r.number}
        badge={<StatusBadge status={r.status} />}
        subtitle={`${customer?.name || 'Customer'}, returned on ${fmtDate(r.date)}`}
        breadcrumbs={[...CRUMBS, { label: r.number }]}
        actions={
          <>
            {can('Sales', 'approve') && r.status === 'Pending' && <Button icon={CheckCircle2} onClick={() => act.setStatus(r, 'Approved')}>Approve</Button>}
            {can('Sales', 'approve') && r.status === 'Approved' && <Button icon={BadgeCheck} onClick={() => act.setStatus(r, 'Credit Note Issued')}>Issue credit note</Button>}
            <Button variant="primary" icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            <Dropdown
              width={160}
              items={[
                can('Sales', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/returns/${r.id}/edit`) },
                can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(r, () => navigate('/sales/returns')) },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} aria-label="More actions" iconOnly />}
            />
          </>
        }
      />
      <div className="sales-split">
        <div className="stack">
          <Card title="Return details">
            <KeyValue
              cols={4}
              items={[
                { label: 'Return date', value: fmtDate(r.date) },
                { label: 'Original invoice', value: invoice ? <DocNo to={`/sales/invoices/${invoice.id}`}>{invoice.number}</DocNo> : '—' },
                { label: 'Received into', value: warehouse?.name },
                { label: 'Credit amount', value: inr(r.amount) },
                { label: 'Reason', value: r.reason, span: 2 },
                { label: 'Remarks', value: r.remarks, span: 2 },
              ]}
            />
          </Card>
          <Card title="Items returned" flush>
            <LinesTable lines={lines} interState={interState} />
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <TotalsSummary totals={totals} showWords />
            </div>
          </Card>
        </div>
        <div className="stack">
          <CustomerCard customerId={r.customerId} />
          <RelatedDocs type="return" doc={r} />
        </div>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        title="Sales Return / Credit Note"
        numberLabel="Credit Note No."
        number={r.number}
        date={r.date}
        meta={[
          { label: 'Against invoice', value: invoice?.number },
          { label: 'Invoice date', value: invoice ? fmtDate(invoice.date) : '' },
          { label: 'Reason', value: r.reason },
        ]}
        party={partyOf(customer)}
        lines={lines}
        totals={totals}
        interState={interState}
        notes={r.remarks}
        terms={'Credit issued against goods returned by the customer.\nThis amount will be adjusted against the outstanding on the original invoice.'}
        sendLabel="Send credit note"
      />
    </>
  )
}
