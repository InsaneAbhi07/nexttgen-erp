/** Job work challan — send material to a plater / buffer / heat treater. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Send, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { stageProgress } from '../../store/mfg.js'
import { JOB_WORK_PROCESSES } from '../../data/constants.js'
import { uid } from '../../store/numbering.js'
import { addDays, inr, inr2, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, Field, Input, PageHeader, Select, useToast } from '../../components/ui/index.js'
import { CRUMB, OPEN_ORDER_STATUSES } from './shared.jsx'

const JW_ITEM_TYPES = ['Raw Material', 'Semi Finished', 'Finished Good']
const blankLine = () => ({ id: uid('ln'), itemId: '', qty: '', rate: '' })

export default function JobWorkForm() {
  usePageTitle('Send for job work')
  const [params] = useSearchParams()
  const { state, save, get, previewNumber } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const items = byId(state.items)
  const workers = state.suppliers.filter((s) => s.jobWorker && s.status === 'Active')

  const [values, setValues] = useState(() => {
    const order = get('productionOrders', params.get('order'))
    const process = JOB_WORK_PROCESSES.includes(params.get('process')) ? params.get('process') : ''
    const worker = workers.find((w) => process && w.processes?.includes(process)) || workers[0]
    // Job charge from the order's route, if the route sends this process outside
    const op = order ? stageProgress(state, order).find((o) => o.mode === 'Job Work' && (!process || o.process === process)) : null
    return {
      date: today(),
      supplierId: worker?.id || '',
      process: process || op?.process || worker?.processes?.[0] || '',
      productionOrderId: order?.id || '',
      fromWarehouseId: 'wh-rms',
      returnWarehouseId: 'wh-rms',
      expectedDate: addDays(today(), 5),
      vehicleNo: '',
      remarks: order ? `Against ${order.number}` : '',
      lines: [{ ...blankLine(), rate: op?.ratePerPc || '' }],
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const worker = get('suppliers', values.supplierId)
  const processOptions = worker?.processes?.length ? worker.processes : JOB_WORK_PROCESSES
  const warehouseOptions = state.warehouses.filter((w) => w.status === 'Active' && !['wh-jbw', 'wh-scr'].includes(w.id)).map((w) => ({ value: w.id, label: w.name }))
  const orderOptions = state.productionOrders
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status) || o.id === values.productionOrderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name}` }))
  const itemOptions = state.items.filter((i) => i.status === 'Active' && JW_ITEM_TYPES.includes(i.type)).map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))

  const lines = values.lines.map((l) => {
    const item = items.get(l.itemId)
    const available = l.itemId ? itemStock(state, l.itemId, values.fromWarehouseId) : 0
    return { ...l, item, available, amount: (Number(l.qty) || 0) * (Number(l.rate) || 0) }
  })
  const totalQty = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0)
  const totalCharge = lines.reduce((a, l) => a + l.amount, 0)
  const materialValue = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.item?.purchaseRate) || 0), 0)

  const set = (patch) => {
    setValues((s) => ({ ...s, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const setLine = (idx, patch) => {
    setValues((s) => ({ ...s, lines: s.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }))
    setErrors((e) => ({ ...e, [`line${idx}`]: undefined, lines: undefined }))
  }
  const onWorker = (id) => {
    const w = get('suppliers', id)
    set({ supplierId: id, process: w?.processes?.includes(values.process) ? values.process : w?.processes?.[0] || '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.supplierId) errs.supplierId = 'Select a job worker'
    if (!values.process) errs.process = 'Select the process'
    if (!values.date) errs.date = 'Select the date'
    if (!values.expectedDate) errs.expectedDate = 'Select the expected return date'
    else if (values.expectedDate < values.date) errs.expectedDate = 'Can’t be before the challan date'
    const filled = lines.filter((l) => l.itemId)
    if (!filled.length) errs.lines = 'Add at least one item'
    lines.forEach((l, idx) => {
      if (!l.itemId) return
      if (!(Number(l.qty) > 0)) errs[`line${idx}`] = 'Enter a quantity'
      else if (Number(l.qty) > l.available) errs[`line${idx}`] = `Only ${num(l.available)} in stock`
    })
    const ids = filled.map((l) => l.itemId)
    if (new Set(ids).size !== ids.length) errs.lines = 'Each item can appear only once'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(450)
    const saved = save('jobWorkOrders', {
      date: values.date,
      supplierId: values.supplierId,
      process: values.process,
      productionOrderId: values.productionOrderId || null,
      fromWarehouseId: values.fromWarehouseId,
      returnWarehouseId: values.returnWarehouseId,
      expectedDate: values.expectedDate,
      vehicleNo: values.vehicleNo.trim(),
      remarks: values.remarks.trim(),
      lines: filled.map((l) => ({ id: l.id, itemId: l.itemId, qty: Number(l.qty), rate: Number(l.rate) || 0 })),
      status: 'Sent',
    })
    setSaving(false)
    toast.success('Job work challan created', `${saved.number}: ${num(totalQty)} pieces sent to ${worker?.name} for ${values.process.toLowerCase()}.`)
    navigate(`/production/job-work/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title="Send for job work"
        subtitle="Material moves from your store to “At Job Workers” until it comes back."
        breadcrumbs={[CRUMB, { label: 'Job work', to: '/production/job-work' }, { label: 'New challan' }]}
      />
      <form onSubmit={submit} noValidate>
        <div className="prd-split">
          <div className="stack">
            <Card title="Challan details">
              <div className="form-grid">
                <Field label="Challan no.">
                  <Input className="mono" readOnly value={previewNumber('jobWorkOrders', values.date)} />
                </Field>
                <Field label="Date" required error={errors.date}>
                  <DatePicker value={values.date} onChange={(v) => set({ date: v })} />
                </Field>
                <Field label="Expected return" required error={errors.expectedDate}>
                  <DatePicker value={values.expectedDate} onChange={(v) => set({ expectedDate: v })} />
                </Field>
                <Field label="Job worker" required error={errors.supplierId} span={2}>
                  <Select options={workers.map((w) => ({ value: w.id, label: `${w.name}, ${w.city}` }))} placeholder="Select job worker" value={values.supplierId} error={errors.supplierId} onChange={(e) => onWorker(e.target.value)} />
                </Field>
                <Field label="Process" required error={errors.process}>
                  <Select options={processOptions} placeholder="Select process" value={values.process} error={errors.process} onChange={(e) => set({ process: e.target.value })} />
                </Field>
                <Field label="Production order" span={2} hint="Optional – link the challan to a batch">
                  <Select options={orderOptions} placeholder="Not linked" value={values.productionOrderId} onChange={(e) => set({ productionOrderId: e.target.value })} />
                </Field>
                <Field label="Vehicle no.">
                  <Input value={values.vehicleNo} placeholder="UP81 AT 4521" onChange={(e) => set({ vehicleNo: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Send from">
                  <Select options={warehouseOptions} value={values.fromWarehouseId} onChange={(e) => set({ fromWarehouseId: e.target.value })} />
                </Field>
                <Field label="Return to">
                  <Select options={warehouseOptions} value={values.returnWarehouseId} onChange={(e) => set({ returnWarehouseId: e.target.value })} />
                </Field>
                <Field label="Remarks">
                  <Input value={values.remarks} placeholder="Shade as per master sample" onChange={(e) => set({ remarks: e.target.value })} />
                </Field>
              </div>
            </Card>

            <Card title="Material sent" subtitle="Job charge is per piece and is billed on pieces received back OK" flush>
              <div className="table-wrap">
                <table className="table line-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th className="align-center">#</th>
                      <th>Item</th>
                      <th className="align-right">In store</th>
                      <th style={{ width: 130 }}>Quantity</th>
                      <th style={{ width: 130 }}>Job charge / pc</th>
                      <th className="align-right">Amount</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="line-no">{idx + 1}</td>
                        <td style={{ minWidth: 240 }}>
                          <Select size="sm" options={itemOptions} placeholder="Select item" value={l.itemId} onChange={(e) => setLine(idx, { itemId: e.target.value })} />
                        </td>
                        <td className={`line-amount ${l.itemId && Number(l.qty) > l.available ? 'text-red' : ''}`} style={{ fontWeight: 400 }}>
                          {l.itemId ? `${num(l.available)} ${l.item?.unit}` : '—'}
                        </td>
                        <td>
                          <input className={`input input-sm ${errors[`line${idx}`] ? 'has-error' : ''}`} type="number" min="0" step="any" value={l.qty} aria-label="Quantity" onChange={(e) => setLine(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} />
                          {errors[`line${idx}`] && <div className="field-error" style={{ marginTop: 3 }}>{errors[`line${idx}`]}</div>}
                        </td>
                        <td>
                          <input className="input input-sm" type="number" min="0" step="any" value={l.rate} aria-label="Job charge per piece" onChange={(e) => setLine(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} />
                        </td>
                        <td className="line-amount">{inr2(l.amount)}</td>
                        <td>
                          <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Remove line" disabled={values.lines.length === 1} onClick={() => set({ lines: values.lines.filter((_, i) => i !== idx) })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px' }}>
                {errors.lines && <div className="field-error" style={{ marginBottom: 8 }}>{errors.lines}</div>}
                <Button size="sm" variant="soft" icon={Plus} onClick={() => set({ lines: [...values.lines, blankLine()] })}>Add item</Button>
              </div>
            </Card>
          </div>

          <aside className="stack">
            <Card title="Summary">
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Pieces sent</span><span>{num(totalQty)}</span></div>
                <div className="totals-row"><span>Material value</span><span>{inr(materialValue)}</span></div>
                <div className="totals-row grand"><span>Estimated job charges</span><span>{inr(totalCharge)}</span></div>
              </div>
            </Card>
            <Callout>
              Goods go out on a job work challan under Section 143 of the CGST Act, without GST. They must come back within one year.
            </Callout>
          </aside>
        </div>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Send} loading={saving}>Create challan</Button>
        </div>
      </form>
    </>
  )
}
