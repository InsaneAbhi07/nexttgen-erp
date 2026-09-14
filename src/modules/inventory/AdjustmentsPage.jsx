/**
 * Stock adjustment — reconcile system stock with physical count (frontend-only demo).
 * The stored `difference` becomes an Adjustment stock move in the mock store.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Eye, IndianRupee, Layers, Pencil, Plus, Scale, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import { round2 } from '../../utils/calc.js'
import {
  Badge, Button, Callout, DataTable, DatePicker, DateRange, DocNo, Drawer, Field, FilterPanel, Input, KeyValue,
  PageHeader, Select, StatCard, Textarea, inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import { ADJUSTMENT_REASONS, INV_CRUMB, ItemCell, inMonth, itemOptions, warehouseOptions } from './helpers.jsx'

const signed = (n) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(Math.abs(n))}` : '0')

export default function AdjustmentsPage() {
  usePageTitle('Stock adjustment')
  const { state, save, remove, previewNumber } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState({ preset: 'all', from: '', to: '' })
  const [filters, setFilters] = useState({})
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [viewId, setViewId] = useState(null)

  const items = byId(state.items)
  const warehouses = byId(state.warehouses)
  const list = state.stockAdjustments
  const viewing = viewId ? list.find((r) => r.id === viewId) : null
  const approvers = state.users.filter((u) => u.status === 'Active' && ['Super Admin', 'Admin', 'Manager', 'Store User'].includes(u.role)).map((u) => u.name)

  const openNew = () =>
    setForm({ id: null, values: { date: today(), warehouseId: 'wh-fgg', itemId: '', actualQty: '', reason: '', remarks: '', approvedBy: approvers.includes('Rajesh Kumar') ? 'Rajesh Kumar' : user?.name || '' }, errors: {} })

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew()
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const openEdit = (row) => {
    setViewId(null)
    setForm({ id: row.id, values: { date: row.date, warehouseId: row.warehouseId, itemId: row.itemId, actualQty: row.actualQty, reason: row.reason || '', remarks: row.remarks || '', approvedBy: row.approvedBy || '' }, errors: {} })
  }

  const valueOf = (r) => Number(r.difference) * (Number(items.get(r.itemId)?.purchaseRate) || 0)

  const stats = useMemo(() => {
    const month = list.filter((r) => inMonth(r.date))
    return {
      count: month.length,
      net: round2(month.reduce((a, r) => a + Number(r.difference), 0)),
      value: Math.round(month.reduce((a, r) => a + valueOf(r), 0)),
      items: new Set(month.map((r) => r.itemId)).size,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, items])

  const data = useMemo(
    () =>
      list
        .filter((r) => inDateRange(r.date, range) && (!filters.warehouseId || r.warehouseId === filters.warehouseId) && (!filters.reason || r.reason === filters.reason) && (!filters.direction || (filters.direction === 'Increase' ? r.difference > 0 : r.difference < 0)))
        .map((r) => ({ ...r, item: items.get(r.itemId), warehouseName: warehouses.get(r.warehouseId)?.name || '—', value: valueOf(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, range, filters, items, warehouses],
  )

  /** System quantity now, excluding this adjustment's own effect when editing. */
  const systemQtyFor = (values) => {
    if (!values.itemId || !values.warehouseId) return null
    let q = itemStock(state, values.itemId, values.warehouseId)
    if (form?.id) {
      const orig = list.find((r) => r.id === form.id)
      if (orig && orig.itemId === values.itemId && orig.warehouseId === values.warehouseId) q -= Number(orig.difference)
    }
    return round2(q)
  }

  const setValue = (name, value) => setForm((f) => ({ ...f, values: { ...f.values, [name]: value }, errors: { ...f.errors, [name]: undefined } }))

  const submit = async (e) => {
    e.preventDefault()
    const v = form.values
    const errors = {}
    if (!v.date) errors.date = 'Select a date'
    if (!v.warehouseId) errors.warehouseId = 'Select a warehouse'
    if (!v.itemId) errors.itemId = 'Select an item'
    if (v.actualQty === '' || Number(v.actualQty) < 0) errors.actualQty = 'Enter the physical quantity counted'
    if (!v.reason) errors.reason = 'Select a reason'
    const systemQty = systemQtyFor(v)
    if (!errors.actualQty && systemQty !== null && round2(Number(v.actualQty) - systemQty) === 0) errors.actualQty = 'Actual quantity matches system quantity, so there is nothing to adjust'
    if (Object.keys(errors).length) {
      setForm((f) => ({ ...f, errors }))
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const orig = form.id ? list.find((r) => r.id === form.id) : {}
    const difference = round2(Number(v.actualQty) - systemQty)
    const saved = save('stockAdjustments', {
      ...orig,
      date: v.date,
      warehouseId: v.warehouseId,
      itemId: v.itemId,
      systemQty,
      actualQty: Number(v.actualQty),
      difference,
      reason: v.reason,
      remarks: v.remarks.trim(),
      approvedBy: v.approvedBy,
    })
    setSaving(false)
    setForm(null)
    const item = items.get(saved.itemId)
    toast.success(form.id ? 'Stock adjustment updated' : 'Stock adjustment saved', `${saved.number}: ${signed(difference)} ${item?.unit} ${item?.name}.`)
  }

  const handleDelete = async (row) => {
    const item = items.get(row.itemId)
    if (Number(row.difference) > 0 && itemStock(state, row.itemId, row.warehouseId) < Number(row.difference)) {
      toast.error('This adjustment can’t be deleted', 'Reversing it would make the warehouse balance negative.')
      return
    }
    const ok = await confirm({
      title: 'Delete stock adjustment?',
      message: `${row.number} will be removed and the ${signed(row.difference)} ${item?.unit} correction to ${item?.name} will be reversed.`,
      confirmLabel: 'Delete adjustment',
      tone: 'danger',
    })
    if (!ok) return
    setViewId(null)
    remove('stockAdjustments', row.id)
    toast.success('Stock adjustment deleted', `Balance for ${item?.name} has been restored.`)
  }

  const columns = [
    { key: 'number', header: 'Adjustment no.', accessor: (r) => r.number, render: (r) => <DocNo>{r.number}</DocNo> },
    { key: 'date', header: 'Date', accessor: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: 'item', header: 'Item', accessor: (r) => r.item?.name, render: (r) => <ItemCell item={r.item} /> },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseName },
    { key: 'systemQty', header: 'System qty', align: 'right', accessor: (r) => Number(r.systemQty), render: (r) => <span className="num">{num(r.systemQty)}</span> },
    { key: 'actualQty', header: 'Actual qty', align: 'right', accessor: (r) => Number(r.actualQty), render: (r) => <span className="num">{num(r.actualQty)}</span> },
    {
      key: 'difference', header: 'Difference', align: 'right', accessor: (r) => Number(r.difference),
      render: (r) => <span className={`num strong ${r.difference > 0 ? 'text-green' : 'text-red'}`}>{signed(r.difference)} <span className="muted" style={{ fontWeight: 400 }}>{r.item?.unit}</span></span>,
    },
    { key: 'value', header: 'Value impact', align: 'right', accessor: (r) => r.value, render: (r) => <span className={`num ${r.value < 0 ? 'text-red' : 'text-green'}`}>{r.value < 0 ? '−' : '+'}{inr(Math.abs(r.value))}</span> },
    { key: 'reason', header: 'Reason', accessor: (r) => r.reason, render: (r) => <Badge tone={r.difference > 0 ? 'teal' : 'amber'}>{r.reason}</Badge> },
    { key: 'approvedBy', header: 'Approved by', accessor: (r) => r.approvedBy },
  ]

  const rowActions = (row) =>
    [
      { label: 'View details', icon: Eye, onClick: () => setViewId(row.id) },
      can('Inventory', 'edit') && { label: 'Edit', icon: Pencil, onClick: () => openEdit(row) },
      can('Inventory', 'delete') && { divider: true },
      can('Inventory', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(row) },
    ].filter(Boolean)

  const v = form?.values
  const formItem = v ? items.get(v.itemId) : null
  const systemQty = v ? systemQtyFor(v) : null
  const diff = v && systemQty !== null && v.actualQty !== '' ? round2(Number(v.actualQty) - systemQty) : null

  return (
    <>
      <PageHeader
        title="Stock adjustment"
        subtitle="Correct system stock after physical verification, damage write-offs or counting errors."
        breadcrumbs={[INV_CRUMB, { label: 'Stock adjustment' }]}
        actions={
          can('Inventory', 'add') && (
            <Button variant="primary" icon={Plus} onClick={openNew}>
              New adjustment
            </Button>
          )
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Adjustments this month" value={num(stats.count)} icon={CalendarDays} tone="blue" />
        <StatCard label="Net quantity change" value={signed(stats.net)} icon={Scale} tone={stats.net < 0 ? 'red' : 'green'} foot="This month, across all units" />
        <StatCard label="Value impact" value={`${stats.value < 0 ? '−' : '+'}${inr(Math.abs(stats.value))}`} icon={IndianRupee} tone={stats.value < 0 ? 'red' : 'green'} foot="This month, at purchase rate" />
        <StatCard label="Items adjusted" value={num(stats.items)} icon={Layers} tone="violet" foot="This month" />
      </div>

      <DataTable
        columns={columns}
        data={data}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => setViewId(r.id)}
        rowActions={rowActions}
        exportName="stock-adjustments"
        searchPlaceholder="Search adjustment, item, reason…"
        filters={
          <>
            <DateRange size="sm" value={range} onChange={setRange} />
            <FilterPanel
              filters={[
                { key: 'warehouseId', label: 'Warehouses', options: warehouseOptions(state, true) },
                { key: 'reason', label: 'Reasons', options: ADJUSTMENT_REASONS, width: 200 },
                { key: 'direction', label: 'Directions', placeholder: 'Increase and decrease', options: ['Increase', 'Decrease'], width: 180 },
              ]}
              values={filters}
              onChange={(k, val) => setFilters((f) => ({ ...f, [k]: val }))}
              onReset={() => setFilters({})}
            />
          </>
        }
        emptyIcon={SlidersHorizontal}
        emptyTitle="No stock adjustments"
        emptyDescription="Adjustments from physical verification will appear here."
        emptyAction={can('Inventory', 'add') && <Button size="sm" variant="primary" icon={Plus} onClick={openNew}>New adjustment</Button>}
      />

      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        title={form?.id ? 'Edit stock adjustment' : 'New stock adjustment'}
        subtitle="Enter the physical count; the difference is posted to stock"
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="adjustment-form" loading={saving}>
              {form?.id ? 'Save changes' : 'Save adjustment'}
            </Button>
          </>
        }
      >
        {form && (
          <form id="adjustment-form" onSubmit={submit} noValidate>
            <div className="form-grid cols-2">
              <Field label="Adjustment number">
                <Input readOnly className="mono" value={form.id ? list.find((r) => r.id === form.id)?.number : previewNumber('stockAdjustments', v.date)} />
              </Field>
              <Field label="Date" required error={form.errors.date}>
                <DatePicker value={v.date} max={today()} onChange={(d) => setValue('date', d)} />
              </Field>
              <Field label="Warehouse" required error={form.errors.warehouseId} span="full">
                <Select options={warehouseOptions(state)} placeholder="Select warehouse" value={v.warehouseId} error={form.errors.warehouseId} onChange={(e) => setValue('warehouseId', e.target.value)} />
              </Field>
              <Field label="Item" required error={form.errors.itemId} span="full">
                <Select options={itemOptions(state)} placeholder="Select item" value={v.itemId} error={form.errors.itemId} onChange={(e) => setValue('itemId', e.target.value)} />
              </Field>
              <Field label={`System quantity${formItem ? ` (${formItem.unit})` : ''}`} hint="Current balance in the selected warehouse">
                <Input readOnly value={systemQty === null ? '' : num(systemQty)} />
              </Field>
              <Field label={`Actual quantity${formItem ? ` (${formItem.unit})` : ''}`} required error={form.errors.actualQty}>
                <Input type="number" min="0" step="any" value={v.actualQty} error={form.errors.actualQty} onChange={(e) => setValue('actualQty', e.target.value)} />
              </Field>
              {diff !== null && diff !== 0 && formItem && (
                <div className="span-full">
                  <Callout tone={diff < 0 ? 'amber' : 'green'}>
                    Difference <b>{signed(diff)} {formItem.unit}</b>, value impact <b>{diff < 0 ? '−' : '+'}{inr2(Math.abs(diff * formItem.purchaseRate))}</b>. Stock will be {diff < 0 ? 'reduced' : 'increased'} when you save.
                  </Callout>
                </div>
              )}
              <Field label="Reason" required error={form.errors.reason}>
                <Select options={ADJUSTMENT_REASONS} placeholder="Select reason" value={v.reason} error={form.errors.reason} onChange={(e) => setValue('reason', e.target.value)} />
              </Field>
              <Field label="Approved by">
                <Select options={approvers} placeholder="Select approver" value={v.approvedBy} onChange={(e) => setValue('approvedBy', e.target.value)} />
              </Field>
              <Field label="Remarks" span="full">
                <Textarea value={v.remarks} placeholder="Verified by store in-charge during monthly count" onChange={(e) => setValue('remarks', e.target.value)} />
              </Field>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer
        open={Boolean(viewing)}
        onClose={() => setViewId(null)}
        title={viewing ? `Adjustment ${viewing.number}` : ''}
        subtitle={viewing ? fmtDate(viewing.date) : ''}
        footer={
          viewing && (
            <>
              {can('Inventory', 'delete') && (
                <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={() => handleDelete(viewing)}>
                  Delete
                </Button>
              )}
              <Button to={`/inventory/ledger?item=${viewing.itemId}&warehouse=${viewing.warehouseId}`}>Stock ledger</Button>
              {can('Inventory', 'edit') && (
                <Button variant="primary" icon={Pencil} onClick={() => openEdit(viewing)}>
                  Edit
                </Button>
              )}
            </>
          )
        }
      >
        {viewing && (
          <KeyValue
            cols={2}
            items={[
              { label: 'Adjustment number', value: <span className="doc-no">{viewing.number}</span> },
              { label: 'Date', value: fmtDate(viewing.date) },
              { label: 'Item', value: `${items.get(viewing.itemId)?.name} (${items.get(viewing.itemId)?.code})`, span: 2 },
              { label: 'Warehouse', value: warehouses.get(viewing.warehouseId)?.name },
              { label: 'Unit', value: items.get(viewing.itemId)?.unit },
              { label: 'System quantity', value: num(viewing.systemQty) },
              { label: 'Actual quantity', value: num(viewing.actualQty) },
              { label: 'Difference', value: <span className={viewing.difference > 0 ? 'text-green' : 'text-red'}>{signed(viewing.difference)}</span> },
              { label: 'Value impact', value: inr2(valueOf(viewing)) },
              { label: 'Reason', value: viewing.reason },
              { label: 'Approved by', value: viewing.approvedBy },
              { label: 'Remarks', value: viewing.remarks, span: 2 },
            ]}
          />
        )}
      </Drawer>
    </>
  )
}
