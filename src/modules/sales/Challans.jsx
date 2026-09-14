/**
 * Delivery challans — dispatch against sales orders. Saving reduces stock in the
 * selected warehouse through the mock stock engine (frontend-only demo).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, FileText, MoreHorizontal, PackageCheck, Pencil, Plus, Printer, Trash2, Truck, Clock } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock, soDeliveredQty } from '../../store/selectors.js'
import { uid } from '../../store/numbering.js'
import { fmtDate, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { STATUS, TRANSPORTERS } from '../../data/constants.js'
import { Button, Callout, Card, DataTable, DocNo, Dropdown, EmptyState, FilterPanel, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import {
  CustomerCard, DocNotFound, Fields, FormShell, RelatedDocs, SALES_CRUMB,
  customerOptions, filterDefs, lineQty, matchCommon, monthStart, partyOf, useSalesFilters, warehouseOptions,
} from './shared.jsx'

const CRUMBS = [SALES_CRUMB, { label: 'Delivery challans', to: '/sales/challans' }]
const OPEN_SO = ['Pending', 'Confirmed', 'Partially Delivered']
const EMPTY_TRANSPORT = { transporter: '', vehicleNo: '', lrNo: '', driverName: '', driverMobile: '', ewayBill: '' }

function useChallanActions() {
  const { state, patch, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  const invoiced = (dc) => state.salesInvoices.some((i) => i.dcId === dc.id)
  return {
    invoiced,
    markDelivered: (dc) => {
      patch('deliveryChallans', dc.id, { status: 'Delivered', deliveredAt: new Date().toISOString() })
      toast.success('Challan marked as delivered', `${dc.number} reached the customer.`)
    },
    del: async (dc, after) => {
      if (invoiced(dc)) {
        toast.error('This challan can’t be deleted', 'An invoice was raised against it. Delete the invoice first.')
        return
      }
      const ok = await confirm({ title: 'Delete delivery challan?', message: `${dc.number} will be removed and its quantity returned to stock.`, confirmLabel: 'Delete', tone: 'danger' })
      if (!ok) return
      remove('deliveryChallans', dc.id)
      toast.success('Delivery challan deleted', `${dc.number} removed, stock restored.`)
      after?.()
    },
  }
}

/* ---------------- List ---------------- */
export function ChallanList() {
  usePageTitle('Delivery challans')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const f = useSalesFilters()
  const act = useChallanActions()
  const customers = byId(state.customers)
  const orders = byId(state.salesOrders)
  const warehouses = byId(state.warehouses)

  const all = useMemo(
    () => state.deliveryChallans.map((d) => ({ ...d, _customer: customers.get(d.customerId), _so: orders.get(d.soId), _qty: lineQty(d.lines, 'deliveredQty') })),
    [state.deliveryChallans, customers, orders],
  )
  const rows = useMemo(() => all.filter((d) => matchCommon(d, { ...f.values, salesPerson: '' }, d.status)), [all, f.values])
  const t = today()

  const columns = [
    { key: 'number', header: 'DC no.', render: (r) => <DocNo to={`/sales/challans/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'customer', header: 'Customer', accessor: (r) => r._customer?.name, render: (r) => (<><div className="cell-primary">{r._customer?.name}</div><div className="cell-secondary">{r._customer?.city}</div></>) },
    { key: 'so', header: 'Sales order', accessor: (r) => r._so?.number, render: (r) => (r._so ? <DocNo to={`/sales/orders/${r._so.id}`}>{r._so.number}</DocNo> : '—') },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => warehouses.get(r.warehouseId)?.name },
    { key: 'vehicle', header: 'Transport', accessor: (r) => r.transport?.vehicleNo, render: (r) => (<><div className="cell-primary">{r.transport?.transporter || '—'}</div><div className="cell-secondary mono">{r.transport?.vehicleNo}</div></>) },
    { key: 'qty', header: 'Qty', align: 'right', accessor: (r) => r._qty, render: (r) => <span className="num">{num(r._qty)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const rowActions = (r) => [
    { label: 'View details', icon: Eye, onClick: () => navigate(`/sales/challans/${r.id}`) },
    can('Sales', 'edit') && r.status === 'Dispatched' && { label: 'Mark as delivered', icon: CheckCircle2, onClick: () => act.markDelivered(r) },
    can('Sales', 'add') && !act.invoiced(r) && { label: 'Create invoice', icon: FileText, onClick: () => navigate(`/sales/invoices/new?dc=${r.id}`) },
    { label: 'Print', icon: Printer, onClick: () => navigate(`/sales/challans/${r.id}?print=1`) },
    can('Sales', 'edit') && !act.invoiced(r) && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/challans/${r.id}/edit`) },
    can('Sales', 'delete') && { divider: true },
    can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(r) },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Delivery challans"
        subtitle="Goods dispatched against sales orders. Each challan reduces stock in its warehouse."
        breadcrumbs={[SALES_CRUMB, { label: 'Delivery challans' }]}
        actions={can('Sales', 'add') && <Button variant="primary" icon={Plus} to="/sales/challans/new">New delivery challan</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Dispatched today" value={all.filter((d) => d.date === t).length} icon={Truck} tone="blue" foot={`${num(all.filter((d) => d.date === t).reduce((a, d) => a + d._qty, 0))} units`} />
        <StatCard label="In transit" value={all.filter((d) => d.status === 'Dispatched').length} icon={Clock} tone="amber" foot="Awaiting delivery confirmation" />
        <StatCard label="Delivered this month" value={all.filter((d) => d.date >= monthStart() && d.status !== 'Dispatched').length} icon={PackageCheck} tone="green" foot="Delivered or invoiced" />
        <StatCard label="Pending invoicing" value={all.filter((d) => !act.invoiced(d)).length} icon={FileText} tone="violet" foot="Challans without an invoice" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/sales/challans/${r.id}`)}
        rowActions={rowActions}
        exportName="delivery-challans"
        searchPlaceholder="Search DC no., customer, vehicle…"
        filters={<FilterPanel filters={filterDefs(state, STATUS.challan)} values={f.values} onChange={f.onChange} onReset={f.reset} />}
        emptyTitle="No delivery challans match"
        emptyDescription="Dispatch goods against a confirmed sales order."
        emptyAction={can('Sales', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/sales/challans/new">New delivery challan</Button>}
      />
    </>
  )
}

/* ---------------- Form ---------------- */
function buildLines(state, so, existing, warehouseId) {
  const prev = {}
  state.deliveryChallans
    .filter((d) => d.soId === so.id && d.id !== existing?.id)
    .forEach((d) => d.lines.forEach((l) => { prev[l.itemId] = (prev[l.itemId] || 0) + (Number(l.deliveredQty) || 0) }))
  return so.lines.map((l) => {
    const already = prev[l.itemId] || 0
    const pending = Math.max(0, Number(l.qty) - already)
    const ex = existing?.lines.find((x) => x.itemId === l.itemId)
    const available = itemStock(state, l.itemId, warehouseId) + (existing && existing.warehouseId === warehouseId ? Number(ex?.deliveredQty) || 0 : 0)
    return {
      id: ex?.id || uid('ln'),
      itemId: l.itemId,
      orderedQty: Number(l.qty),
      prevDelivered: already,
      deliveredQty: ex ? Number(ex.deliveredQty) : Math.max(0, Math.min(pending, Math.floor(available))),
      rate: l.rate,
    }
  })
}

export function ChallanForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('deliveryChallans', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New delivery challan')

  const [doc, setDoc] = useState(() => {
    if (existing) {
      const so = get('salesOrders', existing.soId)
      return { ...existing, transport: { ...EMPTY_TRANSPORT, ...existing.transport }, lines: so ? buildLines(state, so, existing, existing.warehouseId) : existing.lines.map((l) => ({ ...l, prevDelivered: 0 })) }
    }
    const base = { date: today(), customerId: '', soId: '', warehouseId: 'wh-fgg', lines: [], transport: { ...EMPTY_TRANSPORT, transporter: TRANSPORTERS[0] }, remarks: '', status: 'Dispatched' }
    const so = params.get('so') ? get('salesOrders', params.get('so')) : null
    if (so) return { ...base, customerId: so.customerId, soId: so.id, lines: buildLines(state, so, null, base.warehouseId) }
    return base
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !existing) return <DocNotFound label="Delivery challan" to="/sales/challans" />

  const items = byId(state.items)
  const customer = get('customers', doc.customerId)
  const so = doc.soId ? get('salesOrders', doc.soId) : null
  const soOptions = state.salesOrders
    .filter((o) => o.customerId === doc.customerId && (OPEN_SO.includes(o.status) || o.id === doc.soId))
    .map((o) => ({ value: o.id, label: `${o.number}, ${fmtDate(o.date)}` }))

  const availableFor = (l) =>
    itemStock(state, l.itemId, doc.warehouseId) + (existing && existing.warehouseId === doc.warehouseId ? Number(existing.lines.find((x) => x.itemId === l.itemId)?.deliveredQty) || 0 : 0)

  const set = (k, v) => {
    setErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'customerId') {
      setDoc((d) => ({ ...d, customerId: v, soId: '', lines: [] }))
    } else if (k === 'soId') {
      const o = get('salesOrders', v)
      setDoc((d) => ({ ...d, soId: v, customerId: o?.customerId || d.customerId, lines: o ? buildLines(state, o, existing, d.warehouseId) : [] }))
    } else if (['transporter', 'vehicleNo', 'lrNo', 'driverName', 'driverMobile', 'ewayBill'].includes(k)) {
      setDoc((d) => ({ ...d, transport: { ...d.transport, [k]: v } }))
    } else {
      setDoc((d) => ({ ...d, [k]: v }))
    }
  }
  const setQty = (idx, v) => {
    setDoc((d) => ({ ...d, lines: d.lines.map((l, i) => (i === idx ? { ...l, deliveredQty: v === '' ? '' : Number(v) } : l)) }))
    setErrors((e) => ({ ...e, lines: undefined, [`line${idx}`]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!doc.customerId) errs.customerId = 'Select a customer'
    if (!doc.soId) errs.soId = 'Select a sales order'
    if (!doc.date) errs.date = 'Enter the challan date'
    if (!doc.warehouseId) errs.warehouseId = 'Select a warehouse'
    doc.lines.forEach((l, i) => {
      const q = Number(l.deliveredQty) || 0
      const pending = l.orderedQty - l.prevDelivered
      if (q < 0) errs[`line${i}`] = 'Quantity can’t be negative'
      else if (q > pending) errs[`line${i}`] = `Only ${num(pending)} pending`
      else if (q > availableFor(l)) errs[`line${i}`] = `Only ${num(availableFor(l))} in stock`
    })
    if (doc.soId && !doc.lines.some((l) => Number(l.deliveredQty) > 0)) errs.lines = 'Enter a delivered quantity for at least one item'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay()
    const record = {
      ...doc,
      lines: doc.lines.map(({ prevDelivered, ...l }) => ({ ...l, deliveredQty: Number(l.deliveredQty) || 0 })),
      transport: { ...doc.transport, destination: customer?.city, dispatchedAt: doc.transport.dispatchedAt || new Date().toISOString() },
    }
    const saved = save('deliveryChallans', record)
    setSaving(false)
    toast.success('Delivery challan saved, stock updated', `${saved.number}: ${num(lineQty(record.lines, 'deliveredQty'))} units dispatched from ${get('warehouses', doc.warehouseId)?.name}.`)
    navigate(`/sales/challans/${saved.id}`)
  }

  const transport = doc.transport
  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New delivery challan'}
        subtitle="Quantities default to what is pending on the order and available in the warehouse."
        breadcrumbs={[...CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      <FormShell
        onSubmit={submit}
        main={
          <>
            <Card title="Challan details">
              <Fields
                values={doc}
                errors={errors}
                onChange={set}
                defs={[
                  { name: 'number', label: 'DC no.', readOnly: true, value: existing?.number || previewNumber('deliveryChallans', doc.date) },
                  { name: 'date', label: 'Challan date', type: 'date', required: true },
                  { name: 'warehouseId', label: 'Dispatch from', type: 'select', required: true, options: warehouseOptions(state, doc.warehouseId) },
                  { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customerOptions(state, doc.customerId), placeholder: 'Select customer', span: 2 },
                  { name: 'soId', label: 'Sales order', type: 'select', required: true, options: soOptions, placeholder: doc.customerId ? (soOptions.length ? 'Select sales order' : 'No open orders') : 'Select customer first' },
                ]}
              />
            </Card>
            <Card title="Items to dispatch" subtitle={so ? `Against ${so.number}` : 'Select a sales order to load its items'} flush>
              {doc.lines.length === 0 ? (
                <EmptyState compact icon={Truck} title="No items loaded" description="Choose a customer and one of their open sales orders." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="align-right">Ordered</th>
                        <th className="align-right">Delivered earlier</th>
                        <th className="align-right">Pending</th>
                        <th className="align-right">In stock</th>
                        <th style={{ width: 130 }}>Deliver now</th>
                        <th className="align-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.lines.map((l, i) => {
                        const it = items.get(l.itemId)
                        const pending = l.orderedQty - l.prevDelivered
                        const available = availableFor(l)
                        const q = Number(l.deliveredQty) || 0
                        return (
                          <tr key={l.id}>
                            <td><div className="cell-primary">{it?.name}</div><div className="cell-secondary">{it?.code}, {it?.unit}</div></td>
                            <td className="align-right num">{num(l.orderedQty)}</td>
                            <td className="align-right num">{num(l.prevDelivered)}</td>
                            <td className="align-right num strong">{num(pending)}</td>
                            <td className={`align-right num ${available < pending ? 'text-amber' : ''}`}>{num(available)}</td>
                            <td>
                              <input className={`input input-sm ${errors[`line${i}`] ? 'has-error' : ''}`} type="number" min="0" step="any" value={l.deliveredQty} onChange={(e) => setQty(i, e.target.value)} aria-label={`Deliver now for ${it?.name}`} />
                              {errors[`line${i}`] && <div className="field-error">{errors[`line${i}`]}</div>}
                              {!errors[`line${i}`] && q > available && <div className="field-error">Only {num(available)} in stock</div>}
                            </td>
                            <td className="align-right num">{num(Math.max(0, pending - q))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.lines && <div className="card-body"><span className="field-error">{errors.lines}</span></div>}
              {doc.lines.some((l) => availableFor(l) < l.orderedQty - l.prevDelivered) && (
                <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
                  <Callout tone="amber">Some items don’t have enough stock in this warehouse. Dispatch what is available now and raise another challan for the balance.</Callout>
                </div>
              )}
            </Card>
            <Card title="Transport details">
              <Fields
                values={transport}
                onChange={set}
                defs={[
                  { name: 'transporter', label: 'Transporter', type: 'select', options: TRANSPORTERS },
                  { name: 'vehicleNo', label: 'Vehicle no.', placeholder: 'UP81 AT 4521', uppercase: true },
                  { name: 'lrNo', label: 'LR no.', placeholder: 'LR-58213' },
                  { name: 'driverName', label: 'Driver name', placeholder: 'Rakesh Yadav' },
                  { name: 'driverMobile', label: 'Driver mobile', type: 'tel', placeholder: '+91 98370 41256' },
                  { name: 'ewayBill', label: 'E-way bill no.', placeholder: '4412 5678 9012' },
                ]}
              />
              <div style={{ marginTop: 14 }}>
                <Fields cols={1} values={doc} onChange={set} defs={[{ name: 'remarks', label: 'Remarks', type: 'textarea', rows: 2, placeholder: 'Handle with care, 12 master cartons' }]} />
              </div>
            </Card>
          </>
        }
        side={
          <>
            <CustomerCard customerId={doc.customerId} />
            <Card title="Dispatch summary">
              <KeyValue
                cols={2}
                items={[
                  { label: 'Items', value: doc.lines.filter((l) => Number(l.deliveredQty) > 0).length },
                  { label: 'Units', value: num(lineQty(doc.lines, 'deliveredQty')) },
                  { label: 'Warehouse', value: get('warehouses', doc.warehouseId)?.name, span: 2 },
                ]}
              />
              <Callout tone="gray" style={{ marginTop: 12 }}>Saving this challan reduces stock in the selected warehouse immediately.</Callout>
            </Card>
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(existing ? `/sales/challans/${existing.id}` : '/sales/challans')} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving} icon={Truck}>Save delivery challan</Button>
          </>
        }
      />
    </>
  )
}

/* ---------------- View ---------------- */
export function ChallanView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, get } = useErp()
  const { can } = useAuth()
  const act = useChallanActions()
  const dc = get('deliveryChallans', id)
  usePageTitle(dc?.number || 'Delivery challan')
  const [preview, setPreview] = useState(params.get('print') === '1')

  if (!dc) return <DocNotFound label="Delivery challan" to="/sales/challans" />

  const customer = get('customers', dc.customerId)
  const so = get('salesOrders', dc.soId)
  const warehouse = get('warehouses', dc.warehouseId)
  const items = byId(state.items)
  const totalDelivered = so ? soDeliveredQty(state, so.id) : {}
  const invoiced = act.invoiced(dc)
  const tr = dc.transport || {}
  const pendingOf = (l) => Math.max(0, Number(l.orderedQty) - (totalDelivered[l.itemId] ?? Number(l.deliveredQty)))

  return (
    <>
      <PageHeader
        title={dc.number}
        badge={<StatusBadge status={dc.status} />}
        subtitle={`${customer?.name || 'Customer'}, dispatched on ${fmtDate(dc.date)}`}
        breadcrumbs={[...CRUMBS, { label: dc.number }]}
        actions={
          <>
            {can('Sales', 'edit') && dc.status === 'Dispatched' && <Button icon={CheckCircle2} onClick={() => act.markDelivered(dc)}>Mark as delivered</Button>}
            <Button icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            {can('Sales', 'add') && !invoiced && <Button variant="primary" icon={FileText} onClick={() => navigate(`/sales/invoices/new?dc=${dc.id}`)}>Create invoice</Button>}
            <Dropdown
              width={170}
              items={[
                can('Sales', 'edit') && { label: 'Edit', icon: Pencil, disabled: invoiced, onClick: () => navigate(`/sales/challans/${dc.id}/edit`) },
                can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => act.del(dc, () => navigate('/sales/challans')) },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} aria-label="More actions" iconOnly />}
            />
          </>
        }
      />
      <div className="sales-split">
        <div className="stack">
          <Card title="Challan details">
            <KeyValue
              cols={4}
              items={[
                { label: 'Challan date', value: fmtDate(dc.date) },
                { label: 'Sales order', value: so ? <DocNo to={`/sales/orders/${so.id}`}>{so.number}</DocNo> : '—' },
                { label: 'Dispatched from', value: warehouse?.name },
                { label: 'Units delivered', value: num(lineQty(dc.lines, 'deliveredQty')) },
                { label: 'Customer PO no.', value: so?.customerPoNo },
                { label: 'Created by', value: dc.createdBy },
                { label: 'Remarks', value: dc.remarks, span: 2 },
              ]}
            />
          </Card>
          <Card title="Transport">
            <KeyValue
              cols={3}
              items={[
                { label: 'Transporter', value: tr.transporter },
                { label: 'Vehicle no.', value: tr.vehicleNo && <span className="mono">{tr.vehicleNo}</span> },
                { label: 'LR no.', value: tr.lrNo },
                { label: 'Driver', value: tr.driverName },
                { label: 'Driver mobile', value: tr.driverMobile },
                { label: 'E-way bill no.', value: tr.ewayBill && <span className="mono">{tr.ewayBill}</span> },
              ]}
            />
          </Card>
          <Card title="Items dispatched" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unit</th>
                    <th className="align-right">Ordered</th>
                    <th className="align-right">Delivered on this challan</th>
                    <th className="align-right">Pending on order</th>
                  </tr>
                </thead>
                <tbody>
                  {dc.lines.map((l) => {
                    const it = items.get(l.itemId)
                    return (
                      <tr key={l.id}>
                        <td><div className="cell-primary">{it?.name}</div><div className="cell-secondary">{it?.code}, HSN {it?.hsn}</div></td>
                        <td>{it?.unit}</td>
                        <td className="align-right num">{num(l.orderedQty)}</td>
                        <td className="align-right num strong">{num(l.deliveredQty)}</td>
                        <td className="align-right num">{num(pendingOf(l))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="stack">
          <CustomerCard customerId={dc.customerId} />
          <RelatedDocs type="dc" doc={dc} />
        </div>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        title="Delivery Challan"
        subtitle="Not a tax invoice"
        numberLabel="Challan No."
        number={dc.number}
        date={dc.date}
        meta={[
          { label: 'Sales order', value: so?.number },
          { label: 'Customer PO', value: so?.customerPoNo },
          { label: 'E-way bill', value: tr.ewayBill },
        ]}
        party={partyOf(customer, 'Consignee')}
        shipTo={{
          heading: 'Transport',
          name: tr.transporter || 'Transport',
          address: [tr.vehicleNo && `Vehicle ${tr.vehicleNo}`, tr.lrNo && `LR ${tr.lrNo}`].filter(Boolean).join(', '),
          right: [
            { label: 'Driver', value: tr.driverName },
            { label: 'Driver mobile', value: tr.driverMobile },
            { label: 'Dispatched from', value: warehouse?.name },
          ],
        }}
        lines={dc.lines}
        columns={[
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'Ordered', align: 'right', render: (l) => num(l.orderedQty) },
          { header: 'Delivered', align: 'right', render: (l) => <b>{num(l.deliveredQty)}</b> },
          { header: 'Pending', align: 'right', render: (l) => num(pendingOf(l)) },
        ]}
        terms={'Goods are dispatched against the above sales order.\nReceived the above goods in good condition and correct quantity.\n\nReceiver’s signature and stamp: ____________________'}
        sendLabel="Send challan"
      />
    </>
  )
}
