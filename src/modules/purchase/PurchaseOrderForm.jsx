/** Purchase order — create / edit form (frontend-only demo). */
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Printer, Save, Send } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { calcTotals, isInterState } from '../../utils/calc.js'
import { addDays, fmtDate, inr, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, Field, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui/index.js'
import LineItemsEditor, { cleanLines, newLine } from '../../components/common/LineItemsEditor.jsx'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, MissingRecord, PO_TERMS, SupplierCard, partyFor, supplierOptions, warehouseOptions } from './shared.jsx'

export default function PurchaseOrderFormPage() {
  const { id } = useParams()
  const { search } = useLocation()
  return <PurchaseOrderForm key={`${id || 'new'}${search}`} />
}

function PurchaseOrderForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state, save, get, previewNumber, addNotification } = useErp()
  const toast = useToast()
  const existing = id ? get('purchaseOrders', id) : null
  usePageTitle(existing ? `Edit ${existing.number}` : 'New purchase order')

  const [values, setValues] = useState(() => {
    if (existing) return { ...existing, lines: existing.lines.map((l) => ({ ...l })) }
    const pr = get('purchaseRequisitions', params.get('pr'))
    const base = {
      date: today(),
      supplierId: params.get('supplier') || '',
      expectedDate: addDays(today(), 7),
      warehouseId: 'wh-rms',
      reference: '',
      prId: null,
      lines: [newLine()],
      terms: PO_TERMS,
      remarks: '',
    }
    if (!pr) return base
    const firstItem = get('items', pr.lines[0]?.itemId)
    const guess = state.suppliers.find((s) => s.status === 'Active' && s.itemIds?.includes(pr.lines[0]?.itemId))
    return {
      ...base,
      supplierId: base.supplierId || guess?.id || '',
      warehouseId: firstItem?.warehouseId || 'wh-rms',
      reference: `Against requisition ${pr.number}`,
      prId: pr.id,
      lines: pr.lines.map((l) => {
        const it = get('items', l.itemId)
        return newLine({ itemId: l.itemId, qty: l.qty, rate: Number(it?.purchaseRate) || 0, gst: it ? Number(it.gst) : 18 })
      }),
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState('')
  const [preview, setPreview] = useState(false)

  const supplier = get('suppliers', values.supplierId)
  const warehouse = get('warehouses', values.warehouseId)
  const pr = get('purchaseRequisitions', values.prId)
  const interState = isInterState(supplier?.state)
  const lines = useMemo(() => cleanLines(values.lines), [values.lines])
  const totals = useMemo(() => calcTotals(lines, { interState }), [lines, interState])

  if (id && !existing) return <MissingRecord what="Purchase order" to="/purchase/orders" />

  const locked = Boolean(existing) && !['Draft', 'Submitted'].includes(existing.status)
  const number = existing?.number || previewNumber('purchaseOrders', values.date)

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const onSupplier = (supplierId) => {
    const s = get('suppliers', supplierId)
    setValues((v) => {
      const empty = !v.lines.some((l) => l.itemId)
      const wh = empty && s?.itemIds?.length ? get('items', s.itemIds[0])?.warehouseId : null
      return { ...v, supplierId, warehouseId: wh || v.warehouseId }
    })
    setErrors((e) => ({ ...e, supplierId: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!values.supplierId) e.supplierId = 'Select a supplier'
    if (!values.date) e.date = 'Enter the PO date'
    if (!values.warehouseId) e.warehouseId = 'Select a warehouse'
    if (values.expectedDate && values.expectedDate < values.date) e.expectedDate = 'Delivery date can’t be before the PO date'
    if (!lines.length) e.lines = 'Add at least one item with a quantity'
    else if (lines.some((l) => !(Number(l.rate) > 0))) e.lines = 'Enter a rate for every item'
    setErrors(e)
    return e
  }

  const submit = async (status) => {
    const e = validate()
    if (Object.keys(e).length) {
      toast.error('Check the highlighted fields', Object.values(e)[0])
      return
    }
    setSaving(status)
    await fakeDelay()
    const rec = save('purchaseOrders', { ...values, lines, totals, status }, { action: status === 'Submitted' ? 'submitted' : undefined })
    setSaving('')
    if (status === 'Submitted' && !existing) {
      addNotification({ type: 'purchase', title: 'Purchase order awaiting approval', message: `${rec.number} from ${supplier.name} for ${inr(totals.grandTotal)}.`, link: `/purchase/orders/${rec.id}` })
    }
    toast.success(status === 'Draft' ? 'Draft saved' : 'Purchase order submitted', `${rec.number} for ${supplier.name}, ${inr(totals.grandTotal)}.`)
    navigate(`/purchase/orders/${rec.id}`)
  }

  const suppliedNames = supplier?.itemIds?.map((iid) => get('items', iid)?.name).filter(Boolean).join(', ')

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New purchase order'}
        subtitle="Raise an order to a supplier. Save it as a draft or submit it for approval."
        breadcrumbs={[CRUMB, { label: 'Purchase orders', to: '/purchase/orders' }, { label: existing ? existing.number : 'New' }]}
      />

      {locked && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          This order is {existing.status.toLowerCase()} and can no longer be edited. <Link to={`/purchase/orders/${existing.id}`}>Open the order</Link>
        </Callout>
      )}
      {pr && !existing && (
        <Callout style={{ marginBottom: 16 }}>
          Items loaded from requisition <Link to={`/purchase/requisitions/${pr.id}`} className="mono">{pr.number}</Link> raised by {pr.requestedBy}. Review rates before submitting.
        </Callout>
      )}

      <div className="pur-top mb-16">
        <Card title="Order details">
          <div className="form-grid">
            <Field label="PO number" hint={existing ? undefined : 'Assigned when you save'}>
              <Input value={number} readOnly className="mono" />
            </Field>
            <Field label="PO date" required error={errors.date}>
              <DatePicker value={values.date} disabled={locked} onChange={(v) => set('date', v)} />
            </Field>
            <Field label="Expected delivery date" error={errors.expectedDate}>
              <DatePicker value={values.expectedDate} min={values.date} disabled={locked} onChange={(v) => set('expectedDate', v)} />
            </Field>
            <Field label="Supplier" required error={errors.supplierId} span={2}>
              <Select options={supplierOptions(state, values.supplierId)} placeholder="Select supplier" value={values.supplierId} error={errors.supplierId} disabled={locked} onChange={(e) => onSupplier(e.target.value)} />
            </Field>
            <Field label="Deliver to warehouse" required error={errors.warehouseId}>
              <Select options={warehouseOptions(state, values.warehouseId)} placeholder="Select warehouse" value={values.warehouseId} error={errors.warehouseId} disabled={locked} onChange={(e) => set('warehouseId', e.target.value)} />
            </Field>
            <Field label="Reference" span={2}>
              <Input value={values.reference} placeholder="Supplier quotation no., rate contract or phone confirmation" disabled={locked} onChange={(e) => set('reference', e.target.value)} />
            </Field>
            <Field label="Status">
              <Input value={existing?.status || 'New'} readOnly />
            </Field>
          </div>
        </Card>
        <SupplierCard supplier={supplier} />
      </div>

      <Card title="Items" subtitle={suppliedNames ? `${supplier.name} usually supplies ${suppliedNames}` : 'Rates come from the item master and can be changed'} className="mb-16">
        <LineItemsEditor lines={values.lines} onChange={(v) => set('lines', v)} rateField="purchaseRate" stockWarehouseId={values.warehouseId} error={errors.lines} readOnly={locked} />
      </Card>

      <div className="grid-2">
        <Card title="Terms & remarks">
          <div className="stack-sm" style={{ gap: 12 }}>
            <Field label="Terms & conditions">
              <Textarea rows={5} value={values.terms} disabled={locked} onChange={(e) => set('terms', e.target.value)} />
            </Field>
            <Field label="Remarks">
              <Textarea rows={2} value={values.remarks} placeholder="Instructions for the supplier or store" disabled={locked} onChange={(e) => set('remarks', e.target.value)} />
            </Field>
          </div>
        </Card>
        <Card title="Order summary" subtitle={supplier ? (interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST and SGST apply') : 'Select a supplier to decide the GST type'}>
          <TotalsSummary totals={totals} showWords />
        </Card>
      </div>

      <div className="sticky-actions form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: 'auto' }}>
          Cancel
        </Button>
        <Button
          icon={Printer}
          onClick={() => {
            if (!supplier || !lines.length) {
              toast.warning('Nothing to print yet', 'Select a supplier and add at least one item.')
              return
            }
            setPreview(true)
          }}
        >
          Print
        </Button>
        <Button icon={Save} loading={saving === 'Draft'} disabled={locked || Boolean(saving)} onClick={() => submit('Draft')}>
          Save draft
        </Button>
        <Button variant="primary" icon={Send} loading={saving === 'Submitted'} disabled={locked || Boolean(saving)} onClick={() => submit('Submitted')}>
          Submit
        </Button>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        title="Purchase Order"
        numberLabel="PO No."
        number={number}
        date={values.date}
        party={partyFor(supplier)}
        meta={[
          { label: 'Expected delivery', value: fmtDate(values.expectedDate) },
          { label: 'Deliver to', value: warehouse?.name },
          { label: 'Reference', value: values.reference },
        ]}
        lines={lines}
        totals={totals}
        interState={interState}
        terms={values.terms}
        notes={values.remarks}
        sendLabel="Send to supplier"
      />
    </>
  )
}
