/** Goods receipt notes (GRN) — list, form and detail. Posting a GRN adds stock in the mock store. */
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Boxes, ClipboardCheck, Eye, FileText, History, MoreHorizontal, PackageCheck, PackageX, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { round2 } from '../../utils/calc.js'
import { fmtDate, fmtDateTime, inr, num, pct, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import {
  Badge, Button, Callout, Card, DataTable, DatePicker, DocNo, Dropdown, EmptyState, Field, FilterPanel, Input, KeyValue, PageHeader, Select, StatCard, Textarea,
  inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, DocTrail, MissingRecord, SupplierCard, buildPurchaseTrail, monthStart, partyFor, supplierOptions, usePrintParam, warehouseOptions } from './shared.jsx'

const LIST_CRUMBS = [CRUMB, { label: 'Goods receipt', to: '/purchase/grn' }]
const lineTotals = (g) => ({
  received: g.lines.reduce((a, l) => a + Number(l.receivedQty || 0), 0),
  rejected: g.lines.reduce((a, l) => a + Number(l.rejectedQty || 0), 0),
  accepted: g.lines.reduce((a, l) => a + Number(l.acceptedQty || 0), 0),
})

/* ------------------------------------------------------------------ */
export function GrnList() {
  usePageTitle('Goods receipt')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [filters, setFilters] = useState({ range: { preset: 'all' }, supplierId: '', warehouseId: '', status: '' })
  const suppliers = byId(state.suppliers)
  const pos = byId(state.purchaseOrders)
  const warehouses = byId(state.warehouses)
  const invoiceByGrn = useMemo(() => Object.fromEntries(state.purchaseInvoices.filter((i) => i.grnId).map((i) => [i.grnId, i])), [state.purchaseInvoices])

  const rows = useMemo(
    () =>
      state.grns
        .map((g) => ({ ...g, ...lineTotals(g), _invoice: invoiceByGrn[g.id], _supplier: suppliers.get(g.supplierId), _po: pos.get(g.poId) }))
        .filter(
          (g) =>
            inDateRange(g.date, filters.range) &&
            (!filters.supplierId || g.supplierId === filters.supplierId) &&
            (!filters.warehouseId || g.warehouseId === filters.warehouseId) &&
            (!filters.status || (filters.status === 'Invoiced' ? g._invoice : !g._invoice)),
        ),
    [state.grns, filters, invoiceByGrn, suppliers, pos],
  )

  const stats = useMemo(() => {
    const month = state.grns.filter((g) => g.date >= monthStart()).map(lineTotals)
    const received = month.reduce((a, t) => a + t.received, 0)
    const rejected = month.reduce((a, t) => a + t.rejected, 0)
    return {
      count: month.length,
      accepted: month.reduce((a, t) => a + t.accepted, 0),
      rejectRate: received ? (rejected / received) * 100 : 0,
      rejected,
      awaiting: state.grns.filter((g) => !invoiceByGrn[g.id]).length,
    }
  }, [state.grns, invoiceByGrn])

  const handleDelete = async (g) => {
    if (invoiceByGrn[g.id]) {
      toast.error('This GRN can’t be deleted', `Purchase invoice ${invoiceByGrn[g.id].number} is linked to it.`)
      return
    }
    const ok = await confirm({ title: 'Delete goods receipt?', message: `${g.number} will be removed and the received stock will be reversed.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('grns', g.id)
      toast.success('Goods receipt deleted', `${g.number} removed, stock reversed.`)
    }
  }

  const columns = [
    { key: 'number', header: 'GRN number', render: (r) => <DocNo to={`/purchase/grn/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'supplier', header: 'Supplier', accessor: (r) => r._supplier?.name, render: (r) => <span className="cell-primary">{r._supplier?.name}</span> },
    { key: 'po', header: 'Purchase order', accessor: (r) => r._po?.number, render: (r) => (r._po ? <DocNo to={`/purchase/orders/${r._po.id}`}>{r._po.number}</DocNo> : '—') },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => warehouses.get(r.warehouseId)?.name },
    { key: 'received', header: 'Received', align: 'right', render: (r) => <span className="num">{num(r.received)}</span> },
    { key: 'rejected', header: 'Rejected', align: 'right', render: (r) => <span className={`num ${r.rejected ? 'text-red' : 'muted'}`}>{num(r.rejected)}</span> },
    { key: 'accepted', header: 'Accepted', align: 'right', render: (r) => <span className="num strong">{num(r.accepted)}</span> },
    {
      key: 'invoice',
      header: 'Invoice',
      accessor: (r) => r._invoice?.number || 'Awaiting invoice',
      render: (r) => (r._invoice ? <DocNo to={`/purchase/invoices/${r._invoice.id}`}>{r._invoice.number}</DocNo> : <Badge tone="amber" dot>Awaiting invoice</Badge>),
    },
  ]

  return (
    <>
      <PageHeader
        title="Goods receipt (GRN)"
        subtitle="Material received at the gate against purchase orders. Accepted quantity is added to stock."
        breadcrumbs={[CRUMB, { label: 'Goods receipt' }]}
        actions={can('Purchase', 'add') && <Button variant="primary" icon={Plus} to="/purchase/grn/new">Receive material</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="GRNs this month" value={num(stats.count)} icon={ClipboardCheck} tone="blue" foot="Receipts posted" />
        <StatCard label="Units accepted" value={num(stats.accepted)} icon={PackageCheck} tone="green" foot="Added to stock this month" />
        <StatCard label="Rejection rate" value={pct(stats.rejectRate)} icon={PackageX} tone={stats.rejectRate > 2 ? 'red' : 'amber'} foot={`${num(stats.rejected)} units rejected in QC`} />
        <StatCard label="Awaiting invoice" value={num(stats.awaiting)} icon={FileText} tone="violet" foot="GRNs without a supplier bill" to="/purchase/invoices/new" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="goods-receipts"
        searchPlaceholder="Search GRN, PO or supplier…"
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/purchase/grn/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'supplierId', label: 'Suppliers', options: supplierOptions(state) },
              { key: 'warehouseId', label: 'Warehouses', options: warehouseOptions(state) },
              { key: 'status', label: 'Invoice status', placeholder: 'Any invoice status', options: ['Invoiced', 'Awaiting invoice'] },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({ range: { preset: 'all' }, supplierId: '', warehouseId: '', status: '' })}
          />
        }
        rowActions={(r) => [
          { label: 'View', icon: Eye, to: `/purchase/grn/${r.id}` },
          { label: 'Edit', icon: Pencil, to: `/purchase/grn/${r.id}/edit`, hidden: !can('Purchase', 'edit') || Boolean(r._invoice) },
          { label: 'Print', icon: Printer, to: `/purchase/grn/${r.id}?print=1` },
          { label: 'Create purchase invoice', icon: FileText, to: `/purchase/invoices/new?grn=${r.id}`, hidden: !can('Purchase', 'add') || Boolean(r._invoice) },
          { divider: true, hidden: !can('Purchase', 'delete') },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r), hidden: !can('Purchase', 'delete') },
        ]}
        emptyTitle="No goods receipts found"
        emptyDescription="Receive material against an approved purchase order."
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
export function GrnFormPage() {
  const { id } = useParams()
  const { search } = useLocation()
  return <GrnForm key={`${id || 'new'}${search}`} />
}

function GrnForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('grns', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'Receive material')

  const prevReceived = (poId) => {
    const m = {}
    state.grns
      .filter((g) => g.poId === poId && g.id !== existing?.id)
      .forEach((g) => g.lines.forEach((l) => {
        m[l.itemId] = (m[l.itemId] || 0) + Number(l.receivedQty || 0)
      }))
    return m
  }

  const linesFromPo = (po, current = []) => {
    const prev = prevReceived(po.id)
    return po.lines.map((l) => {
      const cur = current.find((c) => c.itemId === l.itemId)
      const pending = Math.max(0, Number(l.qty) - (prev[l.itemId] || 0))
      return {
        id: cur?.id || `${l.id}-g`,
        itemId: l.itemId,
        orderedQty: Number(l.qty),
        receivedQty: cur ? cur.receivedQty : pending,
        rejectedQty: cur ? cur.rejectedQty : 0,
        rate: l.rate,
      }
    })
  }

  const [values, setValues] = useState(() => {
    if (existing) {
      const po = get('purchaseOrders', existing.poId)
      return { ...existing, lines: po ? linesFromPo(po, existing.lines) : existing.lines.map((l) => ({ ...l })) }
    }
    const po = get('purchaseOrders', params.get('po'))
    const base = { date: today(), supplierId: '', poId: '', warehouseId: '', supplierChallanNo: '', vehicleNo: '', qcBy: 'Deepak Chauhan', remarks: '', lines: [] }
    return po ? { ...base, supplierId: po.supplierId, poId: po.id, warehouseId: po.warehouseId, lines: linesFromPo(po) } : base
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const prev = useMemo(() => (values.poId ? prevReceived(values.poId) : {}), [values.poId, state.grns]) // eslint-disable-line react-hooks/exhaustive-deps

  if (id && !existing) return <MissingRecord what="Goods receipt" to="/purchase/grn" />
  const invoiced = existing && state.purchaseInvoices.some((i) => i.grnId === existing.id)

  const supplier = get('suppliers', values.supplierId)
  const items = byId(state.items)
  const openPOs = state.purchaseOrders.filter((p) => p.supplierId === values.supplierId && (['Approved', 'Partially Received'].includes(p.status) || p.id === values.poId))
  const awaitingApproval = state.purchaseOrders.filter((p) => p.supplierId === values.supplierId && p.status === 'Submitted')
  const qcPeople = [...new Set(['Deepak Chauhan', 'Suresh Yadav', 'Ramesh Pal', ...state.users.filter((u) => ['Stores', 'Quality'].includes(u.department) && u.status === 'Active').map((u) => u.name)])]

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onSupplier = (supplierId) => setValues((s) => ({ ...s, supplierId, poId: '', lines: [] }))
  const onPo = (poId) => {
    const po = get('purchaseOrders', poId)
    setValues((s) => ({ ...s, poId, warehouseId: po?.warehouseId || s.warehouseId, lines: po ? linesFromPo(po) : [] }))
    setErrors({})
  }
  const updateLine = (idx, changes) => {
    setValues((s) => ({ ...s, lines: s.lines.map((l, i) => (i === idx ? { ...l, ...changes } : l)) }))
    setErrors((e) => ({ ...e, [`l${idx}`]: undefined, lines: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.date) errs.date = 'Enter the receipt date'
    if (!values.supplierId) errs.supplierId = 'Select a supplier'
    if (!values.poId) errs.poId = 'Select a purchase order'
    if (!values.warehouseId) errs.warehouseId = 'Select a warehouse'
    values.lines.forEach((l, i) => {
      const pending = Math.max(0, l.orderedQty - (prev[l.itemId] || 0))
      const rec = Number(l.receivedQty) || 0
      const rej = Number(l.rejectedQty) || 0
      if (rec < 0 || rej < 0) errs[`l${i}`] = 'Quantities can’t be negative'
      else if (rec > pending) errs[`l${i}`] = `Only ${num(pending)} pending on the PO`
      else if (rej > rec) errs[`l${i}`] = 'Rejected can’t exceed received'
    })
    if (values.poId && !values.lines.some((l) => Number(l.receivedQty) > 0)) errs.lines = 'Enter the received quantity for at least one item'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay()
    const lines = values.lines
      .filter((l) => Number(l.receivedQty) > 0)
      .map((l) => {
        const receivedQty = round2(Number(l.receivedQty))
        const rejectedQty = round2(Number(l.rejectedQty) || 0)
        return { id: l.id, itemId: l.itemId, orderedQty: l.orderedQty, receivedQty, rejectedQty, acceptedQty: round2(receivedQty - rejectedQty), rate: l.rate }
      })
    const rec = save('grns', { ...values, lines, status: 'Completed' }, { action: existing ? 'updated' : 'posted' })
    setSaving(false)
    const accepted = lines.reduce((a, l) => a + l.acceptedQty, 0)
    toast.success(existing ? 'GRN updated, stock adjusted' : 'GRN posted, stock updated', `${lines.length} item(s), ${num(accepted)} units accepted into ${get('warehouses', values.warehouseId)?.name}.`)
    navigate(`/purchase/grn/${rec.id}?posted=1`)
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'Receive material'}
        subtitle="Record material received against a purchase order. Accepted quantity is added to the warehouse stock."
        breadcrumbs={[...LIST_CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      {invoiced && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          A purchase invoice is linked to this GRN, so it can’t be edited. <Link to={`/purchase/grn/${existing.id}`}>Open the GRN</Link>
        </Callout>
      )}
      <div className="pur-top mb-16">
        <Card title="Receipt details">
          <div className="form-grid">
            <Field label="GRN number" hint={existing ? undefined : 'Assigned when you post'}>
              <Input className="mono" readOnly value={existing?.number || previewNumber('grns', values.date)} />
            </Field>
            <Field label="Receipt date" required error={errors.date}>
              <DatePicker value={values.date} max={today()} onChange={(v) => set('date', v)} />
            </Field>
            <Field label="Supplier" required error={errors.supplierId}>
              <Select options={supplierOptions(state, values.supplierId)} placeholder="Select supplier" value={values.supplierId} disabled={Boolean(existing)} error={errors.supplierId} onChange={(e) => onSupplier(e.target.value)} />
            </Field>
            <Field label="Purchase order" required error={errors.poId} hint={values.supplierId && !openPOs.length ? 'No approved orders pending for this supplier' : undefined}>
              <Select
                options={openPOs.map((p) => ({ value: p.id, label: `${p.number} (${fmtDate(p.date)}, ${inr(p.totals.grandTotal)})` }))}
                placeholder={values.supplierId ? 'Select purchase order' : 'Select a supplier first'}
                value={values.poId}
                disabled={!values.supplierId || Boolean(existing)}
                error={errors.poId}
                onChange={(e) => onPo(e.target.value)}
              />
            </Field>
            <Field label="Warehouse" required error={errors.warehouseId}>
              <Select options={warehouseOptions(state, values.warehouseId)} placeholder="Select warehouse" value={values.warehouseId} error={errors.warehouseId} onChange={(e) => set('warehouseId', e.target.value)} />
            </Field>
            <Field label="Supplier challan no.">
              <Input value={values.supplierChallanNo} placeholder="DC-4521" onChange={(e) => set('supplierChallanNo', e.target.value)} />
            </Field>
            <Field label="Vehicle no.">
              <Input value={values.vehicleNo} placeholder="UP81 AT 4521" onChange={(e) => set('vehicleNo', e.target.value.toUpperCase())} />
            </Field>
            <Field label="QC checked by">
              <Select options={qcPeople} value={values.qcBy} onChange={(e) => set('qcBy', e.target.value)} />
            </Field>
            <Field label="Remarks" span={2}>
              <Input value={values.remarks} placeholder="Condition of material, packing, QC notes" onChange={(e) => set('remarks', e.target.value)} />
            </Field>
          </div>
          {awaitingApproval.length > 0 && (
            <Callout tone="amber" style={{ marginTop: 14 }}>
              {awaitingApproval.map((p) => p.number).join(', ')} from this supplier {awaitingApproval.length > 1 ? 'are' : 'is'} still waiting for approval and can’t be received yet.
            </Callout>
          )}
        </Card>
        <SupplierCard supplier={supplier} />
      </div>

      <Card title="Items received" subtitle="Accepted quantity = received − rejected" flush>
        {values.lines.length === 0 ? (
          <EmptyState compact icon={Boxes} title="No purchase order selected" description="Select a supplier and one of their approved purchase orders to load the items." />
        ) : (
          <div className="table-wrap">
            <table className="table pur-lines" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th className="align-right">Ordered</th>
                  <th className="align-right">Already received</th>
                  <th className="align-right">Pending</th>
                  <th>Received now</th>
                  <th>Rejected</th>
                  <th className="align-right">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {values.lines.map((l, i) => {
                  const it = items.get(l.itemId)
                  const already = prev[l.itemId] || 0
                  const pending = Math.max(0, l.orderedQty - already)
                  const accepted = (Number(l.receivedQty) || 0) - (Number(l.rejectedQty) || 0)
                  return (
                    <tr key={l.id}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <div className="cell-primary">{it?.name}</div>
                        <div className="cell-secondary">{it?.code}, {it?.unit}</div>
                        {errors[`l${i}`] && <div className="field-error">{errors[`l${i}`]}</div>}
                      </td>
                      <td className="align-right num">{num(l.orderedQty)}</td>
                      <td className="align-right num muted">{num(already)}</td>
                      <td className="align-right num">{num(pending)}</td>
                      <td>
                        <input className={`input pur-qty-input ${errors[`l${i}`] ? 'has-error' : ''}`} type="number" min="0" step="any" value={l.receivedQty} onChange={(e) => updateLine(i, { receivedQty: e.target.value === '' ? '' : Number(e.target.value) })} aria-label={`Received quantity for ${it?.name}`} />
                      </td>
                      <td>
                        <input className="input pur-qty-input" type="number" min="0" step="any" value={l.rejectedQty} onChange={(e) => updateLine(i, { rejectedQty: e.target.value === '' ? '' : Number(e.target.value) })} aria-label={`Rejected quantity for ${it?.name}`} />
                      </td>
                      <td className={`align-right num strong ${accepted < 0 ? 'text-red' : 'text-green'}`}>{num(accepted)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {errors.lines && <div className="field-error" style={{ padding: '8px 16px' }}>{errors.lines}</div>}
      </Card>

      <div className="sticky-actions form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: 'auto' }}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={PackageCheck} loading={saving} disabled={invoiced}>
          {existing ? 'Save GRN' : 'Post GRN'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function GrnView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, get, remove } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const grn = get('grns', id)
  usePageTitle(grn?.number || 'Goods receipt')
  const [printOpen, openPrint, closePrint] = usePrintParam()
  const trail = useMemo(() => (grn ? buildPurchaseTrail(state, { grnId: grn.id }) : []), [state, grn])

  if (!grn) return <MissingRecord what="Goods receipt" to="/purchase/grn" />
  const supplier = get('suppliers', grn.supplierId)
  const po = get('purchaseOrders', grn.poId)
  const warehouse = get('warehouses', grn.warehouseId)
  const invoice = state.purchaseInvoices.find((i) => i.grnId === grn.id)
  const items = byId(state.items)
  const t = lineTotals(grn)
  const value = grn.lines.reduce((a, l) => a + Number(l.acceptedQty) * Number(l.rate || 0), 0)
  const justPosted = params.get('posted') === '1'

  const del = async () => {
    if (invoice) {
      toast.error('This GRN can’t be deleted', `Purchase invoice ${invoice.number} is linked to it.`)
      return
    }
    const ok = await confirm({ title: 'Delete goods receipt?', message: `${grn.number} will be removed and the received stock will be reversed.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('grns', grn.id)
      toast.success('Goods receipt deleted', `${grn.number} removed, stock reversed.`)
      navigate('/purchase/grn')
    }
  }

  return (
    <>
      <PageHeader
        title={grn.number}
        badge={invoice ? <Badge tone="green" dot>Invoiced</Badge> : <Badge tone="amber" dot>Awaiting invoice</Badge>}
        subtitle={`${supplier?.name}, received ${fmtDate(grn.date)} into ${warehouse?.name}`}
        breadcrumbs={[...LIST_CRUMBS, { label: grn.number }]}
        actions={
          <>
            <Button icon={Printer} onClick={openPrint}>Print</Button>
            {!invoice && can('Purchase', 'edit') && <Button icon={Pencil} to={`/purchase/grn/${grn.id}/edit`}>Edit</Button>}
            {!invoice && can('Purchase', 'add') && (
              <Button variant="primary" icon={FileText} to={`/purchase/invoices/new?grn=${grn.id}`}>Create purchase invoice</Button>
            )}
            {can('Purchase', 'delete') && (
              <Dropdown
                width={170}
                items={[{ label: 'Delete', icon: Trash2, danger: true, onClick: del }]}
                trigger={({ toggle }) => <Button iconOnly icon={MoreHorizontal} onClick={toggle} aria-label="More actions" />}
              />
            )}
          </>
        }
      />

      {justPosted && (
        <Callout tone="green" style={{ marginBottom: 16 }}>
          <strong>Stock updated.</strong> {grn.lines.filter((l) => l.acceptedQty > 0).map((l) => `+${num(l.acceptedQty)} ${items.get(l.itemId)?.unit} ${items.get(l.itemId)?.name}`).join(', ')} added to {warehouse?.name}.
        </Callout>
      )}

      <div className="grid-4 mb-16">
        <StatCard label="Received" value={num(t.received)} icon={Boxes} tone="blue" foot={`${grn.lines.length} item(s)`} />
        <StatCard label="Rejected in QC" value={num(t.rejected)} icon={PackageX} tone={t.rejected ? 'red' : 'gray'} foot={t.received ? `${pct((t.rejected / t.received) * 100)} of received` : ''} />
        <StatCard label="Accepted into stock" value={num(t.accepted)} icon={PackageCheck} tone="green" foot={warehouse?.name} />
        <StatCard label="Accepted value" value={inr(value)} icon={FileText} tone="violet" foot="At PO rates, before GST" />
      </div>

      <div className="pur-top mb-16">
        <div className="stack">
          <Card title="Receipt details">
            <KeyValue
              items={[
                { label: 'Receipt date', value: fmtDate(grn.date) },
                { label: 'Purchase order', value: po ? <Link className="doc-no" to={`/purchase/orders/${po.id}`}>{po.number}</Link> : null },
                { label: 'Warehouse', value: warehouse?.name },
                { label: 'Supplier challan no.', value: grn.supplierChallanNo },
                { label: 'Vehicle no.', value: grn.vehicleNo },
                { label: 'QC checked by', value: grn.qcBy },
                { label: 'Purchase invoice', value: invoice ? <Link className="doc-no" to={`/purchase/invoices/${invoice.id}`}>{invoice.number}</Link> : 'Not created yet' },
                { label: 'Posted on', value: fmtDateTime(grn.createdAt) },
                { label: 'Remarks', value: grn.remarks },
              ]}
            />
          </Card>
          <Card title="Items" flush>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th className="align-right">Ordered</th>
                    <th className="align-right">Received</th>
                    <th className="align-right">Rejected</th>
                    <th className="align-right">Accepted</th>
                    <th className="align-right">Rate</th>
                    <th className="align-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.lines.map((l, i) => {
                    const it = items.get(l.itemId)
                    return (
                      <tr key={l.id}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <div className="cell-primary">{it?.name}</div>
                          <div className="cell-secondary">{it?.code}</div>
                        </td>
                        <td className="align-right num">{num(l.orderedQty)}</td>
                        <td className="align-right num">{num(l.receivedQty)}</td>
                        <td className={`align-right num ${l.rejectedQty ? 'text-red' : 'muted'}`}>{num(l.rejectedQty)}</td>
                        <td className="align-right num strong">{num(l.acceptedQty)} <span className="tiny muted">{it?.unit}</span></td>
                        <td className="align-right num">{inr(l.rate)}</td>
                        <td className="align-right num">{inr(Number(l.acceptedQty) * Number(l.rate || 0))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Stock impact" subtitle={`Current balance in ${warehouse?.name}`} flush>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="align-right">Added by this GRN</th>
                    <th className="align-right">Balance now</th>
                    <th className="col-actions" aria-label="Ledger" />
                  </tr>
                </thead>
                <tbody>
                  {grn.lines.map((l) => {
                    const it = items.get(l.itemId)
                    return (
                      <tr key={l.id}>
                        <td className="cell-primary">{it?.name}</td>
                        <td className="align-right num text-green strong">+{num(l.acceptedQty)} {it?.unit}</td>
                        <td className="align-right num">{num(itemStock(state, l.itemId, grn.warehouseId))} {it?.unit}</td>
                        <td className="col-actions">
                          <Button size="sm" variant="ghost" icon={History} to={`/inventory/ledger?item=${l.itemId}&warehouse=${grn.warehouseId}`}>
                            Stock ledger
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="stack">
          <SupplierCard supplier={supplier} />
          <DocTrail groups={trail} currentId={grn.id} />
        </div>
      </div>

      <DocumentPreview
        open={printOpen}
        onClose={closePrint}
        onSend={false}
        title="Goods Receipt Note"
        subtitle="Store copy"
        numberLabel="GRN No."
        number={grn.number}
        date={grn.date}
        party={partyFor(supplier)}
        meta={[
          { label: 'PO No.', value: po?.number },
          { label: 'Warehouse', value: warehouse?.name },
          { label: 'Supplier challan', value: grn.supplierChallanNo },
          { label: 'Vehicle no.', value: grn.vehicleNo },
          { label: 'QC by', value: grn.qcBy },
        ]}
        lines={grn.lines}
        columns={[
          { header: 'Ordered', align: 'right', render: (l) => num(l.orderedQty) },
          { header: 'Received', align: 'right', render: (l) => num(l.receivedQty) },
          { header: 'Rejected', align: 'right', render: (l) => num(l.rejectedQty) },
          { header: 'Accepted', align: 'right', render: (l) => num(l.acceptedQty) },
          { header: 'Unit', render: (l, it) => it?.unit },
        ]}
        notes={grn.remarks}
        terms="Material received subject to quality inspection. Rejected quantity will be returned to the supplier at their cost."
        signLabel="Store in-charge"
      />
    </>
  )
}
