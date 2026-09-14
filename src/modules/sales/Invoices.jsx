/**
 * Sales invoices — the showcase screen of the demo. GST-compliant invoice layout,
 * print / PDF via the browser, "send" simulated. Frontend-only: nothing leaves the browser.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Download, Eye, FileText, IndianRupee, MoreHorizontal, Pencil, Plus, Printer, Receipt, Send, Trash2, Undo2, Wallet } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock, salesInvoiceStatus } from '../../store/selectors.js'
import { calcTotals, isInterState } from '../../utils/calc.js'
import { addDays, daysBetween, fmtDate, fmtDateTime, inr, inr2, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { printPage } from '../../utils/export.js'
import { SALES_PERSONS, STATE_NAMES, stateCode } from '../../data/constants.js'
import { Button, Callout, Card, Checkbox, DataTable, DocNo, Dropdown, Field, FilterPanel, Input, KeyValue, Modal, PageHeader, Progress, StatCard, StatusBadge, Textarea, useConfirm, useToast } from '../../components/ui/index.js'
import LineItemsEditor, { cleanLines, newLine } from '../../components/common/LineItemsEditor.jsx'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview, { DocumentPaper } from '../../components/common/DocumentPreview.jsx'
import {
  CustomerCard, DocNotFound, Fields, FormShell, RelatedDocs, SALES_CRUMB,
  customerAddress, customerOptions, filterDefs, isSellable, matchCommon, monthStart, partyOf, salesPersonFilter, termDays, useSalesFilters, warehouseOptions,
} from './shared.jsx'

const CRUMBS = [SALES_CRUMB, { label: 'Sales invoices', to: '/sales/invoices' }]
const PAYMENT_STATUSES = ['Paid', 'Partially Paid', 'Unpaid', 'Overdue']

function useInvoiceDelete() {
  const { state, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  return async (inv, after) => {
    if (state.receipts.some((r) => r.invoiceId === inv.id) || state.salesReturns.some((r) => r.invoiceId === inv.id)) {
      toast.error('This invoice can’t be deleted', 'Receipts or returns are recorded against it. Remove them first.')
      return
    }
    const ok = await confirm({ title: 'Delete invoice?', message: `${inv.number} will be removed from the demo data.${inv.dcId ? '' : ' Its stock deduction will be reversed.'}`, confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    remove('salesInvoices', inv.id)
    toast.success('Invoice deleted', inv.number)
    after?.()
  }
}

/* ---------------- List ---------------- */
export function InvoiceList() {
  usePageTitle('Sales invoices')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const f = useSalesFilters()
  const del = useInvoiceDelete()
  const customers = byId(state.customers)

  const all = useMemo(
    () => state.salesInvoices.map((i) => ({ ...i, _st: salesInvoiceStatus(state, i), _customer: customers.get(i.customerId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.salesInvoices, state.receipts, state.salesReturns, customers],
  )
  const rows = useMemo(() => all.filter((i) => matchCommon(i, f.values, i._st.status)), [all, f.values])

  const t = today()
  const todays = all.filter((i) => i.date === t)
  const month = all.filter((i) => i.date >= monthStart())
  const outstanding = all.reduce((a, i) => a + i._st.balance, 0)
  const overdue = all.filter((i) => i._st.status === 'Overdue')

  const columns = [
    { key: 'number', header: 'Invoice no.', render: (r) => <DocNo to={`/sales/invoices/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'customer', header: 'Customer', accessor: (r) => r._customer?.name, render: (r) => (<><div className="cell-primary">{r._customer?.name}</div><div className="cell-secondary">{r._customer?.city}</div></>) },
    { key: 'dueDate', header: 'Due date', render: (r) => (<><div>{fmtDate(r.dueDate)}</div>{r._st.daysOverdue > 0 && <div className="cell-secondary text-red">{r._st.daysOverdue} days overdue</div>}</>) },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.totals.grandTotal, render: (r) => <span className="num strong">{inr(r.totals.grandTotal)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (r) => r._st.balance, render: (r) => <span className={`num ${r._st.balance ? '' : 'muted'}`}>{inr(r._st.balance)}</span> },
    { key: 'status', header: 'Payment', accessor: (r) => r._st.status, render: (r) => <StatusBadge status={r._st.status} /> },
    { key: 'sent', header: 'Sent', accessor: (r) => (r.sentAt ? 'Sent' : 'Not sent'), render: (r) => <span className={`small ${r.sentAt ? '' : 'muted'}`}>{r.sentAt ? 'Sent' : 'Not sent'}</span> },
  ]

  const rowActions = (r) => [
    { label: 'View invoice', icon: Eye, onClick: () => navigate(`/sales/invoices/${r.id}`) },
    { label: 'Preview and print', icon: Printer, onClick: () => navigate(`/sales/invoices/${r.id}?preview=1`) },
    can('Accounts', 'add') && r._st.balance > 0 && { label: 'Receive payment', icon: Wallet, onClick: () => navigate(`/accounts/receipts/new?invoice=${r.id}`) },
    can('Sales', 'add') && { label: 'Create return', icon: Undo2, onClick: () => navigate(`/sales/returns/new?invoice=${r.id}`) },
    can('Sales', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/invoices/${r.id}/edit`) },
    can('Sales', 'delete') && { divider: true },
    can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(r) },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Sales invoices"
        subtitle="GST tax invoices with payment tracking. Open any invoice to print, send or record a receipt."
        breadcrumbs={[SALES_CRUMB, { label: 'Sales invoices' }]}
        actions={can('Sales', 'add') && <Button variant="primary" icon={Plus} to="/sales/invoices/new">New invoice</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Today’s sales" value={inr(todays.reduce((a, i) => a + i.totals.grandTotal, 0))} icon={Receipt} tone="blue" foot={`${todays.length} invoices today`} />
        <StatCard label="This month" value={inr(month.reduce((a, i) => a + i.totals.grandTotal, 0))} icon={IndianRupee} tone="green" foot={`${month.length} invoices`} />
        <StatCard label="Outstanding" value={inr(outstanding)} icon={Wallet} tone="brass" foot="Across all unpaid invoices" to="/accounts/outstanding?tab=receivable" />
        <StatCard label="Overdue invoices" value={overdue.length} icon={AlertTriangle} tone="red" foot={`${inr(overdue.reduce((a, i) => a + i._st.balance, 0))} past due date`} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
        rowActions={rowActions}
        exportName="sales-invoices"
        searchPlaceholder="Search invoice no., customer…"
        filters={<FilterPanel filters={filterDefs(state, PAYMENT_STATUSES, [salesPersonFilter]).map((d) => (d.key === 'status' ? { ...d, label: 'Payment statuses', width: 170 } : d))} values={f.values} onChange={f.onChange} onReset={f.reset} />}
        emptyTitle="No invoices match"
        emptyDescription="Raise an invoice from a delivery challan or directly for a customer."
        emptyAction={can('Sales', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/sales/invoices/new">New invoice</Button>}
      />
    </>
  )
}

/* ---------------- Form ---------------- */
export function InvoiceForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('salesInvoices', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New sales invoice')

  const [doc, setDoc] = useState(() => {
    if (existing) {
      return { ...existing, sameAsBilling: existing.shippingAddress === existing.billingAddress, lines: existing.lines.map((l) => ({ ...l })) }
    }
    const base = { date: today(), dueDate: today(), customerId: '', soId: null, dcId: null, warehouseId: 'wh-fgg', salesPerson: SALES_PERSONS[0], billingAddress: '', shippingAddress: '', sameAsBilling: true, placeOfSupply: '', vehicleNo: '', lines: [newLine()], notes: '' }
    const withCustomer = (b, c) => (c ? { ...b, customerId: c.id, billingAddress: customerAddress(c), shippingAddress: customerAddress(c), placeOfSupply: c.state, dueDate: addDays(b.date, termDays(c.paymentTerms)) } : b)
    const dc = params.get('dc') ? get('deliveryChallans', params.get('dc')) : null
    if (dc) {
      const so = get('salesOrders', dc.soId)
      const lines = dc.lines
        .filter((l) => Number(l.deliveredQty) > 0)
        .map((l) => {
          const sl = so?.lines.find((x) => x.itemId === l.itemId)
          return newLine({ itemId: l.itemId, qty: Number(l.deliveredQty), rate: sl?.rate ?? l.rate, discount: sl?.discount || 0, gst: sl?.gst ?? get('items', l.itemId)?.gst ?? 18 })
        })
      return withCustomer({ ...base, dcId: dc.id, soId: dc.soId || null, warehouseId: dc.warehouseId, salesPerson: so?.salesPerson || base.salesPerson, vehicleNo: dc.transport?.vehicleNo || '', lines: lines.length ? lines : [newLine()] }, get('customers', dc.customerId))
    }
    const so = params.get('so') ? get('salesOrders', params.get('so')) : null
    if (so) {
      const invoiced = {}
      state.salesInvoices.filter((i) => i.soId === so.id).forEach((i) => i.lines.forEach((l) => { invoiced[l.itemId] = (invoiced[l.itemId] || 0) + Number(l.qty) }))
      const lines = so.lines
        .map((l) => newLine({ itemId: l.itemId, qty: Math.max(0, Number(l.qty) - (invoiced[l.itemId] || 0)), rate: l.rate, discount: l.discount, gst: l.gst }))
        .filter((l) => l.qty > 0)
      return withCustomer({ ...base, soId: so.id, salesPerson: so.salesPerson || base.salesPerson, lines: lines.length ? lines : [newLine()] }, get('customers', so.customerId))
    }
    return withCustomer(base, params.get('customer') ? get('customers', params.get('customer')) : null)
  })
  const [dueTouched, setDueTouched] = useState(Boolean(existing))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(null)

  if (id && !existing) return <DocNotFound label="Sales invoice" to="/sales/invoices" />

  const customer = get('customers', doc.customerId)
  const so = doc.soId ? get('salesOrders', doc.soId) : null
  const dc = doc.dcId ? get('deliveryChallans', doc.dcId) : null
  const dcAlreadyInvoiced = dc && state.salesInvoices.some((i) => i.dcId === dc.id && i.id !== existing?.id)
  const lines = cleanLines(doc.lines)
  const interState = isInterState(doc.placeOfSupply || customer?.state)
  const totals = calcTotals(lines, { interState })
  const items = byId(state.items)
  const shortages = !doc.dcId
    ? lines.filter((l) => Number(l.qty) > itemStock(state, l.itemId, doc.warehouseId) + (existing && !existing.dcId ? Number(existing.lines.find((x) => x.itemId === l.itemId)?.qty) || 0 : 0))
    : []

  const set = (k, v) => {
    setErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'customerId') {
      const c = get('customers', v)
      setDoc((d) => ({
        ...d,
        customerId: v,
        billingAddress: customerAddress(c),
        shippingAddress: customerAddress(c),
        placeOfSupply: c?.state || '',
        dueDate: dueTouched || !c ? d.dueDate : addDays(d.date, termDays(c.paymentTerms)),
      }))
    } else if (k === 'date') {
      setDoc((d) => ({ ...d, date: v, dueDate: dueTouched || !customer ? d.dueDate : addDays(v, termDays(customer.paymentTerms)) }))
    } else if (k === 'dueDate') {
      setDueTouched(true)
      setDoc((d) => ({ ...d, dueDate: v }))
    } else {
      setDoc((d) => ({ ...d, [k]: v }))
    }
  }

  const persist = async (andPreview) => {
    const errs = {}
    if (!doc.customerId) errs.customerId = 'Select a customer'
    if (!doc.date) errs.date = 'Enter the invoice date'
    if (!doc.dueDate) errs.dueDate = 'Enter the due date'
    else if (doc.dueDate < doc.date) errs.dueDate = 'Must be on or after the invoice date'
    if (!doc.billingAddress?.trim()) errs.billingAddress = 'Enter the billing address'
    if (!doc.placeOfSupply) errs.placeOfSupply = 'Select the place of supply'
    if (!lines.length) errs.lines = 'Add at least one item with quantity'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(andPreview ? 'preview' : 'save')
    await fakeDelay()
    const { sameAsBilling, ...rest } = doc
    const record = { ...rest, shippingAddress: sameAsBilling ? doc.billingAddress : doc.shippingAddress, lines, totals }
    const number = existing?.number || previewNumber('salesInvoices', doc.date)
    const saved = save('salesInvoices', record, existing ? {} : { notify: { type: 'invoice', title: 'Invoice generated', message: `${number} for ${customer.name} – ${inr(totals.grandTotal)}.`, link: '/sales/invoices' } })
    setSaving(null)
    toast.success(existing ? 'Invoice updated' : 'Invoice saved', `${saved.number}, ${inr(totals.grandTotal)}${!doc.dcId && !existing ? '. Stock updated.' : '.'}`)
    navigate(`/sales/invoices/${saved.id}${andPreview ? '?preview=1' : ''}`)
  }

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New sales invoice'}
        subtitle="Tax is split into CGST and SGST for Uttar Pradesh customers, and IGST for other states."
        breadcrumbs={[...CRUMBS, { label: existing ? existing.number : 'New' }]}
      />
      <FormShell
        onSubmit={(e) => {
          e.preventDefault()
          persist(false)
        }}
        main={
          <>
            {(so || dc) && (
              <Callout>
                Billing against {so && <>sales order <DocNo to={`/sales/orders/${so.id}`}>{so.number}</DocNo></>}
                {so && dc && ' and '}
                {dc && <>delivery challan <DocNo to={`/sales/challans/${dc.id}`}>{dc.number}</DocNo></>}.{' '}
                {dc ? 'Stock was already reduced when the challan was saved.' : 'Stock will be reduced from the dispatch warehouse when you save.'}
              </Callout>
            )}
            {dcAlreadyInvoiced && <Callout tone="amber">This delivery challan already has an invoice. Saving will create a second invoice for the same goods.</Callout>}
            <Card title="Invoice details">
              <Fields
                values={doc}
                errors={errors}
                onChange={set}
                defs={[
                  { name: 'number', label: 'Invoice no.', readOnly: true, value: existing?.number || previewNumber('salesInvoices', doc.date) },
                  { name: 'date', label: 'Invoice date', type: 'date', required: true },
                  { name: 'dueDate', label: 'Due date', type: 'date', required: true, hint: customer ? `${customer.paymentTerms} credit` : undefined },
                  { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customerOptions(state, doc.customerId), placeholder: 'Select customer', span: 2, disabled: Boolean(doc.dcId) },
                  { name: 'gstin', label: 'Customer GSTIN', readOnly: true, value: customer?.gstin || '' },
                  { name: 'placeOfSupply', label: 'Place of supply', type: 'select', required: true, options: STATE_NAMES.map((s) => ({ value: s, label: `${s} (${stateCode(s)})` })) },
                  { name: 'salesPerson', label: 'Sales person', type: 'select', options: SALES_PERSONS },
                  !doc.dcId ? { name: 'warehouseId', label: 'Dispatch from', type: 'select', options: warehouseOptions(state, doc.warehouseId) } : { name: 'vehicleNo', label: 'Vehicle no.', uppercase: true },
                ]}
              />
            </Card>
            <Card title="Addresses">
              <div className="form-grid cols-2">
                <Field label="Billing address" required error={errors.billingAddress}>
                  <Textarea rows={3} value={doc.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} />
                </Field>
                <Field label="Shipping address">
                  <Textarea rows={3} value={doc.sameAsBilling ? doc.billingAddress : doc.shippingAddress} disabled={doc.sameAsBilling} onChange={(e) => set('shippingAddress', e.target.value)} />
                  <Checkbox label="Same as billing address" checked={doc.sameAsBilling} onChange={(v) => setDoc((d) => ({ ...d, sameAsBilling: v, shippingAddress: v ? d.billingAddress : d.shippingAddress }))} />
                </Field>
              </div>
            </Card>
            <Card title="Items" subtitle={interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST + SGST apply'}>
              <LineItemsEditor lines={doc.lines} onChange={(l) => set('lines', l)} rateField="salesRate" itemFilter={isSellable} stockWarehouseId={doc.warehouseId} showStock={!doc.dcId} error={errors.lines} />
              {shortages.length > 0 && (
                <Callout tone="amber" style={{ marginTop: 12 }}>
                  Not enough stock in {get('warehouses', doc.warehouseId)?.name} for {shortages.map((l) => items.get(l.itemId)?.name).join(', ')}. The invoice can still be saved; stock will go negative.
                </Callout>
              )}
            </Card>
            <Card title="Notes">
              <Fields cols={1} values={doc} onChange={set} defs={[{ name: 'notes', label: 'Notes printed on invoice', type: 'textarea', rows: 2, placeholder: 'Goods dispatched in 8 master cartons' }]} />
            </Card>
          </>
        }
        side={
          <>
            <CustomerCard customerId={doc.customerId} />
            <Card title="Invoice total">
              <TotalsSummary totals={totals} showWords />
            </Card>
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(existing ? `/sales/invoices/${existing.id}` : '/sales/invoices')} disabled={Boolean(saving)}>Cancel</Button>
            <Button type="submit" loading={saving === 'save'} disabled={saving === 'preview'}>Save</Button>
            <Button variant="primary" icon={Eye} loading={saving === 'preview'} disabled={saving === 'save'} onClick={() => persist(true)}>Save &amp; preview</Button>
          </>
        }
      />
    </>
  )
}

/* ---------------- View ---------------- */
export function InvoiceView() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { state, get, patch } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const del = useInvoiceDelete()
  const inv = get('salesInvoices', id)
  usePageTitle(inv?.number || 'Sales invoice')
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [send, setSend] = useState({ email: '', whatsapp: '', message: '', attach: true })
  const preview = params.get('preview') === '1'
  const setPreview = (open) => {
    const next = new URLSearchParams(params)
    if (open) next.set('preview', '1')
    else next.delete('preview')
    setParams(next, { replace: true })
  }

  if (!inv) return <DocNotFound label="Sales invoice" to="/sales/invoices" />

  const customer = get('customers', inv.customerId)
  const so = inv.soId ? get('salesOrders', inv.soId) : null
  const dc = inv.dcId ? get('deliveryChallans', inv.dcId) : null
  const st = salesInvoiceStatus(state, inv)
  const receipts = state.receipts.filter((r) => r.invoiceId === inv.id).sort((a, b) => (a.date < b.date ? -1 : 1))
  const returns = state.salesReturns.filter((r) => r.invoiceId === inv.id)
  const interState = inv.totals.interState ?? isInterState(inv.placeOfSupply || customer?.state)
  const pos = inv.placeOfSupply || customer?.state
  const dueIn = daysBetween(today(), inv.dueDate)

  const paper = {
    title: 'Tax Invoice',
    subtitle: 'Original for Recipient',
    numberLabel: 'Invoice No.',
    number: inv.number,
    date: inv.date,
    meta: [
      { label: 'Due date', value: fmtDate(inv.dueDate) },
      { label: 'Place of supply', value: pos ? `${pos} (${stateCode(pos)})` : '' },
      { label: 'Sales order', value: so?.number },
      { label: 'Delivery challan', value: dc?.number },
      { label: 'Vehicle no.', value: inv.vehicleNo || dc?.transport?.vehicleNo },
      { label: 'Sales person', value: inv.salesPerson },
    ],
    party: { ...partyOf(customer), address: inv.billingAddress || customerAddress(customer) },
    shipTo: {
      heading: 'Ship To',
      name: customer?.name,
      address: inv.shippingAddress || inv.billingAddress,
      right: [
        { label: 'Transporter', value: dc?.transport?.transporter },
        { label: 'LR no.', value: dc?.transport?.lrNo },
        { label: 'E-way bill', value: dc?.transport?.ewayBill },
      ],
    },
    lines: inv.lines,
    totals: inv.totals,
    interState,
    notes: inv.notes,
    showBank: true,
    stamp: st.status === 'Paid' ? 'PAID' : undefined,
  }

  const openSend = () => {
    setSend({
      email: customer?.email || '',
      whatsapp: customer?.mobile || '',
      message: `Dear ${customer?.contactPerson || customer?.name},\n\nPlease find attached tax invoice ${inv.number} dated ${fmtDate(inv.date)} for ${inr(inv.totals.grandTotal)}, due on ${fmtDate(inv.dueDate)}.\n\nRegards,\n${state.settings.company.name}`,
      attach: true,
    })
    setSendOpen(true)
  }
  const doSend = async () => {
    if (!send.email && !send.whatsapp) {
      toast.error('Add an email or WhatsApp number', 'At least one channel is needed to send the invoice.')
      return
    }
    setSending(true)
    await fakeDelay(700)
    patch('salesInvoices', inv.id, { sentAt: new Date().toISOString() })
    setSending(false)
    setSendOpen(false)
    toast.success('Invoice sent', `${inv.number} marked as sent. In this demo no email or WhatsApp message leaves the browser.`)
  }
  const downloadPdf = () => {
    toast.info('Download PDF', 'Choose “Save as PDF” as the destination in the print dialog.')
    printPage()
  }

  return (
    <>
      <PageHeader
        title={inv.number}
        badge={<StatusBadge status={st.status} />}
        subtitle={`${customer?.name || 'Customer'}, invoiced on ${fmtDate(inv.date)}`}
        breadcrumbs={[...CRUMBS, { label: inv.number }]}
        actions={
          <>
            <Button icon={Send} onClick={openSend}>Send</Button>
            <Button icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            <Button icon={Download} onClick={downloadPdf}>Download PDF</Button>
            {can('Accounts', 'add') && st.balance > 0 && (
              <Button variant="primary" icon={Wallet} onClick={() => navigate(`/accounts/receipts/new?invoice=${inv.id}`)}>Receive payment</Button>
            )}
            <Dropdown
              width={180}
              items={[
                can('Sales', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/invoices/${inv.id}/edit`) },
                can('Sales', 'add') && { label: 'Create return', icon: Undo2, onClick: () => navigate(`/sales/returns/new?invoice=${inv.id}`) },
                can('Sales', 'delete') && { divider: true },
                can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(inv, () => navigate('/sales/invoices')) },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} aria-label="More actions" iconOnly />}
            />
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Invoice amount" value={inr2(inv.totals.grandTotal)} icon={FileText} tone="blue" foot={`${inv.lines.length} items, GST ${inr(inv.totals.gst)}`} />
        <StatCard label="Received" value={inr2(st.paid)} icon={IndianRupee} tone="green" foot={`${receipts.length} receipt(s)${returns.length ? `, ${returns.length} return(s)` : ''}`} />
        <StatCard label="Balance due" value={inr2(st.balance)} icon={Wallet} tone={st.balance ? 'amber' : 'green'} foot={st.balance ? 'Pending from customer' : 'Fully settled'} />
        <StatCard
          label="Due date"
          value={fmtDate(inv.dueDate)}
          icon={CalendarClock}
          tone={st.status === 'Overdue' ? 'red' : 'gray'}
          foot={st.status === 'Paid' ? 'Paid' : st.daysOverdue > 0 ? `${st.daysOverdue} days overdue` : dueIn === 0 ? 'Due today' : `Due in ${dueIn} days`}
        />
      </div>

      <div className="sales-split">
        <div className="stack">
          <div className="invoice-paper-wrap">{!preview && <DocumentPaper {...paper} />}</div>
        </div>
        <div className="stack">
          <Card title="Payment" actions={<StatusBadge status={st.status} />}>
            <div className="stack-sm" style={{ gap: 12 }}>
              <div>
                <div className="row-between small" style={{ marginBottom: 5 }}>
                  <span className="muted">Collected</span>
                  <span className="num">{Math.round((st.paid / (st.amount || 1)) * 100)}%</span>
                </div>
                <Progress value={(st.paid / (st.amount || 1)) * 100} tone={st.status === 'Overdue' ? 'red' : st.balance ? 'amber' : 'green'} />
              </div>
              {st.status === 'Overdue' && <Callout tone="red">Payment is {st.daysOverdue} days overdue. Send a reminder or call {customer?.contactPerson}.</Callout>}
              {receipts.length === 0 && returns.length === 0 ? (
                <div className="small muted">No payments recorded yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table compact">
                    <thead>
                      <tr><th>Date</th><th>Reference</th><th className="align-right">Amount</th></tr>
                    </thead>
                    <tbody>
                      {receipts.map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{fmtDate(r.date)}</td>
                          <td><div className="doc-no">{r.number}</div><div className="cell-secondary">{r.mode}</div></td>
                          <td className="align-right num">{inr(r.amount)}</td>
                        </tr>
                      ))}
                      {returns.map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{fmtDate(r.date)}</td>
                          <td><DocNo to={`/sales/returns/${r.id}`}>{r.number}</DocNo><div className="cell-secondary">Sales return credit</div></td>
                          <td className="align-right num">{inr(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {can('Accounts', 'add') && st.balance > 0 && (
                <Button variant="soft" icon={Wallet} block onClick={() => navigate(`/accounts/receipts/new?invoice=${inv.id}`)}>Receive payment</Button>
              )}
            </div>
          </Card>
          <Card title="Sharing">
            <div className="row-between">
              <div className="small">
                {inv.sentAt ? (<><div className="strong">Sent to customer</div><div className="muted">{fmtDateTime(inv.sentAt)}</div></>) : (<><div className="strong">Not sent yet</div><div className="muted">Email or WhatsApp the invoice to the party.</div></>)}
              </div>
              <Button size="sm" icon={Send} onClick={openSend}>{inv.sentAt ? 'Send again' : 'Send'}</Button>
            </div>
          </Card>
          <CustomerCard customerId={inv.customerId} />
          <RelatedDocs type="invoice" doc={inv} />
          <Card title="Record">
            <KeyValue cols={2} items={[{ label: 'Created by', value: inv.createdBy || 'System' }, { label: 'Created on', value: fmtDateTime(inv.createdAt) }, { label: 'Warehouse', value: get('warehouses', dc?.warehouseId || inv.warehouseId)?.name, span: 2 }]} />
            {receipts.length > 0 && (
              <div className="small" style={{ marginTop: 10 }}>
                <Link to={`/accounts/customer-ledger?customer=${inv.customerId}`}>Open customer ledger</Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      <DocumentPreview open={preview} onClose={() => setPreview(false)} modalTitle="Invoice preview" onSend={() => { setPreview(false); openSend() }} sendLabel="Send" {...paper} />

      <Modal
        open={sendOpen}
        onClose={() => !sending && setSendOpen(false)}
        title="Send invoice"
        subtitle={`${inv.number} to ${customer?.name}`}
        footer={
          <>
            <Button onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button>
            <Button variant="primary" icon={Send} loading={sending} onClick={doSend}>Send invoice</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-grid cols-2">
            <Field label="Email to">
              <Input type="email" value={send.email} onChange={(e) => setSend((s) => ({ ...s, email: e.target.value }))} placeholder="accounts@party.in" />
            </Field>
            <Field label="WhatsApp number">
              <Input type="tel" value={send.whatsapp} onChange={(e) => setSend((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="+91 98110 23456" />
            </Field>
          </div>
          <Field label="Message">
            <Textarea rows={7} value={send.message} onChange={(e) => setSend((s) => ({ ...s, message: e.target.value }))} />
          </Field>
          <Checkbox label={`Attach ${inv.number.replace(/\//g, '-')}.pdf`} checked={send.attach} onChange={(v) => setSend((s) => ({ ...s, attach: v }))} />
          <Callout tone="gray">Demo mode: the invoice is only marked as sent. No email or WhatsApp message is delivered.</Callout>
        </div>
      </Modal>
    </>
  )
}
