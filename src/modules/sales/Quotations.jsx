/**
 * Quotations — list, form and detail (frontend-only demo; saved to the mock store).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Eye, FileText, MoreHorizontal, Pencil, Plus, Printer, Send, Trash2, TrendingUp, XCircle, Repeat } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { calcTotals, isInterState } from '../../utils/calc.js'
import { addDays, fmtDate, inr, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { SALES_PERSONS, STATUS } from '../../data/constants.js'
import { Button, Callout, Card, DataTable, DocNo, Dropdown, FilterPanel, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import LineItemsEditor, { cleanLines, newLine } from '../../components/common/LineItemsEditor.jsx'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import {
  CustomerCard, DocNotFound, Fields, FormShell, LinesTable, QUOTATION_TERMS, RelatedDocs, SALES_CRUMB,
  customerOptions, effectiveQuotationStatus, filterDefs, isSellable, matchCommon, monthStart, partyOf, salesPersonFilter, useSalesFilters,
} from './shared.jsx'

const CRUMBS = [SALES_CRUMB, { label: 'Quotations', to: '/sales/quotations' }]
const CLOSED = ['Converted', 'Rejected', 'Expired', 'Cancelled']

function useDeleteQuotation() {
  const { state, remove } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  return async (q, after) => {
    if (state.salesOrders.some((o) => o.quotationId === q.id)) {
      toast.error('This quotation can’t be deleted', 'A sales order was created from it. Cancel or delete the sales order first.')
      return
    }
    const ok = await confirm({ title: 'Delete quotation?', message: `${q.number} will be removed from the demo data. This can’t be undone.`, confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    remove('quotations', q.id)
    toast.success('Quotation deleted', q.number)
    after?.()
  }
}

/* ---------------- List ---------------- */
export function QuotationList() {
  usePageTitle('Quotations')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const f = useSalesFilters()
  const del = useDeleteQuotation()
  const customers = byId(state.customers)

  const all = useMemo(
    () => state.quotations.map((q) => ({ ...q, _status: effectiveQuotationStatus(q), _customer: customers.get(q.customerId) })),
    [state.quotations, customers],
  )
  const rows = useMemo(() => all.filter((q) => matchCommon(q, f.values, q._status)), [all, f.values])

  const open = all.filter((q) => ['Draft', 'Sent', 'Accepted'].includes(q._status))
  const decided = all.filter((q) => q._status !== 'Draft')
  const converted = all.filter((q) => q._status === 'Converted')
  const soon = open.filter((q) => q.validTill <= addDays(today(), 3))
  const month = all.filter((q) => q.date >= monthStart())

  const columns = [
    { key: 'number', header: 'Quotation no.', render: (r) => <DocNo to={`/sales/quotations/${r.id}`}>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'customer', header: 'Customer', accessor: (r) => r._customer?.name, render: (r) => (<><div className="cell-primary">{r._customer?.name}</div><div className="cell-secondary">{r._customer?.city}</div></>) },
    { key: 'validTill', header: 'Valid till', render: (r) => <span className={r._status === 'Expired' ? 'text-red' : ''}>{fmtDate(r.validTill)}</span> },
    { key: 'salesPerson', header: 'Sales person' },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (r) => r.totals.grandTotal, render: (r) => <span className="num strong">{inr(r.totals.grandTotal)}</span> },
    { key: 'status', header: 'Status', accessor: (r) => r._status, render: (r) => <StatusBadge status={r._status} /> },
  ]

  const rowActions = (r) => [
    { label: 'View details', icon: Eye, onClick: () => navigate(`/sales/quotations/${r.id}`) },
    can('Sales', 'edit') && r._status !== 'Converted' && { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sales/quotations/${r.id}/edit`) },
    { label: 'Print', icon: Printer, onClick: () => navigate(`/sales/quotations/${r.id}?print=1`) },
    can('Sales', 'add') && { label: 'Convert to sales order', icon: Repeat, disabled: CLOSED.includes(r._status), onClick: () => navigate(`/sales/orders/new?quotation=${r.id}`) },
    can('Sales', 'delete') && { divider: true },
    can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(r) },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle="Price offers sent to dealers and builders. Accepted quotations convert into sales orders."
        breadcrumbs={[SALES_CRUMB, { label: 'Quotations' }]}
        actions={can('Sales', 'add') && <Button variant="primary" icon={Plus} to="/sales/quotations/new">New quotation</Button>}
      />
      <div className="grid-4 mb-16">
        <StatCard label="Open quotations" value={open.length} icon={FileText} tone="blue" foot={`${inr(open.reduce((a, q) => a + q.totals.grandTotal, 0))} in pipeline`} />
        <StatCard label="Conversion rate" value={`${decided.length ? Math.round((converted.length / decided.length) * 100) : 0}%`} icon={TrendingUp} tone="green" foot={`${converted.length} converted to orders`} />
        <StatCard label="Expiring in 3 days" value={soon.length} icon={Clock} tone="amber" foot="Follow up before validity ends" />
        <StatCard label="Quoted this month" value={inr(month.reduce((a, q) => a + q.totals.grandTotal, 0))} icon={CheckCircle2} tone="brass" foot={`${month.length} quotations`} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => navigate(`/sales/quotations/${r.id}`)}
        rowActions={rowActions}
        exportName="quotations"
        searchPlaceholder="Search quotation no., customer…"
        filters={<FilterPanel filters={filterDefs(state, STATUS.quotation, [salesPersonFilter])} values={f.values} onChange={f.onChange} onReset={f.reset} />}
        emptyTitle="No quotations match"
        emptyDescription="Create a quotation to send prices to a customer."
        emptyAction={can('Sales', 'add') && <Button size="sm" variant="primary" icon={Plus} to="/sales/quotations/new">New quotation</Button>}
      />
    </>
  )
}

/* ---------------- Form ---------------- */
export function QuotationForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber } = useErp()
  const toast = useToast()
  const existing = id ? get('quotations', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New quotation')

  const [doc, setDoc] = useState(() =>
    existing
      ? { ...existing, lines: existing.lines.map((l) => ({ ...l })) }
      : { date: today(), validTill: addDays(today(), 15), customerId: params.get('customer') || '', salesPerson: SALES_PERSONS[0], lines: [newLine()], terms: QUOTATION_TERMS, notes: '', status: 'Draft' },
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (id && !existing) return <DocNotFound label="Quotation" to="/sales/quotations" />

  const customer = get('customers', doc.customerId)
  const lines = cleanLines(doc.lines)
  const totals = calcTotals(lines, { interState: isInterState(customer?.state) })
  const set = (k, v) => {
    setDoc((d) => ({ ...d, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!doc.customerId) errs.customerId = 'Select a customer'
    if (!doc.date) errs.date = 'Enter the quotation date'
    if (!doc.validTill) errs.validTill = 'Enter the validity date'
    else if (doc.validTill < doc.date) errs.validTill = 'Must be on or after the quotation date'
    if (!lines.length) errs.lines = 'Add at least one item with quantity'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay()
    const saved = save('quotations', { ...doc, lines, totals })
    setSaving(false)
    toast.success(existing ? 'Quotation updated' : 'Quotation saved', `${saved.number} for ${customer.name}, ${inr(totals.grandTotal)}.`)
    navigate(`/sales/quotations/${saved.id}`)
  }

  const title = existing ? `Edit ${existing.number}` : 'New quotation'
  return (
    <>
      <PageHeader title={title} subtitle="Prices default from the item master. Adjust rate or discount per line." breadcrumbs={[...CRUMBS, { label: existing ? existing.number : 'New' }]} />
      <FormShell
        onSubmit={submit}
        main={
          <>
            <Card title="Quotation details">
              <Fields
                values={doc}
                errors={errors}
                onChange={set}
                defs={[
                  { name: 'number', label: 'Quotation no.', readOnly: true, value: existing?.number || previewNumber('quotations', doc.date) },
                  { name: 'date', label: 'Quotation date', type: 'date', required: true },
                  { name: 'validTill', label: 'Valid till', type: 'date', required: true },
                  { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customerOptions(state, doc.customerId), placeholder: 'Select customer', span: 2 },
                  { name: 'salesPerson', label: 'Sales person', type: 'select', options: SALES_PERSONS },
                ]}
              />
            </Card>
            <Card title="Items" subtitle="Finished goods and trading goods">
              <LineItemsEditor lines={doc.lines} onChange={(l) => set('lines', l)} rateField="salesRate" itemFilter={isSellable} stockWarehouseId="wh-fgg" error={errors.lines} />
            </Card>
            <Card title="Terms and notes">
              <Fields
                cols={2}
                values={doc}
                onChange={set}
                defs={[
                  { name: 'terms', label: 'Terms & conditions', type: 'textarea', rows: 5 },
                  { name: 'notes', label: 'Notes for customer', type: 'textarea', rows: 5, placeholder: 'Special price for bulk order' },
                ]}
              />
            </Card>
          </>
        }
        side={
          <>
            <CustomerCard customerId={doc.customerId} />
            <Card title="Quotation total" subtitle={customer ? (totals.interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST + SGST apply') : 'Select a customer to apply GST'}>
              <TotalsSummary totals={totals} showWords />
            </Card>
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(existing ? `/sales/quotations/${existing.id}` : '/sales/quotations')} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save</Button>
          </>
        }
      />
    </>
  )
}

/* ---------------- View ---------------- */
export function QuotationView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { get, patch } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const del = useDeleteQuotation()
  const q = get('quotations', id)
  usePageTitle(q?.number || 'Quotation')
  const [preview, setPreview] = useState(params.get('print') === '1')

  if (!q) return <DocNotFound label="Quotation" to="/sales/quotations" />

  const customer = get('customers', q.customerId)
  const status = effectiveQuotationStatus(q)
  const canConvert = !CLOSED.includes(status)
  const setStatus = (s) => {
    patch('quotations', q.id, { status: s })
    toast.success(`Quotation marked as ${s.toLowerCase()}`, q.number)
  }

  return (
    <>
      <PageHeader
        title={q.number}
        badge={<StatusBadge status={status} />}
        subtitle={`${customer?.name || 'Customer'}, quoted on ${fmtDate(q.date)}`}
        breadcrumbs={[...CRUMBS, { label: q.number }]}
        actions={
          <>
            {can('Sales', 'edit') && status !== 'Converted' && <Button icon={Pencil} to={`/sales/quotations/${q.id}/edit`}>Edit</Button>}
            <Button icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            {can('Sales', 'add') && (
              <Button variant="primary" icon={Repeat} disabled={!canConvert} onClick={() => navigate(`/sales/orders/new?quotation=${q.id}`)} title={canConvert ? undefined : `A ${status.toLowerCase()} quotation can’t be converted`}>
                Convert to sales order
              </Button>
            )}
            <Dropdown
              width={200}
              items={[
                can('Sales', 'edit') && { label: 'Mark as sent', icon: Send, disabled: status !== 'Draft', onClick: () => setStatus('Sent') },
                can('Sales', 'edit') && { label: 'Mark as accepted', icon: CheckCircle2, disabled: !['Draft', 'Sent'].includes(status), onClick: () => setStatus('Accepted') },
                can('Sales', 'edit') && { label: 'Mark as rejected', icon: XCircle, disabled: !['Draft', 'Sent', 'Accepted'].includes(status), onClick: () => setStatus('Rejected') },
                can('Sales', 'delete') && { divider: true },
                can('Sales', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => del(q, () => navigate('/sales/quotations')) },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button icon={MoreHorizontal} onClick={toggle} aria-label="More actions" iconOnly />}
            />
          </>
        }
      />

      <div className="sales-split">
        <div className="stack">
          {status === 'Expired' && (
            <Callout tone="amber">This quotation expired on {fmtDate(q.validTill)}. Edit it and extend the validity to send revised prices.</Callout>
          )}
          <Card title="Quotation details">
            <KeyValue
              cols={4}
              items={[
                { label: 'Quotation date', value: fmtDate(q.date) },
                { label: 'Valid till', value: fmtDate(q.validTill) },
                { label: 'Sales person', value: q.salesPerson },
                { label: 'Grand total', value: inr(q.totals.grandTotal) },
              ]}
            />
          </Card>
          <Card title="Items" flush>
            <LinesTable lines={q.lines} interState={q.totals.interState} />
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <TotalsSummary totals={q.totals} showWords />
            </div>
          </Card>
          <div className="grid-2">
            <Card title="Terms & conditions"><div className="pre-line">{q.terms || '—'}</div></Card>
            <Card title="Notes"><div className="pre-line">{q.notes || 'No notes added.'}</div></Card>
          </div>
        </div>
        <div className="stack">
          <CustomerCard customerId={q.customerId} />
          <RelatedDocs type="quotation" doc={q} />
        </div>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        title="Quotation"
        numberLabel="Quotation No."
        number={q.number}
        date={q.date}
        meta={[
          { label: 'Valid till', value: fmtDate(q.validTill) },
          { label: 'Sales person', value: q.salesPerson },
        ]}
        party={partyOf(customer)}
        lines={q.lines}
        totals={q.totals}
        interState={q.totals.interState}
        notes={q.notes}
        terms={q.terms}
        sendLabel="Send quotation"
      />
    </>
  )
}
