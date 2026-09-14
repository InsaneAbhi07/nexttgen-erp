/** Material issue form — issues BOM materials for a production order and reduces stock. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PackageOpen, RotateCcw } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock, productionProgress, requiredMaterials } from '../../store/selectors.js'
import { uid } from '../../store/numbering.js'
import { round2 } from '../../utils/calc.js'
import { fmtDate, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DatePicker, Field, Input, PageHeader, Select, StatusBadge, useToast } from '../../components/ui/index.js'
import { CRUMB, OPEN_ORDER_STATUSES } from './shared.jsx'

const STORE_STAFF = ['Ramesh Pal', 'Suresh Yadav', 'Sunita Devi']
const FLOOR_STAFF = ['Mohd. Irfan', 'Deepak Chauhan', 'Rakesh Yadav']

function buildLines(state, order, warehouseId) {
  if (!order) return []
  const prog = productionProgress(state, order.id)
  return requiredMaterials(state, order.bomId, order.plannedQty, warehouseId).map((m) => {
    const already = prog.issued[m.itemId] || 0
    const remaining = Math.max(0, m.required - already)
    const issue = m.unit === 'KG' ? round2(Math.min(remaining, Math.max(0, m.available))) : Math.floor(Math.min(remaining, Math.max(0, m.available)) * 100) / 100
    return { id: uid('ln'), itemId: m.itemId, requiredQty: m.required, already, issuedQty: issue }
  })
}

export default function IssueForm() {
  usePageTitle('New material issue')
  const [params] = useSearchParams()
  const { state, save, get, previewNumber } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const items = byId(state.items)

  const [values, setValues] = useState(() => {
    const order = get('productionOrders', params.get('order'))
    const warehouseId = order?.rmWarehouseId || 'wh-rms'
    return { date: today(), productionOrderId: order?.id || '', warehouseId, issuedBy: 'Ramesh Pal', receivedBy: 'Mohd. Irfan', remarks: '', lines: buildLines(state, order, warehouseId) }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const order = get('productionOrders', values.productionOrderId)
  const product = items.get(order?.productId)
  const orderOptions = state.productionOrders
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status) || o.id === values.productionOrderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name} (${num(o.plannedQty)})` }))
  const warehouseOptions = state.warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.name }))

  const onOrder = (oid) => {
    const o = get('productionOrders', oid)
    const wh = o?.rmWarehouseId || 'wh-rms'
    setValues((s) => ({ ...s, productionOrderId: oid, warehouseId: wh, lines: buildLines(state, o, wh) }))
    setErrors({})
  }
  const updateLine = (idx, qty) => {
    setValues((s) => ({ ...s, lines: s.lines.map((l, i) => (i === idx ? { ...l, issuedQty: qty } : l)) }))
    setErrors((e) => ({ ...e, [`line${idx}`]: undefined, lines: undefined }))
  }

  const lines = values.lines.map((l) => {
    const it = items.get(l.itemId)
    const available = itemStock(state, l.itemId, values.warehouseId)
    const remainingAfter = round2(Math.max(0, l.requiredQty - l.already - (Number(l.issuedQty) || 0)))
    return { ...l, item: it, available, remainingAfter, over: (Number(l.issuedQty) || 0) > round2(l.requiredQty - l.already) }
  })
  const pending = lines.some((l) => l.requiredQty - l.already > 0)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.productionOrderId) errs.order = 'Select a production order'
    if (!values.warehouseId) errs.warehouseId = 'Select a warehouse'
    if (values.productionOrderId && !lines.some((l) => Number(l.issuedQty) > 0)) errs.lines = 'Enter the quantity to issue for at least one material'
    lines.forEach((l, idx) => {
      if (Number(l.issuedQty) < 0) errs[`line${idx}`] = 'Can’t be negative'
      else if (Number(l.issuedQty) > l.available) errs[`line${idx}`] = `Only ${num(l.available)} ${l.item?.unit} in store`
    })
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the material quantities', errs.order || errs.lines || 'Some quantities are more than the stock in store.')
      return
    }
    setSaving(true)
    await fakeDelay(450)
    const saved = save('materialIssues', {
      date: values.date,
      productionOrderId: values.productionOrderId,
      warehouseId: values.warehouseId,
      issuedBy: values.issuedBy,
      receivedBy: values.receivedBy,
      remarks: values.remarks,
      lines: lines.filter((l) => Number(l.issuedQty) > 0).map((l) => ({ id: l.id, itemId: l.itemId, requiredQty: l.requiredQty, issuedQty: Number(l.issuedQty) })),
    })
    setSaving(false)
    toast.success('Material issued, stock updated', `${saved.number} issued ${saved.lines.length} material(s) for ${order.number}.`)
    navigate(`/production/material-issue/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title="New material issue"
        subtitle="Quantities are filled from the BOM for the remaining requirement, limited to the stock in the selected store."
        breadcrumbs={[CRUMB, { label: 'Material issue', to: '/production/material-issue' }, { label: 'New issue' }]}
      />
      <form onSubmit={submit} noValidate className="stack">
        <Card title="Issue details">
          <div className="form-grid">
            <Field label="Issue no.">
              <Input className="mono" readOnly value={previewNumber('materialIssues', values.date)} />
            </Field>
            <Field label="Date" required>
              <DatePicker value={values.date} onChange={(v) => setValues((s) => ({ ...s, date: v }))} />
            </Field>
            <Field label="Issue from warehouse" required error={errors.warehouseId}>
              <Select options={warehouseOptions} value={values.warehouseId} onChange={(e) => setValues((s) => ({ ...s, warehouseId: e.target.value }))} />
            </Field>
            <Field label="Production order" required error={errors.order} span={2}>
              <Select options={orderOptions} placeholder="Select a planned, released or in-progress order" value={values.productionOrderId} error={errors.order} onChange={(e) => onOrder(e.target.value)} />
            </Field>
            <Field label="Issued by">
              <Select options={STORE_STAFF} value={values.issuedBy} onChange={(e) => setValues((s) => ({ ...s, issuedBy: e.target.value }))} />
            </Field>
            <Field label="Received by">
              <Select options={FLOOR_STAFF} value={values.receivedBy} onChange={(e) => setValues((s) => ({ ...s, receivedBy: e.target.value }))} />
            </Field>
            <Field label="Remarks" span={2}>
              <Input value={values.remarks} placeholder="Batch, shift or balance-issue notes" onChange={(e) => setValues((s) => ({ ...s, remarks: e.target.value }))} />
            </Field>
          </div>
          {order && (
            <div className="prd-order-strip mt-16">
              <div><div className="kv-label">Product</div><div className="kv-value truncate">{product?.name}</div></div>
              <div><div className="kv-label">Planned quantity</div><div className="kv-value">{num(order.plannedQty)} {product?.unit}</div></div>
              <div><div className="kv-label">Expected completion</div><div className="kv-value">{fmtDate(order.expectedDate)}</div></div>
              <div><div className="kv-label">Order status</div><div className="kv-value"><StatusBadge status={order.status} /></div></div>
            </div>
          )}
        </Card>

        {order && order.status === 'Planned' && <Callout>This order is still planned. Issuing material will move it to in progress.</Callout>}
        {order && !pending && <Callout tone="green">All BOM material for this order has already been issued. Add a quantity only for extra or replacement material.</Callout>}

        <Card
          title="Materials"
          subtitle={order ? `From the BOM for ${num(order.plannedQty)} ${product?.unit}` : 'Select a production order to load its materials'}
          flush
          actions={order && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onOrder(order.id)}>Reset to remaining</Button>}
        >
          {!order ? (
            <div className="empty-state" style={{ padding: '30px 16px' }}>
              <div className="empty-icon"><PackageOpen size={22} /></div>
              <div className="empty-title">No production order selected</div>
              <p className="empty-desc">Materials and quantities come from the order’s bill of material.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table line-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th className="align-center">#</th>
                    <th>Material</th>
                    <th className="align-right">Required</th>
                    <th className="align-right">Already issued</th>
                    <th style={{ width: 140 }}>Issue now</th>
                    <th className="align-right">Remaining after</th>
                    <th className="align-right">In store</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id}>
                      <td className="line-no">{idx + 1}</td>
                      <td style={{ paddingTop: 10 }}>
                        <div className="cell-primary">{l.item?.name}</div>
                        <div className="cell-secondary">{l.item?.code}</div>
                      </td>
                      <td className="line-amount" style={{ fontWeight: 400 }}>{num(l.requiredQty)} {l.item?.unit}</td>
                      <td className="line-amount" style={{ fontWeight: 400 }}>{num(l.already)}</td>
                      <td>
                        <input
                          className={`input input-sm ${errors[`line${idx}`] ? 'has-error' : ''}`}
                          type="number"
                          min="0"
                          step="any"
                          value={l.issuedQty}
                          aria-label={`Issue quantity for ${l.item?.name}`}
                          onChange={(e) => updateLine(idx, e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        {errors[`line${idx}`] ? (
                          <div className="field-error" style={{ marginTop: 3 }}>{errors[`line${idx}`]}</div>
                        ) : l.over ? (
                          <div className="line-meta text-amber">More than the BOM requirement</div>
                        ) : null}
                      </td>
                      <td className="line-amount">{l.remainingAfter > 0 ? num(l.remainingAfter) : <span className="text-green">Fully issued</span>}</td>
                      <td className={`line-amount ${l.available < l.requiredQty - l.already ? 'text-red' : ''}`}>{num(l.available)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.lines && <div className="field-error" style={{ padding: '10px 16px' }}>{errors.lines}</div>}
        </Card>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" icon={PackageOpen} loading={saving} disabled={!order}>
            Issue material
          </Button>
        </div>
      </form>
    </>
  )
}
