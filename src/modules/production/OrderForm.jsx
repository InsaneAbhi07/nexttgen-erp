/** Production order form with live material requirement check. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Play, Save, ShoppingCart } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock, productionProgress, requiredMaterials } from '../../store/selectors.js'
import { PRIORITIES } from '../../data/constants.js'
import { addDays, inr, inr2, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Badge, Button, Callout, Card, DatePicker, Field, Input, PageHeader, Select, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB, MissingRecord, activeBomFor, supplierFor } from './shared.jsx'

export default function OrderForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const editing = Boolean(id)
  const { state, save, get, previewNumber } = useErp()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const items = byId(state.items)
  const existing = editing ? get('productionOrders', id) : null
  usePageTitle(editing ? 'Edit production order' : 'New production order')

  const [values, setValues] = useState(() => {
    if (existing) return { ...existing }
    const productId = params.get('product') || ''
    const bom = productId ? activeBomFor(state, productId) : null
    return {
      date: today(),
      productId: bom ? productId : '',
      bomId: bom?.id || '',
      plannedQty: Number(params.get('qty')) || '',
      warehouseId: 'wh-fgg',
      rmWarehouseId: 'wh-rms',
      expectedDate: addDays(today(), 7),
      priority: 'Medium',
      remarks: '',
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(null)

  const materials = useMemo(
    () => (values.bomId && Number(values.plannedQty) > 0 ? requiredMaterials(state, values.bomId, values.plannedQty, values.rmWarehouseId) : []),
    [state, values.bomId, values.plannedQty, values.rmWarehouseId],
  )

  if (editing && !existing) return <MissingRecord label="Production order" backTo="/production/orders" />

  const prog = existing ? productionProgress(state, existing.id) : null
  const locked = Boolean(existing && (prog.produced > 0 || Object.keys(prog.issued).length > 0 || ['Completed', 'Cancelled'].includes(existing.status)))

  const productIds = [...new Set(state.boms.filter((b) => b.status === 'Active').map((b) => b.productId))]
  if (values.productId && !productIds.includes(values.productId)) productIds.push(values.productId)
  const productOptions = productIds.map((pid) => ({ value: pid, label: `${items.get(pid)?.name} (${items.get(pid)?.code})` }))
  const bomOptions = state.boms
    .filter((b) => b.productId === values.productId && (b.status !== 'Inactive' || b.id === values.bomId))
    .map((b) => ({ value: b.id, label: `${b.code} (v${b.version}, ${b.status.toLowerCase()})` }))
  const warehouseOptions = state.warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.name }))

  const product = items.get(values.productId)
  const bom = state.boms.find((b) => b.id === values.bomId)
  const shortages = materials.filter((m) => m.shortage > 0)
  const materialCost = materials.reduce((a, m) => a + m.required * m.rate, 0)
  const perUnit = Number(values.plannedQty) > 0 ? materialCost / Number(values.plannedQty) : 0

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onProduct = (pid) => {
    const b = activeBomFor(state, pid) || state.boms.find((x) => x.productId === pid && x.status !== 'Inactive')
    setValues((s) => ({ ...s, productId: pid, bomId: b?.id || '' }))
    setErrors((e) => ({ ...e, productId: undefined, bomId: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!values.date) errs.date = 'Select the order date'
    if (!values.productId) errs.productId = 'Select a product'
    if (!values.bomId) errs.bomId = 'Select a BOM'
    if (!(Number(values.plannedQty) > 0)) errs.plannedQty = 'Enter a quantity above 0'
    if (values.expectedDate && values.date && values.expectedDate < values.date) errs.expectedDate = 'Can’t be before the order date'
    if (!values.warehouseId) errs.warehouseId = 'Select a warehouse'
    if (!values.rmWarehouseId) errs.rmWarehouseId = 'Select a warehouse'
    return errs
  }

  const submit = async (status) => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', `${Object.keys(errs).length} field(s) need attention.`)
      return
    }
    if (status === 'Released' && shortages.length) {
      const ok = await confirm({
        title: 'Release with material shortage?',
        message: `${shortages.length} material(s) are short in the raw material store. You can still release the order and issue material after purchase.`,
        confirmLabel: 'Release order',
      })
      if (!ok) return
    }
    setSaving(status || 'save')
    await fakeDelay(400)
    const saved = save('productionOrders', {
      ...values,
      plannedQty: Number(values.plannedQty),
      status: status || existing?.status || 'Planned',
    })
    setSaving(null)
    toast.success(status === 'Released' ? 'Production order released' : 'Production order saved', `${saved.number} for ${num(saved.plannedQty)} × ${product.name}.`)
    navigate(`/production/orders/${saved.id}`)
  }

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${existing.number}` : 'New production order'}
        badge={editing ? <StatusBadge status={existing.status} /> : null}
        subtitle="Choose a product and quantity. Material availability is checked against the raw material store as you type."
        breadcrumbs={[CRUMB, { label: 'Production orders', to: '/production/orders' }, { label: editing ? existing.number : 'New order' }]}
      />

      <form onSubmit={(e) => { e.preventDefault(); submit(null) }} noValidate>
        <div className="prd-split">
          <div className="stack">
            {locked && (
              <Callout tone="amber">Material has been issued or production recorded, so product, BOM and quantity are locked. You can still change dates, priority and remarks.</Callout>
            )}
            <Card title="Order details">
              <div className="form-grid">
                <Field label="Order no.">
                  <Input className="mono" readOnly value={editing ? existing.number : previewNumber('productionOrders', values.date)} />
                </Field>
                <Field label="Order date" required error={errors.date}>
                  <DatePicker value={values.date} disabled={locked} onChange={(v) => set('date', v)} />
                </Field>
                <Field label="Priority">
                  <Select options={PRIORITIES} value={values.priority} onChange={(e) => set('priority', e.target.value)} />
                </Field>
                <Field label="Product" required error={errors.productId} span={2} hint={!productOptions.length ? 'Create an active BOM first' : 'Only products with an active BOM are listed'}>
                  <Select options={productOptions} placeholder="Select product" value={values.productId} error={errors.productId} disabled={locked} onChange={(e) => onProduct(e.target.value)} />
                </Field>
                <Field label="BOM" required error={errors.bomId}>
                  <Select options={bomOptions} placeholder={values.productId ? 'Select BOM' : 'Select a product first'} value={values.bomId} error={errors.bomId} disabled={locked || !values.productId} onChange={(e) => set('bomId', e.target.value)} />
                </Field>
                <Field label="Planned quantity" required error={errors.plannedQty} hint={product ? `In ${product.unit}, current stock ${num(itemStock(state, product.id))}` : undefined}>
                  <Input type="number" min="0" step="1" value={values.plannedQty} error={errors.plannedQty} disabled={locked} onChange={(e) => set('plannedQty', e.target.value === '' ? '' : Number(e.target.value))} />
                </Field>
                <Field label="Expected completion" error={errors.expectedDate}>
                  <DatePicker value={values.expectedDate} min={values.date} onChange={(v) => set('expectedDate', v)} />
                </Field>
                <Field label="Finished goods warehouse" required error={errors.warehouseId}>
                  <Select options={warehouseOptions} value={values.warehouseId} onChange={(e) => set('warehouseId', e.target.value)} />
                </Field>
                <Field label="Raw material warehouse" required error={errors.rmWarehouseId}>
                  <Select options={warehouseOptions} value={values.rmWarehouseId} disabled={locked} onChange={(e) => set('rmWarehouseId', e.target.value)} />
                </Field>
                <Field label="Remarks" span={2}>
                  <Input value={values.remarks} placeholder="Against SO backlog, festive build-up…" onChange={(e) => set('remarks', e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card
              title="Required materials"
              subtitle={bom ? `${bom.code} × ${num(values.plannedQty || 0)} ${product?.unit || ''}` : 'Select a product and quantity'}
              flush
              actions={materials.length > 0 && (shortages.length ? <Badge tone="red" dot>{shortages.length} short</Badge> : <Badge tone="green" dot>All available</Badge>)}
            >
              {materials.length === 0 ? (
                <div className="empty-state" style={{ padding: '28px 16px' }}>
                  <div className="empty-title">No materials to check yet</div>
                  <p className="empty-desc">Choose a product with a BOM and enter the planned quantity.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table compact">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th className="align-right">Per unit</th>
                        <th className="align-right">Required</th>
                        <th className="align-right">Available</th>
                        <th className="align-right">Shortage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m) => (
                        <tr key={m.itemId}>
                          <td>
                            <div className="cell-primary">{m.item?.name}</div>
                            <div className="cell-secondary">{m.item?.code}</div>
                          </td>
                          <td className="align-right">{num(m.perUnit)} {m.unit}</td>
                          <td className="align-right strong">{num(m.required)} {m.unit}</td>
                          <td className="align-right">{num(m.available)}</td>
                          <td className={`align-right ${m.shortage > 0 ? 'text-red strong' : 'muted'}`}>{m.shortage > 0 ? num(m.shortage) : '—'}</td>
                          <td><StatusBadge status={m.shortage <= 0 ? 'In Stock' : m.available > 0 ? 'Low Stock' : 'Out of Stock'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <aside className="stack">
            <Card title="Plan summary">
              <div className="totals" style={{ maxWidth: 'none' }}>
                <div className="totals-row"><span>Product</span><span className="truncate" style={{ maxWidth: 170 }}>{product?.name || '—'}</span></div>
                <div className="totals-row"><span>BOM</span><span className="doc-no">{bom?.code || '—'}</span></div>
                <div className="totals-row"><span>Materials</span><span>{materials.length}</span></div>
                <div className="totals-row"><span>Material cost per unit</span><span>{inr2(perUnit)}</span></div>
                <div className="totals-row"><span>Selling price</span><span>{inr2(product?.salesRate || 0)}</span></div>
                <div className="totals-row grand"><span>Total material cost</span><span>{inr(materialCost)}</span></div>
              </div>
            </Card>
            {shortages.length > 0 && (
              <Card title="Material shortage" subtitle="Raise purchase orders before issuing material">
                <div className="stack-sm">
                  {shortages.map((m) => {
                    const sup = supplierFor(state, m.itemId)
                    return (
                      <div key={m.itemId} className="row-between" style={{ alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="small strong truncate">{m.item?.name}</div>
                          <div className="tiny text-red">Short by {num(m.shortage)} {m.unit}</div>
                          {sup && <div className="tiny muted truncate">{sup.name}</div>}
                        </div>
                        {sup && (
                          <Button size="sm" variant="soft" icon={ShoppingCart} to={`/purchase/orders/new?supplier=${sup.id}`}>
                            Create PO
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
            {materials.length > 0 && !shortages.length && <Callout tone="green">All materials are available in the raw material store for this batch.</Callout>}
          </aside>
        </div>

        <div className="sticky-actions form-actions">
          <Button onClick={() => navigate(-1)} disabled={Boolean(saving)}>Cancel</Button>
          {editing ? (
            <>
              {existing.status === 'Planned' && (
                <Button icon={Play} loading={saving === 'Released'} disabled={Boolean(saving)} onClick={() => submit('Released')}>
                  Save and release
                </Button>
              )}
              <Button type="submit" variant="primary" icon={Save} loading={saving === 'save'} disabled={Boolean(saving)}>
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button icon={Save} loading={saving === 'Planned'} disabled={Boolean(saving)} onClick={() => submit('Planned')}>
                Save as planned
              </Button>
              <Button variant="primary" icon={Play} loading={saving === 'Released'} disabled={Boolean(saving)} onClick={() => submit('Released')}>
                Release order
              </Button>
            </>
          )}
        </div>
      </form>
    </>
  )
}
