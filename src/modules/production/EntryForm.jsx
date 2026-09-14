/** Production entry form — records output and adds good units to finished goods stock. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Factory, PackageOpen } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock, productionProgress } from '../../store/selectors.js'
import { fmtDate, inr, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, Field, Input, PageHeader, Progress, Select, StatusBadge, useToast } from '../../components/ui/index.js'
import { CRUMB, OPEN_ORDER_STATUSES, SHIFTS, suggestLabourRate } from './shared.jsx'

const SUPERVISORS = ['Mohd. Irfan', 'Deepak Chauhan', 'Rajesh Kumar']

const costsFor = (produced, rate) => ({
  labourCost: Math.round((Number(produced) || 0) * (Number(rate) || 0)),
  otherCost: Math.round((Number(produced) || 0) * (Number(rate) || 0) * 0.35),
  freightCost: Math.round((Number(produced) || 0) * 1.2),
})

export default function EntryForm() {
  usePageTitle('Record production')
  const [params] = useSearchParams()
  const { state, save, get, previewNumber } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const items = byId(state.items)

  const [values, setValues] = useState(() => {
    const order = get('productionOrders', params.get('order'))
    return {
      date: today(),
      productionOrderId: order?.id || '',
      producedQty: '',
      rejectedQty: 0,
      wastageQty: 0,
      shift: 'Day',
      supervisor: 'Mohd. Irfan',
      labourRate: order ? suggestLabourRate(state, order.productId) : 15,
      labourCost: 0,
      otherCost: 0,
      freightCost: 0,
      warehouseId: order?.warehouseId || 'wh-fgg',
      remarks: '',
    }
  })
  const [autoCost, setAutoCost] = useState(true)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const order = get('productionOrders', values.productionOrderId)
  const product = items.get(order?.productId)
  const bom = order ? get('boms', order.bomId) : null
  const prog = order ? productionProgress(state, order.id) : null
  const balance = order ? Math.max(0, order.plannedQty - prog.produced) : 0
  const good = (Number(values.producedQty) || 0) - (Number(values.rejectedQty) || 0)
  const exceeds = order && prog.produced + (Number(values.producedQty) || 0) > order.plannedQty
  const noIssue = order && Object.keys(prog.issued).length === 0

  const orderOptions = state.productionOrders
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status) || o.id === values.productionOrderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name} (${o.status.toLowerCase()})` }))
  const warehouseOptions = state.warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.name }))

  const set = (patch) => {
    setValues((s) => {
      const next = { ...s, ...patch }
      return autoCost && ('producedQty' in patch || 'labourRate' in patch) ? { ...next, ...costsFor(next.producedQty, next.labourRate) } : next
    })
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const setCost = (k, v) => {
    setAutoCost(false)
    setValues((s) => ({ ...s, [k]: v }))
  }
  const onOrder = (oid) => {
    const o = get('productionOrders', oid)
    set({ productionOrderId: oid, warehouseId: o?.warehouseId || 'wh-fgg', labourRate: o ? suggestLabourRate(state, o.productId) : 15 })
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.productionOrderId) errs.productionOrderId = 'Select a production order'
    if (!values.date) errs.date = 'Select the date'
    if (!(Number(values.producedQty) > 0)) errs.producedQty = 'Enter the quantity produced'
    if (Number(values.rejectedQty) < 0) errs.rejectedQty = 'Can’t be negative'
    else if (Number(values.rejectedQty) > Number(values.producedQty)) errs.rejectedQty = 'Can’t be more than produced'
    if (!values.warehouseId) errs.warehouseId = 'Select a warehouse'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(450)
    const saved = save('productionEntries', {
      date: values.date,
      productionOrderId: order.id,
      productId: order.productId,
      bomId: order.bomId,
      plannedQty: order.plannedQty,
      producedQty: Number(values.producedQty),
      rejectedQty: Number(values.rejectedQty) || 0,
      wastageQty: Number(values.wastageQty) || 0,
      shift: values.shift,
      supervisor: values.supervisor,
      labourRate: Number(values.labourRate) || 0,
      labourCost: Number(values.labourCost) || 0,
      otherCost: Number(values.otherCost) || 0,
      freightCost: Number(values.freightCost) || 0,
      warehouseId: values.warehouseId,
      remarks: values.remarks,
    })
    setSaving(false)
    toast.success('Production recorded, finished goods stock updated', `${num(good)} good ${product?.unit} of ${product?.name} added.`)
    navigate(`/production/entries/${saved.id}?created=1`)
  }

  return (
    <>
      <PageHeader
        title="Record production"
        subtitle="Enter shift output. Good quantity (produced minus rejected) goes into finished goods stock."
        breadcrumbs={[CRUMB, { label: 'Production entries', to: '/production/entries' }, { label: 'New entry' }]}
      />
      <form onSubmit={submit} noValidate>
        <div className="prd-split">
          <div className="stack">
            <Card title="Production order">
              <div className="form-grid">
                <Field label="Production no.">
                  <Input className="mono" readOnly value={previewNumber('productionEntries', values.date)} />
                </Field>
                <Field label="Date" required error={errors.date}>
                  <DatePicker value={values.date} onChange={(v) => set({ date: v })} />
                </Field>
                <Field label="Shift">
                  <Select options={SHIFTS} value={values.shift} onChange={(e) => set({ shift: e.target.value })} />
                </Field>
                <Field label="Production order" required error={errors.productionOrderId} span={2}>
                  <Select options={orderOptions} placeholder="Select an open production order" value={values.productionOrderId} error={errors.productionOrderId} onChange={(e) => onOrder(e.target.value)} />
                </Field>
                <Field label="Supervisor">
                  <Select options={SUPERVISORS} value={values.supervisor} onChange={(e) => set({ supervisor: e.target.value })} />
                </Field>
              </div>
              {order && (
                <>
                  <div className="prd-order-strip mt-16">
                    <div><div className="kv-label">Product</div><div className="kv-value truncate">{product?.name}</div></div>
                    <div><div className="kv-label">BOM</div><div className="kv-value doc-no">{bom?.code}</div></div>
                    <div><div className="kv-label">Produced so far</div><div className="kv-value">{num(prog.produced)} of {num(order.plannedQty)}</div></div>
                    <div><div className="kv-label">Balance to produce</div><div className="kv-value">{num(balance)} {product?.unit}</div></div>
                  </div>
                  <Progress value={order.plannedQty ? (prog.produced / order.plannedQty) * 100 : 0} tone="brass" style={{ marginTop: 10 }} />
                </>
              )}
            </Card>

            {noIssue && (
              <Callout tone="amber">
                No material has been issued for {order.number} yet. Issue material first so raw material stock stays accurate.{' '}
                <a href={`/production/material-issue/new?order=${order.id}`} onClick={(e) => { e.preventDefault(); navigate(`/production/material-issue/new?order=${order.id}`) }}>
                  Issue material
                </a>
              </Callout>
            )}

            <Card title="Output">
              <div className="form-grid">
                <Field label="Planned quantity">
                  <Input readOnly value={order ? `${num(order.plannedQty)} ${product?.unit}` : ''} placeholder="From order" />
                </Field>
                <Field label="Produced quantity" required error={errors.producedQty} hint={order ? `Balance ${num(balance)}` : undefined}>
                  <Input type="number" min="0" step="1" value={values.producedQty} error={errors.producedQty} onChange={(e) => set({ producedQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Rejected quantity" error={errors.rejectedQty}>
                  <Input type="number" min="0" step="1" value={values.rejectedQty} error={errors.rejectedQty} onChange={(e) => set({ rejectedQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Good quantity" hint="Added to finished goods stock">
                  <Input readOnly value={Number(values.producedQty) ? num(Math.max(0, good)) : ''} />
                </Field>
                <Field label="Wastage (kg)" hint="Scrap generated in this shift">
                  <Input type="number" min="0" step="any" value={values.wastageQty} onChange={(e) => set({ wastageQty: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Finished goods warehouse" required error={errors.warehouseId}>
                  <Select options={warehouseOptions} value={values.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })} />
                </Field>
              </div>
              {exceeds && <Callout tone="amber" style={{ marginTop: 14 }}>Total production will exceed the planned quantity by {num(prog.produced + Number(values.producedQty) - order.plannedQty)} units. The order will be marked completed.</Callout>}
            </Card>

            <Card title="Cost" subtitle={autoCost ? 'Calculated from the standard labour rate. Edit any amount to override.' : 'Amounts entered manually'}>
              <div className="form-grid cols-4">
                <Field label="Labour rate per unit">
                  <Input type="number" min="0" step="any" prefix="₹" value={values.labourRate} onChange={(e) => set({ labourRate: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Labour cost">
                  <Input type="number" min="0" step="any" prefix="₹" value={values.labourCost} onChange={(e) => setCost('labourCost', e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
                <Field label="Other cost" hint="Power, plating, tooling">
                  <Input type="number" min="0" step="any" prefix="₹" value={values.otherCost} onChange={(e) => setCost('otherCost', e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
                <Field label="Transport / freight">
                  <Input type="number" min="0" step="any" prefix="₹" value={values.freightCost} onChange={(e) => setCost('freightCost', e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
                <Field label="Remarks" span="full">
                  <Input value={values.remarks} placeholder="Batch passed QC, machine downtime…" onChange={(e) => set({ remarks: e.target.value })} />
                </Field>
              </div>
            </Card>
          </div>

          <aside className="stack">
            <Card title="Entry summary">
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Produced</span><span>{num(values.producedQty || 0)}</span></div>
                <div className="totals-row"><span>Rejected</span><span className={Number(values.rejectedQty) ? 'text-red' : ''}>{num(values.rejectedQty || 0)}</span></div>
                <div className="totals-row grand"><span>Good units</span><span>{num(Math.max(0, good))}</span></div>
                <div className="totals-row"><span>Conversion cost</span><span>{inr((Number(values.labourCost) || 0) + (Number(values.otherCost) || 0) + (Number(values.freightCost) || 0))}</span></div>
                {product && (
                  <div className="totals-row"><span>Stock after entry</span><span>{num(itemStock(state, product.id, values.warehouseId) + Math.max(0, good))} {product.unit}</span></div>
                )}
              </div>
            </Card>
            {order && (
              <Card title="Order status">
                <div className="row-between">
                  <StatusBadge status={order.status} />
                  <span className="small muted">Expected {fmtDate(order.expectedDate)}</span>
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  Material issued for {Object.keys(prog.issued).length} of {bom?.components.length || 0} components.
                </div>
                {noIssue && (
                  <Button size="sm" variant="soft" icon={PackageOpen} to={`/production/material-issue/new?order=${order.id}`} style={{ marginTop: 10 }}>
                    Issue material
                  </Button>
                )}
              </Card>
            )}
          </aside>
        </div>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Factory} loading={saving}>
            Record production
          </Button>
        </div>
      </form>
    </>
  )
}
