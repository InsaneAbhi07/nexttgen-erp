/** Purchase requisitions — list, form and detail (frontend-only demo). */
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, ClipboardList, Eye, FileCheck2, MoreHorizontal, Pencil, Plus, Printer, ShoppingCart, Trash2, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { addDays, fmtDate, fmtDateTime, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { DEPARTMENTS, STATUS } from '../../data/constants.js'
import {
  Button, Callout, Card, DataTable, DatePicker, DocNo, Dropdown, Field, FilterPanel, Input, KeyValue, PageHeader, Select, StatCard, StatusBadge, Textarea,
  inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, DocTrail, MissingRecord, QtyLinesEditor, buildPurchaseTrail, newQtyLine, usePrintParam } from './shared.jsx'

const LIST_CRUMBS = [CRUMB, { label: 'Purchase requisitions', to: '/purchase/requisitions' }]

/* ------------------------------------------------------------------ */
export function RequisitionList() {
  usePageTitle('Purchase requisitions')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [filters, setFilters] = useState({ range: { preset: 'all' }, department: '', status: '' })
  const items = byId(state.items)

  const rows = useMemo(
    () =>
      state.purchaseRequisitions.filter(
        (r) => inDateRange(r.date, filters.range) && (!filters.department || r.department === filters.department) && (!filters.status || r.status === filters.status),
      ),
    [state.purchaseRequisitions, filters],
  )
  const count = (s) => state.purchaseRequisitions.filter((r) => r.status === s).length

  const handleDelete = async (pr) => {
    if (state.purchaseOrders.some((p) => p.prId === pr.id)) {
      toast.error('This requisition can’t be deleted', 'A purchase order has already been raised against it.')
      return
    }
    const ok = await confirm({ title: 'Delete requisition?', message: `${pr.number} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseRequisitions', pr.id)
      toast.success('Requisition deleted', pr.number)
    }
  }

  const columns = [
    { key: 'number', header: 'PR number', render: (r) => <DocNo to={`/purchase/requisitions/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'department', header: 'Department' },
    { key: 'requestedBy', header: 'Requested by' },
    {
      key: 'items',
      header: 'Items',
      accessor: (r) => r.lines.map((l) => items.get(l.itemId)?.name).join(', '),
      render: (r) => (
        <div>
          <div className="cell-primary truncate" style={{ maxWidth: 260 }}>{items.get(r.lines[0]?.itemId)?.name}</div>
          {r.lines.length > 1 && <div className="cell-secondary">and {r.lines.length - 1} more</div>}
        </div>
      ),
    },
    { key: 'requiredDate', header: 'Required by', render: (r) => <span className={r.status === 'Pending' && r.requiredDate < today() ? 'text-red' : ''}>{fmtDate(r.requiredDate)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Purchase requisitions"
        subtitle="Material requests from production, stores and maintenance before a purchase order is raised."
        breadcrumbs={[CRUMB, { label: 'Purchase requisitions' }]}
        actions={can('Purchase', 'add') && <Button variant="primary" icon={Plus} to="/purchase/requisitions/new">New requisition</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Pending approval" value={num(count('Pending'))} icon={ClipboardList} tone="amber" foot="Waiting for manager review" />
        <StatCard label="Approved, no PO yet" value={num(count('Approved'))} icon={ClipboardCheck} tone="blue" foot="Ready to convert" />
        <StatCard label="Converted to PO" value={num(count('Converted'))} icon={ShoppingCart} tone="green" foot="Purchase orders raised" />
        <StatCard label="Rejected" value={num(count('Rejected'))} icon={XCircle} tone="red" foot="Not approved" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="purchase-requisitions"
        searchPlaceholder="Search PR number, department or item…"
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/purchase/requisitions/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'department', label: 'Departments', options: DEPARTMENTS },
              { key: 'status', label: 'Statuses', options: STATUS.requisition },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({ range: { preset: 'all' }, department: '', status: '' })}
          />
        }
        rowActions={(r) => [
          { label: 'View', icon: Eye, to: `/purchase/requisitions/${r.id}` },
          { label: 'Edit', icon: Pencil, to: `/purchase/requisitions/${r.id}/edit`, hidden: !can('Purchase', 'edit') || r.status !== 'Pending' },
          { label: 'Print', icon: Printer, to: `/purchase/requisitions/${r.id}?print=1` },
          { label: 'Convert to PO', icon: ShoppingCart, to: `/purchase/orders/new?pr=${r.id}`, hidden: !can('Purchase', 'add') || r.status !== 'Approved' },
          { divider: true, hidden: !can('Purchase', 'delete') },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r), hidden: !can('Purchase', 'delete') },
        ]}
        emptyTitle="No requisitions found"
        emptyDescription="Raise a requisition when stock of a material runs low."
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
export function RequisitionFormPage() {
  const { id } = useParams()
  const { search } = useLocation()
  return <RequisitionForm key={`${id || 'new'}${search}`} />
}

function RequisitionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const { user } = useAuth()
  const toast = useToast()
  const existing = id ? get('purchaseRequisitions', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New purchase requisition')
  const [values, setValues] = useState(() =>
    existing
      ? { ...existing, lines: existing.lines.map((l) => ({ ...l })) }
      : { date: today(), department: user?.department && DEPARTMENTS.includes(user.department) ? user.department : 'Production', requestedBy: user?.name || '', requiredDate: addDays(today(), 7), lines: [newQtyLine()], remarks: '' },
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !existing) return <MissingRecord what="Requisition" to="/purchase/requisitions" />
  const locked = Boolean(existing) && existing.status !== 'Pending'
  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const people = [...new Set([...state.users.filter((u) => u.status === 'Active').map((u) => u.name), values.requestedBy].filter(Boolean))]

  const submit = async (e) => {
    e.preventDefault()
    const lines = values.lines.filter((l) => l.itemId && Number(l.qty) > 0)
    const errs = {}
    if (!values.date) errs.date = 'Enter the requisition date'
    if (!values.department) errs.department = 'Select a department'
    if (!values.requestedBy) errs.requestedBy = 'Select who is requesting'
    if (values.requiredDate && values.requiredDate < values.date) errs.requiredDate = 'Required date can’t be before the requisition date'
    if (!lines.length) errs.lines = 'Add at least one item with a quantity'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay()
    const rec = save('purchaseRequisitions', { ...values, lines, status: existing?.status || 'Pending' })
    setSaving(false)
    toast.success(existing ? 'Requisition updated' : 'Requisition saved', `${rec.number} sent for approval.`)
    navigate(`/purchase/requisitions/${rec.id}`)
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New purchase requisition'}
        subtitle="Request material for production or stores. A manager approves it before a purchase order is raised."
        breadcrumbs={[...LIST_CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      {locked && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          This requisition is {existing.status.toLowerCase()} and can’t be edited. <Link to={`/purchase/requisitions/${existing.id}`}>Open it</Link>
        </Callout>
      )}
      <Card title="Requisition details" className="mb-16">
        <div className="form-grid">
          <Field label="PR number" hint={existing ? undefined : 'Assigned when you save'}>
            <Input className="mono" readOnly value={existing?.number || previewNumber('purchaseRequisitions', values.date)} />
          </Field>
          <Field label="Date" required error={errors.date}>
            <DatePicker value={values.date} disabled={locked} onChange={(v) => set('date', v)} />
          </Field>
          <Field label="Required by" error={errors.requiredDate}>
            <DatePicker value={values.requiredDate} min={values.date} disabled={locked} onChange={(v) => set('requiredDate', v)} />
          </Field>
          <Field label="Department" required error={errors.department}>
            <Select options={DEPARTMENTS} placeholder="Select department" value={values.department} disabled={locked} onChange={(e) => set('department', e.target.value)} />
          </Field>
          <Field label="Requested by" required error={errors.requestedBy}>
            <Select options={people} placeholder="Select person" value={values.requestedBy} disabled={locked} onChange={(e) => set('requestedBy', e.target.value)} />
          </Field>
          <Field label="Status">
            <Input readOnly value={existing?.status || 'Pending'} />
          </Field>
        </div>
      </Card>
      <Card title="Items requested" subtitle="Stock shown is the total across all warehouses" className="mb-16">
        <QtyLinesEditor state={state} lines={values.lines} onChange={(v) => set('lines', v)} error={errors.lines} />
      </Card>
      <Card title="Remarks">
        <Textarea rows={3} value={values.remarks} placeholder="Why is this material needed?" disabled={locked} onChange={(e) => set('remarks', e.target.value)} />
      </Card>
      <div className="sticky-actions form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: 'auto' }}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={FileCheck2} loading={saving} disabled={locked}>
          Save requisition
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function RequisitionView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, get, patch, remove } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const pr = get('purchaseRequisitions', id)
  usePageTitle(pr?.number || 'Requisition')
  const [printOpen, openPrint, closePrint] = usePrintParam()
  const trail = useMemo(() => (pr ? buildPurchaseTrail(state, { prId: pr.id }) : []), [state, pr])

  if (!pr) return <MissingRecord what="Requisition" to="/purchase/requisitions" />
  const items = byId(state.items)
  const converted = state.purchaseOrders.filter((p) => p.prId === pr.id)

  const approve = () => {
    patch('purchaseRequisitions', pr.id, { status: 'Approved', approvedBy: user?.name, approvedAt: new Date().toISOString() }, { action: 'approved' })
    toast.success('Requisition approved', `${pr.number} can now be converted to a purchase order.`)
  }
  const reject = async () => {
    const ok = await confirm({ title: 'Reject requisition?', message: `${pr.requestedBy} will see ${pr.number} as rejected.`, confirmLabel: 'Reject', tone: 'danger' })
    if (ok) {
      patch('purchaseRequisitions', pr.id, { status: 'Rejected', approvedBy: user?.name, approvedAt: new Date().toISOString() }, { action: 'rejected' })
      toast.success('Requisition rejected', pr.number)
    }
  }
  const del = async () => {
    if (converted.length) {
      toast.error('This requisition can’t be deleted', 'A purchase order has already been raised against it.')
      return
    }
    const ok = await confirm({ title: 'Delete requisition?', message: `${pr.number} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseRequisitions', pr.id)
      toast.success('Requisition deleted', pr.number)
      navigate('/purchase/requisitions')
    }
  }

  return (
    <>
      <PageHeader
        title={pr.number}
        badge={<StatusBadge status={pr.status} />}
        subtitle={`${pr.department} department, requested by ${pr.requestedBy}`}
        breadcrumbs={[...LIST_CRUMBS, { label: pr.number }]}
        actions={
          <>
            <Button icon={Printer} onClick={openPrint}>Print</Button>
            {pr.status === 'Pending' && can('Purchase', 'edit') && <Button icon={Pencil} to={`/purchase/requisitions/${pr.id}/edit`}>Edit</Button>}
            {pr.status === 'Pending' && can('Purchase', 'approve') && (
              <>
                <Button icon={XCircle} onClick={reject}>Reject</Button>
                <Button variant="success" icon={CheckCircle2} onClick={approve}>Approve</Button>
              </>
            )}
            {pr.status === 'Approved' && can('Purchase', 'add') && (
              <Button variant="primary" icon={ShoppingCart} to={`/purchase/orders/new?pr=${pr.id}`}>Convert to PO</Button>
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
      {pr.status === 'Pending' && !can('Purchase', 'approve') && (
        <Callout style={{ marginBottom: 16 }}>Waiting for approval from a manager.</Callout>
      )}
      <div className="pur-top mb-16">
        <div className="stack">
          <Card title="Requisition details">
            <KeyValue
              items={[
                { label: 'Date', value: fmtDate(pr.date) },
                { label: 'Required by', value: fmtDate(pr.requiredDate) },
                { label: 'Department', value: pr.department },
                { label: 'Requested by', value: pr.requestedBy },
                { label: 'Reviewed by', value: pr.approvedBy || (['Approved', 'Converted', 'Rejected'].includes(pr.status) ? 'Rajesh Kumar' : null) },
                { label: 'Created on', value: fmtDateTime(pr.createdAt) },
                { label: 'Remarks', value: pr.remarks, span: 3 },
              ]}
            />
          </Card>
          <Card title="Items requested" flush>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th className="align-right">Requested</th>
                    <th className="align-right">In stock</th>
                    <th className="align-right">Min. level</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.lines.map((l, i) => {
                    const it = items.get(l.itemId)
                    const stock = itemStock(state, l.itemId)
                    return (
                      <tr key={l.id}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <div className="cell-primary">{it?.name}</div>
                          <div className="cell-secondary">{it?.code}</div>
                        </td>
                        <td className="align-right num strong">{num(l.qty)} <span className="tiny muted">{it?.unit}</span></td>
                        <td className={`align-right num ${stock <= Number(it?.minStock) ? 'text-red' : ''}`}>{num(stock)}</td>
                        <td className="align-right num muted">{num(it?.minStock)}</td>
                        <td className="small ink-2">{l.remarks || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <DocTrail groups={trail} currentId={pr.id} />
      </div>

      <DocumentPreview
        open={printOpen}
        onClose={closePrint}
        onSend={false}
        title="Purchase Requisition"
        subtitle="Internal document"
        numberLabel="PR No."
        number={pr.number}
        date={pr.date}
        party={{ heading: 'Requested by', name: pr.requestedBy, address: `${pr.department} department` }}
        meta={[
          { label: 'Required by', value: fmtDate(pr.requiredDate) },
          { label: 'Status', value: pr.status },
        ]}
        lines={pr.lines}
        columns={[
          { header: 'Qty', align: 'right', render: (l) => num(l.qty) },
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'In stock', align: 'right', render: (l) => num(itemStock(state, l.itemId)) },
          { header: 'Remarks', render: (l) => l.remarks || '—' },
        ]}
        notes={pr.remarks}
        terms="Approval from the operations manager is required before a purchase order is raised."
        signLabel="Approved by"
      />
    </>
  )
}
