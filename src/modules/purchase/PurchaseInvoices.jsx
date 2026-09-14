/** Purchase invoices (supplier bills) — list, form and detail. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, Eye, FileText, IndianRupee, MoreHorizontal, Pencil, Plus, Printer, Save, Trash2, Undo2, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, outstandingRows, purchaseInvoiceStatus, totalPayables } from '../../store/selectors.js'
import { calcLine, calcTotals, isInterState } from '../../utils/calc.js'
import { addDays, daysBetween, fmtDate, inr, inr2, inrCompact, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { STATUS } from '../../data/constants.js'
import {
  Button, Callout, Card, DataTable, DatePicker, DocNo, Dropdown, Field, FilterPanel, Input, KeyValue, PageHeader, Select, StatCard, StatusBadge, Textarea,
  inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import LineItemsEditor, { cleanLines, newLine } from '../../components/common/LineItemsEditor.jsx'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, DocTrail, MissingRecord, SupplierCard, buildPurchaseTrail, monthStart, partyFor, supplierOptions, termDays, useListFilters, usePrintParam, warehouseOptions } from './shared.jsx'

const LIST_CRUMBS = [CRUMB, { label: 'Purchase invoices', to: '/purchase/invoices' }]

/* ------------------------------------------------------------------ */
export function PurchaseInvoiceList() {
  usePageTitle('Purchase invoices')
  const { state, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const f = useListFilters()
  const suppliers = byId(state.suppliers)
  const grns = byId(state.grns)

  const rows = useMemo(
    () =>
      state.purchaseInvoices
        .map((i) => ({ ...i, _st: purchaseInvoiceStatus(state, i), _supplier: suppliers.get(i.supplierId), _grn: grns.get(i.grnId) }))
        .filter((i) => inDateRange(i.date, f.values.range) && (!f.values.supplierId || i.supplierId === f.values.supplierId) && (!f.values.status || i._st.status === f.values.status)),
    [state, f.values, suppliers, grns],
  )

  const stats = useMemo(() => {
    const ms = monthStart()
    const monthInv = state.purchaseInvoices.filter((i) => i.date >= ms)
    const overdue = outstandingRows(state, 'payable').filter((r) => r.status === 'Overdue')
    const paidMonth = state.payments.filter((p) => p.date >= ms)
    return {
      month: monthInv.reduce((a, i) => a + i.totals.grandTotal, 0),
      monthCount: monthInv.length,
      payable: totalPayables(state),
      overdue: overdue.reduce((a, r) => a + r.balance, 0),
      overdueCount: overdue.length,
      paid: paidMonth.reduce((a, p) => a + Number(p.amount), 0),
      paidCount: paidMonth.length,
    }
  }, [state])

  const handleDelete = async (inv) => {
    if (state.payments.some((p) => p.invoiceId === inv.id) || state.purchaseReturns.some((r) => r.invoiceId === inv.id)) {
      toast.error('This invoice can’t be deleted', 'Payments or returns are recorded against it.')
      return
    }
    const ok = await confirm({ title: 'Delete purchase invoice?', message: `${inv.number} (${inv.supplierInvoiceNo}) will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseInvoices', inv.id)
      toast.success('Purchase invoice deleted', inv.number)
    }
  }

  const columns = [
    { key: 'number', header: 'Invoice no.', render: (r) => <DocNo to={`/purchase/invoices/${r.id}`}>{r.number}</DocNo> },
    { key: 'supplierInvoiceNo', header: 'Supplier bill no.', render: (r) => <span className="mono small">{r.supplierInvoiceNo}</span> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'supplier', header: 'Supplier', accessor: (r) => r._supplier?.name, render: (r) => <span className="cell-primary">{r._supplier?.name}</span> },
    { key: 'grn', header: 'GRN', accessor: (r) => r._grn?.number, render: (r) => (r._grn ? <DocNo to={`/purchase/grn/${r._grn.id}`}>{r._grn.number}</DocNo> : <span className="muted">Direct</span>) },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.totals.grandTotal, render: (r) => <span className="num strong">{inr(r.totals.grandTotal)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (r) => r._st.balance, render: (r) => <span className={`num ${r._st.balance ? '' : 'muted'}`}>{inr(r._st.balance)}</span> },
    { key: 'dueDate', header: 'Due date', render: (r) => <span className={r._st.status === 'Overdue' ? 'text-red' : ''}>{fmtDate(r.dueDate)}</span> },
    { key: 'status', header: 'Payment', accessor: (r) => r._st.status, render: (r) => <StatusBadge status={r._st.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Purchase invoices"
        subtitle="Supplier bills recorded against goods receipts. Balances flow to supplier ledger and payables."
        breadcrumbs={[CRUMB, { label: 'Purchase invoices' }]}
        actions={can('Purchase', 'add') && <Button variant="primary" icon={Plus} to="/purchase/invoices/new">New purchase invoice</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Purchase this month" value={inrCompact(stats.month)} icon={FileText} tone="blue" foot={`${stats.monthCount} bills recorded`} />
        <StatCard label="Total payable" value={inrCompact(stats.payable)} icon={IndianRupee} tone="violet" foot="Outstanding to suppliers" to="/accounts/outstanding?tab=payable" />
        <StatCard label="Overdue" value={inrCompact(stats.overdue)} icon={AlertTriangle} tone="red" foot={`${stats.overdueCount} bills past due date`} />
        <StatCard label="Paid this month" value={inrCompact(stats.paid)} icon={Wallet} tone="green" foot={`${stats.paidCount} supplier payments`} to="/accounts/payments" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        exportName="purchase-invoices"
        searchPlaceholder="Search invoice, bill no. or supplier…"
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/purchase/invoices/${r.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'range', type: 'daterange' },
              { key: 'supplierId', label: 'Suppliers', options: supplierOptions(state) },
              { key: 'status', label: 'Payment statuses', options: STATUS.payment },
            ]}
            {...f}
          />
        }
        rowActions={(r) => [
          { label: 'View', icon: Eye, to: `/purchase/invoices/${r.id}` },
          { label: 'Edit', icon: Pencil, to: `/purchase/invoices/${r.id}/edit`, hidden: !can('Purchase', 'edit') || r._st.paid > 0 },
          { label: 'Print', icon: Printer, to: `/purchase/invoices/${r.id}?print=1` },
          { label: 'Make payment', icon: Wallet, to: `/accounts/payments/new?invoice=${r.id}`, hidden: !can('Accounts', 'add') || r._st.balance <= 0 },
          { label: 'Create return', icon: Undo2, to: `/purchase/returns/new?invoice=${r.id}`, hidden: !can('Purchase', 'add') },
          { divider: true, hidden: !can('Purchase', 'delete') },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r), hidden: !can('Purchase', 'delete') },
        ]}
        emptyTitle="No purchase invoices found"
        emptyDescription="Record a supplier bill after the material is received."
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
export function PurchaseInvoiceFormPage() {
  const { id } = useParams()
  const { search } = useLocation()
  return <PurchaseInvoiceForm key={`${id || 'new'}${search}`} />
}

function PurchaseInvoiceForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('purchaseInvoices', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New purchase invoice')

  const dueFor = (date, supplierId) => addDays(date, termDays(get('suppliers', supplierId)?.paymentTerms))
  const fromGrn = (grn) => {
    const po = get('purchaseOrders', grn.poId)
    return {
      supplierId: grn.supplierId,
      grnId: grn.id,
      poId: grn.poId || null,
      warehouseId: grn.warehouseId,
      lines: grn.lines
        .filter((l) => Number(l.acceptedQty) > 0)
        .map((l) => {
          const pl = po?.lines.find((x) => x.itemId === l.itemId)
          const it = get('items', l.itemId)
          return newLine({ itemId: l.itemId, qty: l.acceptedQty, rate: pl?.rate ?? l.rate ?? Number(it?.purchaseRate) ?? 0, discount: pl?.discount ?? 0, gst: pl?.gst ?? Number(it?.gst ?? 18) })
        }),
    }
  }

  const [values, setValues] = useState(() => {
    if (existing) return { ...existing, grnId: existing.grnId || '', lines: existing.lines.map((l) => ({ ...l })) }
    const base = { supplierInvoiceNo: '', date: today(), dueDate: today(), supplierId: params.get('supplier') || '', grnId: '', poId: null, warehouseId: 'wh-rms', lines: [newLine()], remarks: '' }
    const grn = get('grns', params.get('grn'))
    const merged = grn ? { ...base, ...fromGrn(grn) } : base
    return { ...merged, dueDate: dueFor(merged.date, merged.supplierId) }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const supplier = get('suppliers', values.supplierId)
  const interState = isInterState(supplier?.state)
  const lines = useMemo(() => cleanLines(values.lines), [values.lines])
  const totals = useMemo(() => calcTotals(lines, { interState }), [lines, interState])

  if (id && !existing) return <MissingRecord what="Purchase invoice" to="/purchase/invoices" />
  const locked = Boolean(existing) && (state.payments.some((p) => p.invoiceId === existing.id) || state.purchaseReturns.some((r) => r.invoiceId === existing.id))
  const grn = get('grns', values.grnId)
  const invoicedGrn = new Set(state.purchaseInvoices.filter((i) => i.grnId && i.id !== existing?.id).map((i) => i.grnId))
  const grnOptions = state.grns
    .filter((g) => g.supplierId === values.supplierId && (!invoicedGrn.has(g.id) || g.id === values.grnId))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((g) => ({ value: g.id, label: `${g.number} (${fmtDate(g.date)})` }))

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onSupplier = (supplierId) => setValues((s) => ({ ...s, supplierId, grnId: '', poId: null, dueDate: dueFor(s.date, supplierId) }))
  const onDate = (date) => setValues((s) => ({ ...s, date, dueDate: dueFor(date, s.supplierId) }))
  const onGrn = (grnId) => {
    const g = get('grns', grnId)
    setValues((s) => (g ? { ...s, ...fromGrn(g) } : { ...s, grnId: '', poId: null }))
    setErrors((e) => ({ ...e, lines: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.supplierId) errs.supplierId = 'Select a supplier'
    if (!values.supplierInvoiceNo.trim()) errs.supplierInvoiceNo = 'Enter the supplier’s bill number'
    else if (state.purchaseInvoices.some((i) => i.id !== existing?.id && i.supplierId === values.supplierId && i.supplierInvoiceNo.toLowerCase() === values.supplierInvoiceNo.trim().toLowerCase()))
      errs.supplierInvoiceNo = 'This bill number is already recorded for the supplier'
    if (!values.date) errs.date = 'Enter the invoice date'
    if (values.dueDate < values.date) errs.dueDate = 'Due date can’t be before the invoice date'
    if (!values.grnId && !values.warehouseId) errs.warehouseId = 'Select a warehouse'
    if (!lines.length) errs.lines = 'Add at least one item with a quantity'
    else if (lines.some((l) => !(Number(l.rate) > 0))) errs.lines = 'Enter a rate for every item'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', Object.values(errs)[0])
      return
    }
    setSaving(true)
    await fakeDelay()
    const rec = save('purchaseInvoices', { ...values, supplierInvoiceNo: values.supplierInvoiceNo.trim(), grnId: values.grnId || null, lines, totals })
    setSaving(false)
    toast.success(existing ? 'Purchase invoice updated' : 'Purchase invoice saved', `${rec.number} for ${supplier.name}, ${inr(totals.grandTotal)} due on ${fmtDate(rec.dueDate)}.`)
    navigate(`/purchase/invoices/${rec.id}`)
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New purchase invoice'}
        subtitle="Record a supplier bill. Link the goods receipt to pull accepted quantities and PO rates."
        breadcrumbs={[...LIST_CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      {locked && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          Payments or returns are recorded against this invoice, so it can’t be edited. <Link to={`/purchase/invoices/${existing.id}`}>Open the invoice</Link>
        </Callout>
      )}
      <div className="pur-top mb-16">
        <Card title="Invoice details">
          <div className="form-grid">
            <Field label="Invoice no." hint={existing ? 'Internal number' : 'Internal number, assigned when you save'}>
              <Input className="mono" readOnly value={existing?.number || previewNumber('purchaseInvoices', values.date)} />
            </Field>
            <Field label="Supplier bill no." required error={errors.supplierInvoiceNo}>
              <Input value={values.supplierInvoiceNo} placeholder="SLI/1142/26-27" error={errors.supplierInvoiceNo} onChange={(e) => set('supplierInvoiceNo', e.target.value)} />
            </Field>
            <Field label="Supplier" required error={errors.supplierId}>
              <Select options={supplierOptions(state, values.supplierId)} placeholder="Select supplier" value={values.supplierId} error={errors.supplierId} onChange={(e) => onSupplier(e.target.value)} />
            </Field>
            <Field label="Invoice date" required error={errors.date}>
              <DatePicker value={values.date} onChange={onDate} />
            </Field>
            <Field label="Due date" error={errors.dueDate} hint={supplier ? `${supplier.paymentTerms} credit` : undefined}>
              <DatePicker value={values.dueDate} min={values.date} onChange={(v) => set('dueDate', v)} />
            </Field>
            <Field label="Goods receipt (GRN)" hint={values.supplierId && !grnOptions.length ? 'No uninvoiced GRNs for this supplier' : 'Optional'}>
              <Select options={grnOptions} placeholder={values.supplierId ? 'No GRN (direct bill)' : 'Select a supplier first'} value={values.grnId} disabled={!values.supplierId} onChange={(e) => onGrn(e.target.value)} />
            </Field>
            <Field label="Warehouse" required={!values.grnId} error={errors.warehouseId}>
              <Select options={warehouseOptions(state, values.warehouseId)} placeholder="Select warehouse" value={values.warehouseId} disabled={Boolean(values.grnId)} onChange={(e) => set('warehouseId', e.target.value)} />
            </Field>
            <Field label="Remarks" span={2}>
              <Input value={values.remarks} placeholder="Freight included, debit note pending…" onChange={(e) => set('remarks', e.target.value)} />
            </Field>
          </div>
          <Callout tone={grn ? 'green' : 'gray'} style={{ marginTop: 14 }}>
            {grn
              ? `Stock was already added through ${grn.number}. Saving this invoice won’t change stock again.`
              : `No GRN linked. Saving this invoice adds the quantities to ${get('warehouses', values.warehouseId)?.name || 'the selected warehouse'}.`}
          </Callout>
        </Card>
        <SupplierCard supplier={supplier} />
      </div>

      <Card title="Items" subtitle={grn ? `Loaded from ${grn.number}. Adjust rates to match the supplier bill.` : 'Rates come from the item master'} className="mb-16">
        <LineItemsEditor lines={values.lines} onChange={(v) => set('lines', v)} rateField="purchaseRate" stockWarehouseId={values.warehouseId} error={errors.lines} />
      </Card>

      <div className="grid-2">
        <Card title="Notes">
          <Textarea rows={4} value={values.notes || ''} placeholder="Internal notes about this bill" onChange={(e) => set('notes', e.target.value)} />
        </Card>
        <Card title="Bill summary" subtitle={supplier ? (interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST and SGST apply') : undefined}>
          <TotalsSummary totals={totals} showWords />
        </Card>
      </div>

      <div className="sticky-actions form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: 'auto' }}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={locked}>
          Save invoice
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
export function PurchaseInvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, get, remove } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const inv = get('purchaseInvoices', id)
  usePageTitle(inv?.number || 'Purchase invoice')
  const [printOpen, openPrint, closePrint] = usePrintParam()
  const trail = useMemo(() => (inv ? buildPurchaseTrail(state, { invoiceId: inv.id }) : []), [state, inv])

  if (!inv) return <MissingRecord what="Purchase invoice" to="/purchase/invoices" />
  const supplier = get('suppliers', inv.supplierId)
  const grn = get('grns', inv.grnId)
  const po = get('purchaseOrders', inv.poId)
  const warehouse = get('warehouses', inv.warehouseId)
  const items = byId(state.items)
  const st = purchaseInvoiceStatus(state, inv)
  const interState = isInterState(supplier?.state)
  const payments = state.payments.filter((p) => p.invoiceId === inv.id).sort((a, b) => (a.date < b.date ? -1 : 1))
  const returns = state.purchaseReturns.filter((r) => r.invoiceId === inv.id)
  const locked = payments.length > 0 || returns.length > 0
  const daysToDue = daysBetween(today(), inv.dueDate)

  const del = async () => {
    if (locked) {
      toast.error('This invoice can’t be deleted', 'Payments or returns are recorded against it.')
      return
    }
    const ok = await confirm({ title: 'Delete purchase invoice?', message: `${inv.number} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseInvoices', inv.id)
      toast.success('Purchase invoice deleted', inv.number)
      navigate('/purchase/invoices')
    }
  }

  return (
    <>
      <PageHeader
        title={inv.number}
        badge={<StatusBadge status={st.status} />}
        subtitle={`Supplier bill ${inv.supplierInvoiceNo} from ${supplier?.name}, dated ${fmtDate(inv.date)}`}
        breadcrumbs={[...LIST_CRUMBS, { label: inv.number }]}
        actions={
          <>
            <Button icon={Printer} onClick={openPrint}>Print</Button>
            {!locked && can('Purchase', 'edit') && <Button icon={Pencil} to={`/purchase/invoices/${inv.id}/edit`}>Edit</Button>}
            {can('Purchase', 'add') && <Button icon={Undo2} to={`/purchase/returns/new?invoice=${inv.id}`}>Create return</Button>}
            {st.balance > 0 && can('Accounts', 'add') && (
              <Button variant="primary" icon={Wallet} to={`/accounts/payments/new?invoice=${inv.id}`}>Make payment</Button>
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

      <div className="grid-4 mb-16">
        <StatCard label="Invoice amount" value={inr(st.amount)} icon={FileText} tone="blue" foot={`Taxable ${inr(inv.totals.taxable)}, GST ${inr(inv.totals.gst)}`} />
        <StatCard label="Paid" value={inr(st.paid)} icon={CheckCircle2} tone="green" foot={`${payments.length} payment(s)${returns.length ? `, ${returns.length} return(s)` : ''}`} />
        <StatCard label="Balance" value={inr(st.balance)} icon={IndianRupee} tone={st.balance ? 'amber' : 'gray'} foot={st.balance ? 'Payable to supplier' : 'Fully settled'} />
        <StatCard
          label="Due date"
          value={fmtDate(inv.dueDate)}
          icon={CalendarClock}
          tone={st.status === 'Overdue' ? 'red' : 'teal'}
          foot={st.status === 'Paid' ? 'Settled' : st.status === 'Overdue' ? `Overdue by ${st.daysOverdue} days` : daysToDue === 0 ? 'Due today' : `Due in ${daysToDue} days`}
        />
      </div>

      <div className="pur-top mb-16">
        <div className="stack">
          <Card title="Invoice details">
            <KeyValue
              items={[
                { label: 'Supplier bill no.', value: <span className="mono">{inv.supplierInvoiceNo}</span> },
                { label: 'Invoice date', value: fmtDate(inv.date) },
                { label: 'Due date', value: fmtDate(inv.dueDate) },
                { label: 'Goods receipt', value: grn ? <Link className="doc-no" to={`/purchase/grn/${grn.id}`}>{grn.number}</Link> : 'Direct bill' },
                { label: 'Purchase order', value: po ? <Link className="doc-no" to={`/purchase/orders/${po.id}`}>{po.number}</Link> : null },
                { label: 'Warehouse', value: warehouse?.name },
                { label: 'Stock updated through', value: grn ? `GRN ${grn.number}` : inv.historical ? 'Opening balance' : 'This invoice' },
                { label: 'Tax type', value: interState ? 'IGST (inter-state)' : 'CGST + SGST' },
                { label: 'Remarks', value: inv.remarks },
              ]}
            />
          </Card>
          <Card title="Items" flush footer={<TotalsSummary totals={inv.totals} showWords />}>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>HSN</th>
                    <th className="align-right">Qty</th>
                    <th className="align-right">Rate</th>
                    <th className="align-right">Disc.</th>
                    <th className="align-right">Taxable</th>
                    <th className="align-right">GST</th>
                    <th className="align-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => {
                    const it = items.get(l.itemId)
                    const c = calcLine(l)
                    return (
                      <tr key={l.id}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <div className="cell-primary">{it?.name}</div>
                          <div className="cell-secondary">{it?.code}</div>
                        </td>
                        <td className="mono small">{it?.hsn}</td>
                        <td className="align-right num">{num(l.qty)} <span className="tiny muted">{it?.unit}</span></td>
                        <td className="align-right num">{inr2(l.rate)}</td>
                        <td className="align-right num">{Number(l.discount) ? `${l.discount}%` : '—'}</td>
                        <td className="align-right num">{inr2(c.taxable)}</td>
                        <td className="align-right num">{inr2(c.gstAmt)} <span className="tiny muted">@{l.gst}%</span></td>
                        <td className="align-right num strong">{inr2(c.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card
            title="Payments & adjustments"
            flush
            actions={st.balance > 0 && can('Accounts', 'add') && <Button size="sm" variant="soft" icon={Wallet} to={`/accounts/payments/new?invoice=${inv.id}`}>Make payment</Button>}
          >
            {payments.length + returns.length === 0 ? (
              <div className="card-body small muted">No payments recorded yet. Balance of {inr(st.balance)} is due on {fmtDate(inv.dueDate)}.</div>
            ) : (
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th className="align-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td><DocNo to="/accounts/payments">{p.number}</DocNo></td>
                        <td>{fmtDate(p.date)}</td>
                        <td>Payment ({p.mode})</td>
                        <td className="small ink-2">{p.reference}</td>
                        <td className="align-right num strong">{inr(p.amount)}</td>
                      </tr>
                    ))}
                    {returns.map((r) => (
                      <tr key={r.id}>
                        <td><DocNo to={`/purchase/returns/${r.id}`}>{r.number}</DocNo></td>
                        <td>{fmtDate(r.date)}</td>
                        <td>Purchase return</td>
                        <td className="small ink-2">{r.reason}</td>
                        <td className="align-right num strong">{inr(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="stack">
          <SupplierCard supplier={supplier} />
          <DocTrail groups={trail} currentId={inv.id} />
        </div>
      </div>

      <DocumentPreview
        open={printOpen}
        onClose={closePrint}
        onSend={false}
        title="Purchase Invoice"
        subtitle="Supplier bill record"
        numberLabel="Invoice No."
        number={inv.number}
        date={inv.date}
        party={partyFor(supplier)}
        meta={[
          { label: 'Supplier bill no.', value: inv.supplierInvoiceNo },
          { label: 'Due date', value: fmtDate(inv.dueDate) },
          { label: 'GRN No.', value: grn?.number },
          { label: 'PO No.', value: po?.number },
        ]}
        lines={inv.lines}
        totals={inv.totals}
        interState={interState}
        notes={inv.remarks}
        stamp={st.status === 'Paid' ? 'PAID' : null}
        terms="Recorded against the supplier’s original tax invoice. Payment as per agreed credit terms."
        signLabel="Accounts"
      />
    </>
  )
}
