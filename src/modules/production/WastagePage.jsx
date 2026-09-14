/** Wastage & rejection register. Frontend-only demo. */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ClipboardList, IndianRupee, Pencil, Plus, Recycle, Trash2, Wrench, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { WASTAGE_TYPES } from '../../data/constants.js'
import { addDays, fmtDate, inr, inrCompact, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { CHART, axisProps } from '../../config/theme.js'
import { Button, Card, DataTable, DatePicker, DocNo, Drawer, Field, FilterPanel, Input, PageHeader, Select, StatCard, StatusBadge, Tabs, Textarea, inDateRange, useConfirm, useToast } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { CRUMB } from './shared.jsx'

const TYPE_COLOR = { Wastage: CHART.brass, Rejection: CHART.red, Damage: CHART.violet, Scrap: CHART.gray }
const TYPE_ICON = { Wastage: Recycle, Rejection: XCircle, Damage: AlertTriangle, Scrap: Wrench }
const TYPE_TONE = { Wastage: 'amber', Rejection: 'red', Damage: 'violet', Scrap: 'gray' }
const REASONS = {
  Wastage: ['Die-casting runners and flash', 'Sheet cutting offcuts', 'Cartons torn during folding', 'Plating solution drained during tank cleaning'],
  Rejection: ['Key not turning smoothly – lever misalignment', 'Plating peel-off after buffing', 'Shackle hardness below specification', 'Spring missing in lock assembly'],
  Damage: ['Dent during handling on shop floor', 'Scratches on satin finish during packing', 'Dropped during loading'],
  Scrap: ['Brass turning chips', 'Press-shop blanking scrap', 'Defective castings sent to scrap yard'],
}

const unitSummary = (rows, items) => {
  const byUnit = {}
  rows.forEach((r) => {
    const u = items.get(r.itemId)?.unit || 'PCS'
    byUnit[u] = (byUnit[u] || 0) + Number(r.qty)
  })
  const parts = Object.entries(byUnit).map(([u, q]) => `${num(q)} ${u}`)
  return parts.length ? parts.join(', ') : '0'
}

export default function WastagePage() {
  usePageTitle('Wastage and rejection')
  const { state, save, remove, get } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState({})
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const items = byId(state.items)
  const orders = byId(state.productionOrders)
  const t = today()
  const monthStart = `${t.slice(0, 7)}-01`

  const openAdd = (pre = {}) => {
    const order = get('productionOrders', pre.productionOrderId)
    setErrors({})
    setForm({
      date: t,
      productionOrderId: order?.id || '',
      itemId: pre.itemId || order?.productId || '',
      qty: pre.qty || '',
      type: WASTAGE_TYPES.includes(pre.type) ? pre.type : 'Rejection',
      reason: '',
      remarks: '',
    })
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openAdd({ productionOrderId: params.get('order'), type: params.get('type'), qty: Number(params.get('qty')) || '', itemId: params.get('item') || '' })
      const next = new URLSearchParams(params)
      ;['new', 'order', 'type', 'qty', 'item'].forEach((k) => next.delete(k))
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const allRows = useMemo(
    () =>
      state.wastages.map((w) => {
        const item = items.get(w.itemId)
        return { ...w, item, itemName: item?.name || '—', order: orders.get(w.productionOrderId), value: Number(w.qty) * (Number(item?.purchaseRate) || 0) }
      }),
    [state.wastages, items, orders],
  )
  const filtered = allRows.filter((r) => inDateRange(r.date, filters.period) && (!filters.order || r.productionOrderId === filters.order))
  const rows = tab === 'All' ? filtered : filtered.filter((r) => r.type === tab)
  const monthRows = allRows.filter((r) => r.date >= monthStart)
  const last30 = allRows.filter((r) => r.date >= addDays(t, -29))
  const chartData = WASTAGE_TYPES.map((type) => {
    const list = last30.filter((r) => r.type === type)
    return { type, value: Math.round(list.reduce((a, r) => a + r.value, 0)), count: list.length }
  })
  const reasonCounts = Object.entries(
    allRows.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // form helpers
  const formOrder = form ? get('productionOrders', form.productionOrderId) : null
  const orderOptions = state.productionOrders
    .filter((o) => (!o.historical && o.status !== 'Cancelled') || o.id === form?.productionOrderId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name}` }))
  const itemOptions = (() => {
    if (!formOrder) return state.items.filter((i) => i.status === 'Active').map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))
    const bom = get('boms', formOrder.bomId)
    const ids = [formOrder.productId, ...(bom?.components.map((c) => c.itemId) || [])]
    return ids.map((id) => ({ value: id, label: `${items.get(id)?.name} (${id === formOrder.productId ? 'product' : items.get(id)?.type.toLowerCase()})` }))
  })()
  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.productionOrderId) errs.productionOrderId = 'Select a production order'
    if (!form.itemId) errs.itemId = 'Select an item'
    if (!(Number(form.qty) > 0)) errs.qty = 'Enter a quantity above 0'
    if (!form.reason.trim()) errs.reason = 'Enter the reason'
    if (!form.date) errs.date = 'Select the date'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await fakeDelay(350)
    const saved = save('wastages', { ...form, qty: Number(form.qty), reason: form.reason.trim(), warehouseId: form.warehouseId || 'wh-scr' })
    setSaving(false)
    setForm(null)
    toast.success(form.id ? 'Wastage entry updated' : 'Wastage recorded', `${saved.number}: ${num(saved.qty)} ${items.get(saved.itemId)?.unit} of ${items.get(saved.itemId)?.name} (${saved.type.toLowerCase()}).`)
  }

  const handleDelete = async (row) => {
    const ok = await confirm({ title: 'Delete wastage entry?', message: `${row.number} for ${row.itemName} will be removed.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('wastages', row.id)
      toast.success('Wastage entry deleted', row.number)
    }
  }

  const columns = [
    { key: 'number', header: 'Entry no.', render: (r) => <DocNo>{r.number}</DocNo> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'order', header: 'Production order', accessor: (r) => r.order?.number, render: (r) => (r.order ? <DocNo to={`/production/orders/${r.order.id}`}>{r.order.number}</DocNo> : '—') },
    { key: 'itemName', header: 'Item', render: (r) => (<div><div className="cell-primary">{r.itemName}</div><div className="cell-secondary">{r.item?.code}</div></div>) },
    { key: 'qty', header: 'Quantity', align: 'right', render: (r) => `${num(r.qty)} ${r.item?.unit || ''}` },
    { key: 'type', header: 'Type', render: (r) => <StatusBadge status={r.type} /> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="truncate" style={{ display: 'inline-block', maxWidth: 260 }} title={r.reason}>{r.reason}</span> },
    { key: 'value', header: 'Value lost', align: 'right', render: (r) => inr(r.value) },
  ]

  return (
    <>
      <PageHeader
        title="Wastage and rejection"
        subtitle="Scrap, rejected pieces and damaged goods recorded against production orders."
        breadcrumbs={[CRUMB, { label: 'Wastage and rejection' }]}
        actions={can('Production', 'add') && <Button variant="primary" icon={Plus} onClick={() => openAdd()}>Record wastage</Button>}
      />

      <div className="grid-5 mb-16">
        {WASTAGE_TYPES.map((type) => {
          const list = monthRows.filter((r) => r.type === type)
          return (
            <StatCard key={type} label={`${type} this month`} value={unitSummary(list, items)} icon={TYPE_ICON[type]} tone={TYPE_TONE[type]} foot={`${list.length} entries`} onClick={() => setTab(type)} />
          )
        })}
        <StatCard label="Value lost this month" value={inr(monthRows.reduce((a, r) => a + r.value, 0))} icon={IndianRupee} tone="blue" foot="At standard cost" />
      </div>

      <div className="grid-2 mb-16">
        <Card title="Value lost by type" subtitle="Last 30 days">
          <div className="chart-box sm">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="type" {...axisProps} />
                <YAxis {...axisProps} width={60} tickFormatter={(v) => inrCompact(v)} />
                <Tooltip cursor={{ fill: 'rgba(15,30,54,0.04)' }} content={<ChartTooltip formatter={(v) => inr(v)} />} />
                <Bar dataKey="value" name="Value lost" radius={[5, 5, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  {chartData.map((d) => (
                    <Cell key={d.type} fill={TYPE_COLOR[d.type]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Most frequent reasons" subtitle="All recorded entries">
          <div className="activity-list">
            {reasonCounts.map(([reason, count]) => {
              const sample = allRows.find((r) => r.reason === reason)
              const Icon = TYPE_ICON[sample?.type] || ClipboardList
              return (
                <div key={reason} className="activity-item">
                  <span className={`activity-icon tone-${TYPE_TONE[sample?.type] || 'gray'}`}><Icon size={14} /></span>
                  <div className="grow">
                    <div className="activity-text"><b>{reason}</b></div>
                    <div className="activity-time">{sample?.type}</div>
                  </div>
                  <span className="strong small">{count}×</span>
                </div>
              )
            })}
            {!reasonCounts.length && <div className="muted small">No wastage recorded yet.</div>}
          </div>
        </Card>
      </div>

      <Tabs
        style={{ marginBottom: 12 }}
        value={tab}
        onChange={setTab}
        tabs={['All', ...WASTAGE_TYPES].map((s) => ({ key: s, label: s === 'All' ? 'All entries' : s, count: s === 'All' ? filtered.length : filtered.filter((r) => r.type === s).length }))}
      />
      <DataTable
        columns={columns}
        data={rows}
        exportName="wastage-rejection"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search item, reason or order…"
        filters={
          <FilterPanel
            filters={[
              { key: 'order', label: 'Order', options: [...new Set(state.wastages.map((w) => w.productionOrderId))].map((id) => ({ value: id, label: orders.get(id)?.number || id })), placeholder: 'All orders', width: 180 },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        rowActions={(r) => [
          r.order && { label: 'Open production order', icon: ClipboardList, to: `/production/orders/${r.order.id}` },
          can('Production', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => { setErrors({}); setForm({ ...r }) } },
          can('Production', 'delete') && { divider: true },
          can('Production', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(r) },
        ].filter(Boolean)}
        emptyTitle={tab === 'All' ? 'No wastage recorded' : `No ${tab.toLowerCase()} entries`}
        emptyDescription="Record scrap, rejected pieces or damage against a production order."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Plus} onClick={() => openAdd({ type: tab === 'All' ? 'Rejection' : tab })}>Record wastage</Button>}
      />

      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        title={form?.id ? `Edit ${form.number}` : 'Record wastage'}
        subtitle="Fields marked * are required"
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="wastage-form" loading={saving}>{form?.id ? 'Save changes' : 'Record wastage'}</Button>
          </>
        }
      >
        {form && (
          <form id="wastage-form" onSubmit={submit} noValidate>
            <div className="form-grid cols-2">
              <Field label="Production order" required error={errors.productionOrderId} span="full">
                <Select
                  options={orderOptions}
                  placeholder="Select production order"
                  value={form.productionOrderId}
                  error={errors.productionOrderId}
                  onChange={(e) => {
                    const o = get('productionOrders', e.target.value)
                    setForm((f) => ({ ...f, productionOrderId: e.target.value, itemId: o?.productId || '' }))
                    setErrors((er) => ({ ...er, productionOrderId: undefined }))
                  }}
                />
              </Field>
              <Field label="Item" required error={errors.itemId} span="full" hint={formOrder ? 'The product or any of its BOM components' : undefined}>
                <Select options={itemOptions} placeholder="Select item" value={form.itemId} error={errors.itemId} onChange={(e) => setField('itemId', e.target.value)} />
              </Field>
              <Field label="Type" required>
                <Select options={WASTAGE_TYPES} value={form.type} onChange={(e) => setField('type', e.target.value)} />
              </Field>
              <Field label={`Quantity${form.itemId ? ` (${items.get(form.itemId)?.unit})` : ''}`} required error={errors.qty}>
                <Input type="number" min="0" step="any" value={form.qty} error={errors.qty} onChange={(e) => setField('qty', e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
              <Field label="Reason" required error={errors.reason} span="full" hint="Pick a common reason or type your own">
                <Input list="wastage-reasons" value={form.reason} error={errors.reason} placeholder="Why was it wasted or rejected?" onChange={(e) => setField('reason', e.target.value)} />
                <datalist id="wastage-reasons">
                  {(REASONS[form.type] || []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Date" required error={errors.date}>
                <DatePicker value={form.date} onChange={(v) => setField('date', v)} />
              </Field>
              <Field label="Estimated value">
                <Input readOnly value={form.itemId && form.qty ? inr(Number(form.qty) * (Number(items.get(form.itemId)?.purchaseRate) || 0)) : ''} />
              </Field>
              <Field label="Remarks" span="full">
                <Textarea rows={2} value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} />
              </Field>
            </div>
          </form>
        )}
      </Drawer>
    </>
  )
}
