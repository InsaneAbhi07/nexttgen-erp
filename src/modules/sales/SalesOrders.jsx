/**
 * Sales orders — list, form and detail (frontend-only demo; saved to the mock store).
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Eye, FileText, IndianRupee, MoreHorizontal, Pencil, Plus, Printer, Trash2, Truck, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock, soDeliveredQty } from '../../store/selectors.js'
import { uid } from '../../store/numbering.js'
import { calcTotals, isInterState } from '../../utils/calc.js'
import { addDays, fmtDate, inr, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { SALES_PERSONS, STATUS } from '../../data/constants.js'
import { Button, Callout, Card, DataTable, DocNo, Dropdown, FilterPanel, KeyValue, PageHeader, Progress, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import LineItemsEditor, { cleanLines, newLine } from '../../components/common/LineItemsEditor.jsx'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import {
  CustomerCard, DocNotFound, Fields, FormShell, LinesTable, RelatedDocs, SALES_CRUMB,
  customerOptions, filterDefs, isSellable, lineQty, matchCommon, monthStart, partyOf, salesPersonFilter, useSalesFilters,
} from './shared.jsx'

const CRUMBS = [SALES_CRUMB, { label: 'Sales orders', to: '/sales/orders' }]
const OPEN = ['Pending', 'Confirmed', 'Partially Delivered']

function useOrderActions() {
  const { state, patch, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  const linked = (so) => state.deliveryChallans.some((d) => d.soId === so.id) || state.salesInvoices.some((i) => i.soId === so.id)
  return {
    linked,
    confirmOrder: (so) => {
      patch('salesOrders', so.id, { status: 'Confirmed' })
      toast.success('Sales order confirmed', `${so.number} is ready for dispatch.`)
    },
    cancel: async (so) => {
      if (linked(so)) {
        toast.error('This order can’t be cancelled', 'A delivery challan or invoice already exists for it.')
        return
      }
      const ok = await confirm({ title: 'Cancel sales order?', message: `${so.number} will be marked as cancelled. Stock is not affected.`, confirmLabel: 'Cancel order', cancelLabel: 'Keep order', tone: 'danger' })
      if (!ok) return
      patch('salesOrders', so.id, { status: 'Cancelled' })
      toast.success('Sales order cancelled', so.number)
    },
    del: async (so, after) => {
      if (linked(so)) {
        toast.error('This order can’t be deleted', 'Delete its delivery challans and invoices first.')
        return
      }
      const ok = await confirm({ title: 'Delete sales order?', message: `${so.number} will be removed from the demo data. This can’t be undone.`, confirmLabel: 'Delete', tone: 'danger' })
      if (!ok) return
      remove('salesOrders', so.id)
      toast.success('Sales order deleted', so.number)
      after?.()
    },
  }
}

/* ---------------- List ---------------- */
export function SalesOrderList() {
  usePageTitle('Sales orders')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const f = useSalesFilters()
  const act = useOrderActions()
  const customers = byId(state.customers)

  const deliveredBySo = useMemo(() => {
    const m = {}
    state.deliveryChallans.forEach((d) => {
      if (d.soId) m[d.soId] = (m[d.soId] || 0) + lineQty(d.lines, 'deliveredQty')
    })
    return m
  }, [state.deliveryChallans])

  const all = useMemo(
    () =>
      state.salesOrders.map((o) => {
        const ordered = lineQty(o.lines)
        return { ...o, _customer: customers.get(o.customerId), _pct: ordered ? Math.min(100, ((deliveredBySo[o.id] || 0) / ordered) * 100) : 0 }
      }),
    [state.salesOrders, customers, deliveredBySo],
  )
  const rows = useMemo(() => all.filter((o) => matchCommon(o, f.values, o.status)), [all, f.values])

  const open = all.filter((o) => OPEN.includes(o.status))
  const week = open.filter((o) => o.deliveryDate <= addDays(today(), 7))
  const late = open.filter((o) => o.deliveryDate < today())
  const month = all.filter((o) => o.date >= monthStart() && o.status !== 'Cancelled')

  const columns = [
    { key: 'number', header: 'SO no.', render: (r) => <DocNo to={`/sales/orders/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'customer', header: 'Customer', accessor: (r) => r._customer?.name, render: (r) => (<><div className="cell-primary">{r._customer?.name}</div><div className="cell-secondary">{r._customer?.city}</div></>) },
    { key: 'deliveryDate', header: 'Delivery date', render: (r) => <span className={OPEN.includes(r.status) && r.deliveryDate < today() ? 'text-red' : ''}>{fmtDate(r.deliveryDate)}</span> },
    { key: 'salesPerson', header: 'Sales person' },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.totals.grandTotal, render: (r) => <span className="num strong">{inr(r.totals.grandTotal)}</span> },
    { key: 'progress', header: 'Delivered', accessor: (r) => Math.round(r._pct), render: (r) => (<div className="row" style={{ gap: 8, minWidth: 110 }}><Progress value={r._pct} style={{ flex: 1 }} /><span className="tiny muted num">{Math.round(r._pct)}%</span></div>) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const rowActions = (r) => [
    { label: 'View details', icon: Eye, onClick: () => navigate(`/sales/orders/${r.id}`) },
    can('Sales', 'edit') && ['Pending', 'Confirmed'].includes(r.status) && !act.linked(r) && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/orders/${r.id}/edit`) },
    can('Sales', 'approve') && r.status === 'Pending' && { label: 'Confirm order', icon: CheckCircle2, onClick: () => act.confirmOrder(r) },
    can('Sales', 'add') && OPEN.includes(r.status) && { label: 'Create delivery challan', icon: Truck, onClick: () => navigate(`/sales/challans/new?so=${r.id}`) },
    can('Sales', 'add') && !['Cancelled', 'Invoiced'].includes(r.status) && { label: 'Create invoice', icon: FileText, onClick: () => navigate(`/sales/invoices/new?so=${r.id}`) },
    { label: 'Print', icon: Printer, onClick: () => navigate(`/sales/orders/${r.id}?print=1`) },
    can('Sales', 'edit') && OPEN.includes(r.status) && { label: 'Cancel order', icon: XCircle, onClick: () => act.cancel(r) },
    can('Sales', 'delete') && { divider: true },
    can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(r) },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Sales orders"
        subtitle="Confirmed customer orders waiting for dispatch and invoicing."
        breadcrumbs={[SALES_CRUMB, { label: 'Sales orders' }]}
        actions={can('Sales', 'add') && <Button variant="primary" icon={Plus} to="/sales/orders/new">New sales order</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Open orders" value={open.length} icon={ClipboardList} tone="blue" foot={`${inr(open.reduce((a, o) => a + o.totals.grandTotal, 0))} to fulfil`} />
        <StatCard label="Due this week" value={week.length} icon={CalendarClock} tone="amber" foot="Delivery date within 7 days" />
        <StatCard label="Late deliveries" value={late.length} icon={AlertTriangle} tone="red" foot="Past the promised delivery date" />
        <StatCard label="Booked this month" value={inr(month.reduce((a, o) => a + o.totals.grandTotal, 0))} icon={IndianRupee} tone="green" foot={`${month.length} orders`} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/sales/orders/${r.id}`)}
        rowActions={rowActions}
        exportName="sales-orders"
        searchPlaceholder="Search SO no., customer…"
        filters={<FilterPanel filters={filterDefs(state, STATUS.salesOrder, [salesPersonFilter])} values={f.values} onChange={f.onChange} onReset={f.reset} />}
        emptyTitle="No sales orders match"
        emptyDescription="Create a sales order or convert an accepted quotation."
        emptyAction={can('Sales', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/sales/orders/new">New sales order</Button>}
      />
    </>
  )
}

/* ---------------- Form ---------------- */
export function SalesOrderForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('salesOrders', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New sales order')

  const [doc, setDoc] = useState(() => {
    if (existing) return { ...existing, lines: existing.lines.map((l) => ({ ...l })) }
    const base = { date: today(), deliveryDate: addDays(today(), 7), customerId: params.get('customer') || '', salesPerson: SALES_PERSONS[0], customerPoNo: '', quotationId: null, lines: [newLine()], remarks: '', status: 'Pending' }
    const q = params.get('quotation') ? get('quotations', params.get('quotation')) : null
    if (q) {
      return { ...base, customerId: q.customerId, salesPerson: q.salesPerson || base.salesPerson, quotationId: q.id, lines: q.lines.map((l) => ({ ...l, id: uid('ln') })), remarks: q.notes || '' }
    }
    return base
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !existing) return <DocNotFound label="Sales order" to="/sales/orders" />

  const customer = get('customers', doc.customerId)
  const quotation = doc.quotationId ? get('quotations', doc.quotationId) : null
  const lines = cleanLines(doc.lines)
  const totals = calcTotals(lines, { interState: isInterState(customer?.state) })
  const items = byId(state.items)
  const shortages = lines
    .map((l) => ({ line: l, item: items.get(l.itemId), available: itemStock(state, l.itemId, 'wh-fgg') }))
    .filter((s) => Number(s.line.qty) > s.available)
  const hasBom = (itemId) => state.boms.some((b) => b.productId === itemId && b.status === 'Active')

  const set = (k, v) => {
    setDoc((d) => ({ ...d, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!doc.customerId) errs.customerId = 'Select a customer'
    if (!doc.date) errs.date = 'Enter the order date'
    if (!doc.deliveryDate) errs.deliveryDate = 'Enter the delivery date'
    else if (doc.deliveryDate < doc.date) errs.deliveryDate = 'Must be on or after the order date'
    if (!lines.length) errs.lines = 'Add at least one item with quantity'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay()
    const saved = save('salesOrders', { ...doc, lines, totals }, existing ? {} : { notify: { type: 'sales', title: 'New sales order', message: `${previewNumber('salesOrders', doc.date)} from ${customer.name} for ${inr(totals.grandTotal)}.`, link: '/sales/orders' } })
    setSaving(false)
    toast.success(existing ? 'Sales order updated' : 'Sales order saved', `${saved.number} for ${customer.name}, ${inr(totals.grandTotal)}.`)
    navigate(`/sales/orders/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New sales order'}
        subtitle="Stock shown is from the Finished Goods Godown."
        breadcrumbs={[...CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      <FormShell
        onSubmit={submit}
        main={
          <>
            {quotation && (
              <Callout>
                Created from quotation <DocNo to={`/sales/quotations/${quotation.id}`}>{quotation.number}</DocNo>. Items and prices were copied; the quotation will be marked as converted when you save.
              </Callout>
            )}
            <Card title="Order details">
              <Fields
                values={doc}
                errors={errors}
                onChange={set}
                defs={[
                  { name: 'number', label: 'SO no.', readOnly: true, value: existing?.number || previewNumber('salesOrders', doc.date) },
                  { name: 'date', label: 'Order date', type: 'date', required: true },
                  { name: 'deliveryDate', label: 'Delivery date', type: 'date', required: true },
                  { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customerOptions(state, doc.customerId), placeholder: 'Select customer', span: 2 },
                  { name: 'salesPerson', label: 'Sales person', type: 'select', options: SALES_PERSONS },
                  { name: 'customerPoNo', label: 'Customer PO no.', placeholder: 'SHARMA/PO/412' },
                ]}
              />
            </Card>
            <Card title="Items" subtitle="Finished goods and trading goods">
              <LineItemsEditor lines={doc.lines} onChange={(l) => set('lines', l)} rateField="salesRate" itemFilter={isSellable} stockWarehouseId="wh-fgg" error={errors.lines} />
              {shortages.length > 0 && (
                <Callout tone="amber" style={{ marginTop: 12 }}>
                  <div className="strong" style={{ marginBottom: 4 }}>Not enough stock for {shortages.length} item(s)</div>
                  {shortages.map((s) => {
                    const short = Number(s.line.qty) - s.available
                    return (
                      <div key={s.line.id}>
                        {s.item?.name}: short by {num(short)} {s.item?.unit}
                        {s.item?.type === 'Finished Good' && hasBom(s.item.id) && (
                          <> (<Link to={`/production/orders/new?product=${s.item.id}&qty=${Math.ceil(short)}`}>plan production</Link>)</>
                        )}
                      </div>
                    )
                  })}
                </Callout>
              )}
            </Card>
            <Card title="Remarks">
              <Fields cols={1} values={doc} onChange={set} defs={[{ name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Pack in master cartons with party marking' }]} />
            </Card>
          </>
        }
        side={
          <>
            <CustomerCard customerId={doc.customerId} />
            <Card title="Order total" subtitle={customer ? (totals.interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST + SGST apply') : 'Select a customer to apply GST'}>
              <TotalsSummary totals={totals} showWords />
            </Card>
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(existing ? `/sales/orders/${existing.id}` : '/sales/orders')} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save sales order</Button>
          </>
        }
      />
    </>
  )
}

/* ---------------- View ---------------- */
export function SalesOrderView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, get } = useErp()
  const { can } = useAuth()
  const act = useOrderActions()
  const so = get('salesOrders', id)
  usePageTitle(so?.number || 'Sales order')
  const [preview, setPreview] = useState(params.get('print') === '1')

  if (!so) return <DocNotFound label="Sales order" to="/sales/orders" />

  const customer = get('customers', so.customerId)
  const quotation = so.quotationId ? get('quotations', so.quotationId) : null
  const items = byId(state.items)
  const delivered = soDeliveredQty(state, so.id)
  const pendingTotal = so.lines.reduce((a, l) => a + Math.max(0, Number(l.qty) - (delivered[l.itemId] || 0)), 0)
  const hasInvoice = state.salesInvoices.some((i) => i.soId === so.id)
  const linked = act.linked(so)
  const late = OPEN.includes(so.status) && so.deliveryDate < today()

  return (
    <>
      <PageHeader
        title={so.number}
        badge={<StatusBadge status={so.status} />}
        subtitle={`${customer?.name || 'Customer'}, ordered on ${fmtDate(so.date)}`}
        breadcrumbs={[...CRUMBS, { label: so.number }]}
        actions={
          <>
            {can('Sales', 'approve') && so.status === 'Pending' && <Button icon={CheckCircle2} onClick={() => act.confirmOrder(so)}>Confirm order</Button>}
            <Button icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            {can('Sales', 'add') && !['Cancelled', 'Invoiced'].includes(so.status) && !hasInvoice && (
              <Button icon={FileText} onClick={() => navigate(`/sales/invoices/new?so=${so.id}`)}>Create invoice</Button>
            )}
            {can('Sales', 'add') && OPEN.includes(so.status) && pendingTotal > 0 && (
              <Button variant="primary" icon={Truck} onClick={() => navigate(`/sales/challans/new?so=${so.id}`)}>Create delivery challan</Button>
            )}
            <Dropdown
              width={190}
              items={[
                can('Sales', 'edit') && { label: 'Edit', icon: Pencil, disabled: linked || !['Pending', 'Confirmed'].includes(so.status), onClick: () => navigate(`/sales/orders/${so.id}/edit`) },
                can('Sales', 'edit') && { label: 'Cancel order', icon: XCircle, disabled: !OPEN.includes(so.status), onClick: () => act.cancel(so) },
                can('Sales', 'delete') && { divider: true },
                can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(so, () => navigate('/sales/orders')) },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} aria-label="More actions" iconOnly />}
            />
          </>
        }
      />

      <div className="sales-split">
        <div className="stack">
          {late && <Callout tone="red">Delivery was promised for {fmtDate(so.deliveryDate)}. {num(pendingTotal)} units are still pending dispatch.</Callout>}
          {so.status === 'Cancelled' && <Callout tone="gray">This order was cancelled. {so.remarks}</Callout>}
          <Card title="Order details">
            <KeyValue
              cols={4}
              items={[
                { label: 'Order date', value: fmtDate(so.date) },
                { label: 'Delivery date', value: <span className={late ? 'text-red' : ''}>{fmtDate(so.deliveryDate)}</span> },
                { label: 'Sales person', value: so.salesPerson },
                { label: 'Customer PO no.', value: so.customerPoNo },
                { label: 'Quotation', value: quotation ? <DocNo to={`/sales/quotations/${quotation.id}`}>{quotation.number}</DocNo> : null },
                { label: 'Grand total', value: inr(so.totals.grandTotal) },
                { label: 'Created by', value: so.createdBy },
                { label: 'Remarks', value: so.remarks },
              ]}
            />
          </Card>
          <Card title="Delivery progress" subtitle={`${num(pendingTotal)} units pending`} flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="align-right">Ordered</th>
                    <th className="align-right">Delivered</th>
                    <th className="align-right">Pending</th>
                    <th style={{ width: 150 }}>Progress</th>
                    <th className="align-right">In FG godown</th>
                  </tr>
                </thead>
                <tbody>
                  {so.lines.map((l) => {
                    const it = items.get(l.itemId)
                    const d = delivered[l.itemId] || 0
                    const pending = Math.max(0, Number(l.qty) - d)
                    const stock = itemStock(state, l.itemId, 'wh-fgg')
                    return (
                      <tr key={l.id}>
                        <td><div className="cell-primary">{it?.name}</div><div className="cell-secondary">{it?.code}</div></td>
                        <td className="align-right num">{num(l.qty)} <span className="muted small">{it?.unit}</span></td>
                        <td className="align-right num">{num(d)}</td>
                        <td className="align-right num strong">{num(pending)}</td>
                        <td><Progress value={(d / Number(l.qty)) * 100} /></td>
                        <td className={`align-right num ${pending > stock ? 'text-red' : ''}`}>{num(stock)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Items and pricing" flush>
            <LinesTable lines={so.lines} interState={so.totals.interState} />
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <TotalsSummary totals={so.totals} showWords />
            </div>
          </Card>
        </div>
        <div className="stack">
          <CustomerCard customerId={so.customerId} />
          <RelatedDocs type="so" doc={so} />
        </div>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        title="Sales Order"
        numberLabel="SO No."
        number={so.number}
        date={so.date}
        meta={[
          { label: 'Delivery date', value: fmtDate(so.deliveryDate) },
          { label: 'Customer PO', value: so.customerPoNo },
          { label: 'Sales person', value: so.salesPerson },
        ]}
        party={partyOf(customer)}
        lines={so.lines}
        totals={so.totals}
        interState={so.totals.interState}
        notes={so.remarks}
        terms={'Prices are ex-works Aligarh.\nDelivery subject to stock availability and receipt of payment as per terms.\nSubject to Aligarh jurisdiction only.'}
        sendLabel="Send order confirmation"
      />
    </>
  )
}
