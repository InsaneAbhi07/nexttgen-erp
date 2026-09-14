/** Purchase returns (debit notes) — list, form and detail. Stock goes out on save. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, Clock, Eye, FileMinus, IndianRupee, MoreHorizontal, Pencil, Plus, Printer, Save, Trash2, Undo2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { round2 } from '../../utils/calc.js'
import { fmtDate, fmtDateTime, inr, inr2, inrCompact, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { uid } from '../../store/numbering.js'
import { STATUS } from '../../data/constants.js'
import {
  Button, Callout, Card, DataTable, DatePicker, DocNo, Dropdown, EmptyState, Field, FilterPanel, Input, KeyValue, PageHeader, Select, StatCard, StatusBadge, Textarea,
  inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, DocTrail, MissingRecord, RETURN_REASONS, SupplierCard, buildPurchaseTrail, partyFor, supplierOptions, useListFilters, usePrintParam, warehouseOptions } from './shared.jsx'

const LIST_CRUMBS = [CRUMB, { label: 'Purchase returns', to: '/purchase/returns' }]

/* ------------------------------------------------------------------ */
export function PurchaseReturnList() {
  usePageTitle('Purchase returns')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const f = useListFilters()
  const suppliers = byId(state.suppliers)
  const invoices = byId(state.purchaseInvoices)
  const items = byId(state.items)

  const rows = useMemo(
    () =>
      state.purchaseReturns
        .map((r) => ({ ...r, _supplier: suppliers.get(r.supplierId), _invoice: invoices.get(r.invoiceId) }))
        .filter((r) => inDateRange(r.date, f.values.range) && (!f.values.supplierId || r.supplierId === f.values.supplierId) && (!f.values.status || r.status === f.values.status)),
    [state.purchaseReturns, f.values, suppliers, invoices],
  )
  const all = state.purchaseReturns

  const handleDelete = async (r) => {
    const ok = await confirm({ title: 'Delete purchase return?', message: `${r.number} will be removed and the returned quantity added back to stock.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseReturns', r.id)
      toast.success('Purchase return deleted', `${r.number} removed, stock restored.`)
    }
  }

  const columns = [
    { key: 'number', header: 'Return no.', render: (r) => <DocNo to={`/purchase/returns/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'supplier', header: 'Supplier', accessor: (r) => r._supplier?.name, render: (r) => <span className="cell-primary">{r._supplier?.name}</span> },
    { key: 'invoice', header: 'Original invoice', accessor: (r) => r._invoice?.number, render: (r) => (r._invoice ? <DocNo to={`/purchase/invoices/${r._invoice.id}`}>{r._invoice.number}</DocNo> : '—') },
    { key: 'items', header: 'Items', accessor: (r) => r.lines.map((l) => items.get(l.itemId)?.name).join(', '), render: (r) => <span className="truncate" style={{ maxWidth: 220, display: 'inline-block' }}>{r.lines.map((l) => `${items.get(l.itemId)?.name} (${num(l.qty)})`).join(', ')}</span> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="small ink-2">{r.reason}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="num strong">{inr(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Purchase returns"
        subtitle="Material sent back to suppliers. Each return reduces stock and adjusts the supplier balance."
        breadcrumbs={[CRUMB, { label: 'Purchase returns' }]}
        actions={can('Purchase', 'add') && <Button variant="primary" icon={Plus} to="/purchase/returns/new">New purchase return</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Returns recorded" value={num(all.length)} icon={Undo2} tone="blue" foot="All debit notes" />
        <StatCard label="Return value" value={inrCompact(all.reduce((a, r) => a + Number(r.amount), 0))} icon={IndianRupee} tone="violet" foot="Including GST" />
        <StatCard label="Pending approval" value={num(all.filter((r) => r.status === 'Pending').length)} icon={Clock} tone="amber" foot="Waiting for manager" />
        <StatCard label="Awaiting credit note" value={num(all.filter((r) => r.status === 'Approved').length)} icon={FileMinus} tone="teal" foot="Approved, supplier yet to confirm" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="purchase-returns"
        searchPlaceholder="Search return, invoice or supplier…"
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/purchase/returns/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'supplierId', label: 'Suppliers', options: supplierOptions(state) },
              { key: 'status', label: 'Statuses', options: STATUS.returns },
            ]}
            {...f}
          />
        }
        rowActions={(r) => [
          { label: 'View', icon: Eye, to: `/purchase/returns/${r.id}` },
          { label: 'Edit', icon: Pencil, to: `/purchase/returns/${r.id}/edit`, hidden: !can('Purchase', 'edit') || r.status !== 'Pending' },
          { label: 'Print', icon: Printer, to: `/purchase/returns/${r.id}?print=1` },
          { divider: true, hidden: !can('Purchase', 'delete') },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r), hidden: !can('Purchase', 'delete') },
        ]}
        emptyTitle="No purchase returns found"
        emptyDescription="Return rejected or excess material to the supplier from a purchase invoice."
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
export function PurchaseReturnFormPage() {
  const { id } = useParams()
  const { search } = useLocation()
  return <PurchaseReturnForm key={`${id || 'new'}${search}`} />
}

function PurchaseReturnForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('purchaseReturns', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New purchase return')

  const [values, setValues] = useState(() => {
    if (existing) {
      const known = RETURN_REASONS.includes(existing.reason)
      return { ...existing, reason: known ? existing.reason : 'Other', otherReason: known ? '' : existing.reason, qty: Object.fromEntries(existing.lines.map((l) => [l.itemId, l.qty])) }
    }
    const inv = get('purchaseInvoices', params.get('invoice'))
    return { date: today(), supplierId: inv?.supplierId || '', invoiceId: inv?.id || '', warehouseId: inv?.warehouseId || '', reason: RETURN_REASONS[0], otherReason: '', status: 'Pending', remarks: '', qty: {} }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const invoice = get('purchaseInvoices', values.invoiceId)
  const returnedElsewhere = useMemo(() => {
    const m = {}
    state.purchaseReturns
      .filter((r) => r.invoiceId === values.invoiceId && r.id !== existing?.id)
      .forEach((r) => r.lines.forEach((l) => {
        m[l.itemId] = (m[l.itemId] || 0) + Number(l.qty)
      }))
    return m
  }, [state.purchaseReturns, values.invoiceId, existing])

  if (id && !existing) return <MissingRecord what="Purchase return" to="/purchase/returns" />
  const locked = Boolean(existing) && existing.status !== 'Pending'
  const supplier = get('suppliers', values.supplierId)
  const items = byId(state.items)

  const rows = invoice
    ? invoice.lines.map((l) => {
        const it = items.get(l.itemId)
        const rate = round2(Number(l.rate) * (1 - (Number(l.discount) || 0) / 100))
        const already = returnedElsewhere[l.itemId] || 0
        const returnable = Math.max(0, Number(l.qty) - already)
        const ownQty = existing && existing.warehouseId === values.warehouseId ? existing.lines.find((x) => x.itemId === l.itemId)?.qty || 0 : 0
        const stock = round2(itemStock(state, l.itemId, values.warehouseId) + Number(ownQty))
        const qty = Number(values.qty[l.itemId]) || 0
        return { line: l, item: it, rate, already, returnable, stock, qty, amount: round2(qty * rate * (1 + Number(l.gst) / 100)) }
      })
    : []
  const amount = Math.round(rows.reduce((a, r) => a + r.amount, 0))

  const invoiceOptions = state.purchaseInvoices
    .filter((i) => i.supplierId === values.supplierId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 40)
    .map((i) => ({ value: i.id, label: `${i.number} (${i.supplierInvoiceNo}, ${fmtDate(i.date)})` }))

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onSupplier = (supplierId) => setValues((s) => ({ ...s, supplierId, invoiceId: '', qty: {} }))
  const onInvoice = (invoiceId) => {
    const inv = get('purchaseInvoices', invoiceId)
    setValues((s) => ({ ...s, invoiceId, warehouseId: inv?.warehouseId || s.warehouseId, qty: {} }))
    setErrors({})
  }
  const setQty = (itemId, v) => {
    setValues((s) => ({ ...s, qty: { ...s.qty, [itemId]: v } }))
    setErrors((e) => ({ ...e, [`q-${itemId}`]: undefined, lines: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.date) errs.date = 'Enter the return date'
    if (!values.supplierId) errs.supplierId = 'Select a supplier'
    if (!values.invoiceId) errs.invoiceId = 'Select the original invoice'
    if (!values.warehouseId) errs.warehouseId = 'Select the warehouse the material leaves from'
    if (values.reason === 'Other' && !values.otherReason.trim()) errs.otherReason = 'Describe the reason'
    rows.forEach((r) => {
      if (r.qty < 0) errs[`q-${r.line.itemId}`] = 'Can’t be negative'
      else if (r.qty > r.returnable) errs[`q-${r.line.itemId}`] = `Only ${num(r.returnable)} can be returned`
      else if (r.qty > r.stock) errs[`q-${r.line.itemId}`] = `Only ${num(r.stock)} in stock`
    })
    if (values.invoiceId && !rows.some((r) => r.qty > 0)) errs.lines = 'Enter a return quantity for at least one item'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay()
    const { qty, otherReason, ...rest } = values
    const lines = rows.filter((r) => r.qty > 0).map((r) => ({ id: uid('ln'), itemId: r.line.itemId, qty: r.qty, rate: r.rate, gst: Number(r.line.gst) }))
    const rec = save('purchaseReturns', { ...rest, reason: values.reason === 'Other' ? otherReason.trim() : values.reason, lines, amount })
    setSaving(false)
    toast.success(existing ? 'Purchase return updated' : 'Purchase return saved, stock reduced', `${rec.number} for ${inr(amount)} against ${invoice.number}.`)
    navigate(`/purchase/returns/${rec.id}`)
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New purchase return'}
        subtitle="Send material back to the supplier against the original invoice. Stock is reduced when you save."
        breadcrumbs={[...LIST_CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      {locked && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          This return is {existing.status.toLowerCase()} and can’t be edited. <Link to={`/purchase/returns/${existing.id}`}>Open it</Link>
        </Callout>
      )}
      <div className="pur-top mb-16">
        <Card title="Return details">
          <div className="form-grid">
            <Field label="Return no." hint={existing ? undefined : 'Assigned when you save'}>
              <Input className="mono" readOnly value={existing?.number || previewNumber('purchaseReturns', values.date)} />
            </Field>
            <Field label="Return date" required error={errors.date}>
              <DatePicker value={values.date} onChange={(v) => set('date', v)} />
            </Field>
            <Field label="Supplier" required error={errors.supplierId}>
              <Select options={supplierOptions(state, values.supplierId)} placeholder="Select supplier" value={values.supplierId} error={errors.supplierId} disabled={Boolean(existing)} onChange={(e) => onSupplier(e.target.value)} />
            </Field>
            <Field label="Original invoice" required error={errors.invoiceId} span={2}>
              <Select options={invoiceOptions} placeholder={values.supplierId ? 'Select invoice' : 'Select a supplier first'} value={values.invoiceId} error={errors.invoiceId} disabled={!values.supplierId || Boolean(existing)} onChange={(e) => onInvoice(e.target.value)} />
            </Field>
            <Field label="Return from warehouse" required error={errors.warehouseId}>
              <Select options={warehouseOptions(state, values.warehouseId)} placeholder="Select warehouse" value={values.warehouseId} onChange={(e) => set('warehouseId', e.target.value)} />
            </Field>
            <Field label="Reason" required>
              <Select options={RETURN_REASONS} value={values.reason} onChange={(e) => set('reason', e.target.value)} />
            </Field>
            {values.reason === 'Other' && (
              <Field label="Describe the reason" required error={errors.otherReason}>
                <Input value={values.otherReason} error={errors.otherReason} onChange={(e) => set('otherReason', e.target.value)} />
              </Field>
            )}
            <Field label="Status">
              <Select options={STATUS.returns} value={values.status} onChange={(e) => set('status', e.target.value)} />
            </Field>
            <Field label="Remarks" span="full">
              <Textarea rows={2} value={values.remarks} placeholder="Transporter, LR no. or QC report reference" onChange={(e) => set('remarks', e.target.value)} />
            </Field>
          </div>
        </Card>
        <SupplierCard supplier={supplier} />
      </div>

      <Card title="Items to return" subtitle="Rates include the invoice discount. GST is added to the return amount." flush>
        {!invoice ? (
          <EmptyState compact icon={Undo2} title="No invoice selected" description="Select a supplier and the original invoice to load its items." />
        ) : (
          <div className="table-wrap">
            <table className="table pur-lines" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="align-right">Invoiced</th>
                  <th className="align-right">Already returned</th>
                  <th className="align-right">In stock</th>
                  <th>Return qty</th>
                  <th className="align-right">Rate</th>
                  <th className="align-right">GST</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line.id}>
                    <td>
                      <div className="cell-primary">{r.item?.name}</div>
                      <div className="cell-secondary">{r.item?.code}, {r.item?.unit}</div>
                      {errors[`q-${r.line.itemId}`] && <div className="field-error">{errors[`q-${r.line.itemId}`]}</div>}
                    </td>
                    <td className="align-right num">{num(r.line.qty)}</td>
                    <td className="align-right num muted">{num(r.already)}</td>
                    <td className="align-right num">{num(r.stock)}</td>
                    <td>
                      <input className={`input pur-qty-input ${errors[`q-${r.line.itemId}`] ? 'has-error' : ''}`} type="number" min="0" step="any" max={r.returnable} value={values.qty[r.line.itemId] ?? ''} placeholder="0" onChange={(e) => setQty(r.line.itemId, e.target.value === '' ? '' : Number(e.target.value))} aria-label={`Return quantity for ${r.item?.name}`} />
                    </td>
                    <td className="align-right num">{inr2(r.rate)}</td>
                    <td className="align-right num">{r.line.gst}%</td>
                    <td className="align-right num strong">{inr2(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>Return amount (incl. GST)</td>
                  <td className="align-right num">{inr(amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {errors.lines && <div className="field-error" style={{ padding: '8px 16px' }}>{errors.lines}</div>}
      </Card>

      <div className="sticky-actions form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: 'auto' }}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={locked}>
          Save return
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function PurchaseReturnView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, get, patch, remove } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const ret = get('purchaseReturns', id)
  usePageTitle(ret?.number || 'Purchase return')
  const [printOpen, openPrint, closePrint] = usePrintParam()
  const trail = useMemo(() => (ret ? buildPurchaseTrail(state, { returnId: ret.id }) : []), [state, ret])

  if (!ret) return <MissingRecord what="Purchase return" to="/purchase/returns" />
  const supplier = get('suppliers', ret.supplierId)
  const invoice = get('purchaseInvoices', ret.invoiceId)
  const warehouse = get('warehouses', ret.warehouseId)
  const items = byId(state.items)

  const setStatus = (status, title) => {
    patch('purchaseReturns', ret.id, { status }, { action: status === 'Approved' ? 'approved' : 'updated' })
    toast.success(title, ret.number)
  }
  const del = async () => {
    const ok = await confirm({ title: 'Delete purchase return?', message: `${ret.number} will be removed and the returned quantity added back to stock.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseReturns', ret.id)
      toast.success('Purchase return deleted', `${ret.number} removed, stock restored.`)
      navigate('/purchase/returns')
    }
  }

  return (
    <>
      <PageHeader
        title={ret.number}
        badge={<StatusBadge status={ret.status} />}
        subtitle={`Returned to ${supplier?.name} on ${fmtDate(ret.date)}`}
        breadcrumbs={[...LIST_CRUMBS, { label: ret.number }]}
        actions={
          <>
            <Button icon={Printer} onClick={openPrint}>Print</Button>
            {ret.status === 'Pending' && can('Purchase', 'edit') && <Button icon={Pencil} to={`/purchase/returns/${ret.id}/edit`}>Edit</Button>}
            {ret.status === 'Pending' && can('Purchase', 'approve') && (
              <Button variant="success" icon={CheckCircle2} onClick={() => setStatus('Approved', 'Purchase return approved')}>Approve</Button>
            )}
            {ret.status === 'Approved' && can('Purchase', 'approve') && (
              <Button variant="primary" icon={BadgeCheck} onClick={() => setStatus('Credit Note Issued', 'Credit note marked as issued')}>Mark credit note issued</Button>
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

      <div className="pur-top mb-16">
        <div className="stack">
          <Card title="Return details">
            <KeyValue
              items={[
                { label: 'Return date', value: fmtDate(ret.date) },
                { label: 'Original invoice', value: invoice ? <Link className="doc-no" to={`/purchase/invoices/${invoice.id}`}>{invoice.number}</Link> : null },
                { label: 'Supplier bill no.', value: invoice?.supplierInvoiceNo },
                { label: 'Returned from', value: warehouse?.name },
                { label: 'Return amount', value: inr(ret.amount) },
                { label: 'Created on', value: fmtDateTime(ret.createdAt) },
                { label: 'Reason', value: ret.reason, span: 2 },
                { label: 'Remarks', value: ret.remarks },
              ]}
            />
          </Card>
          <Card title="Items returned" flush>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th className="align-right">Qty</th>
                    <th className="align-right">Rate</th>
                    <th className="align-right">GST</th>
                    <th className="align-right">Amount</th>
                    <th className="align-right">Stock now</th>
                  </tr>
                </thead>
                <tbody>
                  {ret.lines.map((l, i) => {
                    const it = items.get(l.itemId)
                    return (
                      <tr key={l.id}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <div className="cell-primary">{it?.name}</div>
                          <div className="cell-secondary">{it?.code}</div>
                        </td>
                        <td className="align-right num text-red">−{num(l.qty)} <span className="tiny muted">{it?.unit}</span></td>
                        <td className="align-right num">{inr2(l.rate)}</td>
                        <td className="align-right num">{l.gst}%</td>
                        <td className="align-right num strong">{inr2(l.qty * l.rate * (1 + l.gst / 100))}</td>
                        <td className="align-right num">{num(itemStock(state, l.itemId, ret.warehouseId))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total (rounded)</td>
                    <td className="align-right num">{inr(ret.amount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
        <div className="stack">
          <SupplierCard supplier={supplier} />
          <DocTrail groups={trail} currentId={ret.id} />
        </div>
      </div>

      <DocumentPreview
        open={printOpen}
        onClose={closePrint}
        title="Purchase Return / Debit Note"
        numberLabel="Debit note no."
        number={ret.number}
        date={ret.date}
        party={partyFor(supplier)}
        meta={[
          { label: 'Against invoice', value: invoice?.number },
          { label: 'Supplier bill no.', value: invoice?.supplierInvoiceNo },
          { label: 'Amount', value: inr(ret.amount) },
        ]}
        lines={ret.lines}
        columns={[
          { header: 'Qty', align: 'right', render: (l) => num(l.qty) },
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'Rate', align: 'right', render: (l) => inr2(l.rate) },
          { header: 'GST', align: 'right', render: (l) => `${l.gst}%` },
          { header: 'Amount', align: 'right', render: (l) => inr2(l.qty * l.rate * (1 + l.gst / 100)) },
        ]}
        notes={`Reason for return: ${ret.reason}`}
        terms="Please issue a credit note for the above amount or adjust it against your next bill."
        sendLabel="Send to supplier"
      />
    </>
  )
}
