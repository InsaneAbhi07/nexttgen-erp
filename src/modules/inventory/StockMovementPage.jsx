/**
 * Stock in / Stock out — manual stock entries (frontend-only demo).
 * Saving through the mock store regenerates stock moves; deleting reverses them.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, CalendarDays, Eye, IndianRupee, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, today } from '../../utils/format.js'
import { fakeDelay, usePageTitle } from '../../utils/hooks.js'
import {
  Button, Callout, DataTable, DatePicker, DateRange, DocNo, Drawer, Field, FilterPanel, Input, KeyValue,
  PageHeader, Select, StatCard, Textarea, inDateRange, useConfirm, useToast,
} from '../../components/ui/index.js'
import { INV_CRUMB, ItemCell, inMonth, itemOptions, warehouseOptions } from './helpers.jsx'

export default function StockMovementPage({ kind }) {
  const isIn = kind === 'in'
  const collection = isIn ? 'stockIns' : 'stockOuts'
  const label = isIn ? 'Stock in' : 'Stock out'
  usePageTitle(label)
  const { state, save, remove, previewNumber } = useErp()
  const { can } = useAuth()
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
  const list = state[collection]
  const viewing = viewId ? list.find((r) => r.id === viewId) : null

  const openNew = () =>
    setForm({
      id: null,
      values: { date: today(), warehouseId: isIn ? 'wh-rms' : 'wh-fgg', itemId: '', qty: '', reference: '', remarks: '' },
      errors: {},
    })

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
    setForm({ id: row.id, values: { date: row.date, warehouseId: row.warehouseId, itemId: row.itemId, qty: row.qty, reference: row.reference || '', remarks: row.remarks || '' }, errors: {} })
  }

  const stats = useMemo(() => {
    const month = list.filter((r) => inMonth(r.date))
    return {
      count: month.length,
      qty: month.reduce((a, r) => a + Number(r.qty), 0),
      value: month.reduce((a, r) => a + Number(r.qty) * (Number(items.get(r.itemId)?.purchaseRate) || 0), 0),
      items: new Set(month.map((r) => r.itemId)).size,
    }
  }, [list, items])

  const data = useMemo(
    () =>
      list
        .filter((r) => inDateRange(r.date, range) && (!filters.warehouseId || r.warehouseId === filters.warehouseId) && (!filters.type || items.get(r.itemId)?.type === filters.type))
        .map((r) => {
          const item = items.get(r.itemId)
          return { ...r, item, warehouseName: warehouses.get(r.warehouseId)?.name || '—', value: Number(r.qty) * (Number(item?.purchaseRate) || 0) }
        }),
    [list, range, filters, items, warehouses],
  )

  // Balance available in the warehouse, excluding this entry's own effect when editing.
  const availableFor = (values) => {
    if (!values.itemId || !values.warehouseId) return null
    let a = itemStock(state, values.itemId, values.warehouseId)
    if (form?.id) {
      const orig = list.find((r) => r.id === form.id)
      if (orig && orig.itemId === values.itemId && orig.warehouseId === values.warehouseId) a += isIn ? -Number(orig.qty) : Number(orig.qty)
    }
    return a
  }

  const setValue = (name, value) => setForm((f) => ({ ...f, values: { ...f.values, [name]: value }, errors: { ...f.errors, [name]: undefined } }))

  const submit = async (e) => {
    e.preventDefault()
    const v = form.values
    const errors = {}
    if (!v.date) errors.date = 'Select a date'
    if (!v.warehouseId) errors.warehouseId = 'Select a warehouse'
    if (!v.itemId) errors.itemId = 'Select an item'
    if (!(Number(v.qty) > 0)) errors.qty = 'Enter a quantity greater than zero'
    const avail = availableFor(v)
    if (!isIn && avail !== null && Number(v.qty) > avail) errors.qty = `Only ${num(avail)} ${items.get(v.itemId)?.unit} available in this warehouse`
    if (Object.keys(errors).length) {
      setForm((f) => ({ ...f, errors }))
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const orig = form.id ? list.find((r) => r.id === form.id) : {}
    const saved = save(collection, { ...orig, date: v.date, warehouseId: v.warehouseId, itemId: v.itemId, qty: Number(v.qty), reference: v.reference.trim(), remarks: v.remarks.trim() })
    setSaving(false)
    setForm(null)
    const item = items.get(saved.itemId)
    toast.success(form.id ? `${label} entry updated` : `${label} entry saved`, `${saved.number}: ${isIn ? '+' : '−'}${num(saved.qty)} ${item?.unit} ${item?.name} in ${warehouses.get(saved.warehouseId)?.name}.`)
  }

  const handleDelete = async (row) => {
    const item = items.get(row.itemId)
    if (isIn && itemStock(state, row.itemId, row.warehouseId) < Number(row.qty)) {
      toast.error('This entry can’t be deleted', `Part of the ${num(row.qty)} ${item?.unit} has already been used, so reversing it would make stock negative.`)
      return
    }
    const ok = await confirm({
      title: `Delete ${label.toLowerCase()} entry?`,
      message: `${row.number} will be removed and ${num(row.qty)} ${item?.unit} of ${item?.name} will be ${isIn ? 'deducted from' : 'added back to'} ${warehouses.get(row.warehouseId)?.name}.`,
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!ok) return
    setViewId(null)
    remove(collection, row.id)
    toast.success(`${label} entry deleted`, `Stock for ${item?.name} has been reversed.`)
  }

  const columns = [
    { key: 'number', header: 'Entry no.', accessor: (r) => r.number, render: (r) => <DocNo>{r.number}</DocNo> },
    { key: 'date', header: 'Date', accessor: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: 'item', header: 'Item', accessor: (r) => r.item?.name, render: (r) => <ItemCell item={r.item} /> },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseName },
    {
      key: 'qty', header: 'Quantity', align: 'right', accessor: (r) => Number(r.qty),
      render: (r) => <span className={`num strong ${isIn ? 'text-green' : 'text-red'}`}>{isIn ? '+' : '−'}{num(r.qty)} <span className="muted" style={{ fontWeight: 400 }}>{r.item?.unit}</span></span>,
    },
    { key: 'value', header: 'Value', align: 'right', accessor: (r) => r.value, render: (r) => <span className="num">{inr(r.value)}</span> },
    { key: 'reference', header: 'Reference', accessor: (r) => r.reference, render: (r) => r.reference || <span className="muted">—</span> },
    { key: 'remarks', header: 'Remarks', accessor: (r) => r.remarks, render: (r) => <span className="truncate" style={{ display: 'inline-block', maxWidth: 260 }} title={r.remarks}>{r.remarks || '—'}</span> },
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
  const avail = v ? availableFor(v) : null
  const after = avail !== null && Number(v.qty) > 0 ? avail + (isIn ? 1 : -1) * Number(v.qty) : null
  const Icon = isIn ? ArrowDownToLine : ArrowUpFromLine

  return (
    <>
      <PageHeader
        title={label}
        subtitle={isIn ? 'Record material received without a GRN, such as job work returns, free replacements or verification surplus.' : 'Record material issued without a sale, such as samples, exhibitions, maintenance or job work.'}
        breadcrumbs={[INV_CRUMB, { label }]}
        actions={
          <>
            <Button to={isIn ? '/inventory/stock-out' : '/inventory/stock-in'} icon={isIn ? ArrowUpFromLine : ArrowDownToLine}>
              {isIn ? 'Stock out' : 'Stock in'}
            </Button>
            {can('Inventory', 'add') && (
              <Button variant="primary" icon={Plus} onClick={openNew}>
                New {label.toLowerCase()} entry
              </Button>
            )}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Entries this month" value={num(stats.count)} icon={CalendarDays} tone="blue" />
        <StatCard label={`Quantity ${isIn ? 'received' : 'issued'} this month`} value={num(stats.qty)} icon={Boxes} tone={isIn ? 'green' : 'red'} foot="Across all units" />
        <StatCard label="Value this month" value={inr(stats.value)} icon={IndianRupee} tone="brass" foot="At purchase rate" />
        <StatCard label="Items moved this month" value={num(stats.items)} icon={Layers} tone="violet" />
      </div>

      <DataTable
        columns={columns}
        data={data}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={(r) => setViewId(r.id)}
        rowActions={rowActions}
        exportName={isIn ? 'stock-in' : 'stock-out'}
        searchPlaceholder="Search entry, item, reference…"
        filters={
          <>
            <DateRange size="sm" value={range} onChange={setRange} />
            <FilterPanel
              filters={[
                { key: 'warehouseId', label: 'Warehouses', options: warehouseOptions(state, true) },
                { key: 'type', label: 'Types', options: ['Finished Good', 'Raw Material', 'Trading Goods', 'Consumable', 'Packaging Material'] },
              ]}
              values={filters}
              onChange={(k, val) => setFilters((f) => ({ ...f, [k]: val }))}
              onReset={() => setFilters({})}
            />
          </>
        }
        emptyIcon={Icon}
        emptyTitle={`No ${label.toLowerCase()} entries`}
        emptyDescription={isIn ? 'Receipts without a purchase order will appear here.' : 'Issues for samples, exhibitions or job work will appear here.'}
        emptyAction={can('Inventory', 'add') && <Button size="sm" variant="primary" icon={Plus} onClick={openNew}>New {label.toLowerCase()} entry</Button>}
      />

      {/* Add / edit */}
      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        title={form?.id ? `Edit ${label.toLowerCase()} entry` : `New ${label.toLowerCase()} entry`}
        subtitle="Stock balances update as soon as you save"
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="stock-move-form" loading={saving}>
              {form?.id ? 'Save changes' : `Save ${label.toLowerCase()}`}
            </Button>
          </>
        }
      >
        {form && (
          <form id="stock-move-form" onSubmit={submit} noValidate>
            <div className="form-grid cols-2">
              <Field label="Entry number">
                <Input readOnly className="mono" value={form.id ? list.find((r) => r.id === form.id)?.number : previewNumber(collection, v.date)} />
              </Field>
              <Field label="Date" required error={form.errors.date}>
                <DatePicker value={v.date} max={today()} onChange={(d) => setValue('date', d)} />
              </Field>
              <Field label="Warehouse" required error={form.errors.warehouseId} span="full">
                <Select options={warehouseOptions(state)} placeholder="Select warehouse" value={v.warehouseId} error={form.errors.warehouseId} onChange={(e) => setValue('warehouseId', e.target.value)} />
              </Field>
              <Field label="Item" required error={form.errors.itemId} span="full">
                <Select
                  options={itemOptions(state, isIn ? undefined : (i) => !v.warehouseId || itemStock(state, i.id, v.warehouseId) > 0 || i.id === v.itemId)}
                  placeholder="Select item"
                  value={v.itemId}
                  error={form.errors.itemId}
                  onChange={(e) => setValue('itemId', e.target.value)}
                />
              </Field>
              {formItem && avail !== null && (
                <div className="span-full">
                  <Callout tone={!isIn && avail <= 0 ? 'red' : 'gray'}>
                    Current balance in {warehouses.get(v.warehouseId)?.name}: <b>{num(avail)} {formItem.unit}</b>
                    {after !== null && (
                      <>
                        . Balance after this entry: <b className={after < 0 ? 'text-red' : ''}>{num(after)} {formItem.unit}</b>
                      </>
                    )}
                  </Callout>
                </div>
              )}
              <Field label={`Quantity${formItem ? ` (${formItem.unit})` : ''}`} required error={form.errors.qty}>
                <Input type="number" min="0" step="any" value={v.qty} error={form.errors.qty} onChange={(e) => setValue('qty', e.target.value)} />
              </Field>
              <Field label="Rate" hint={formItem && Number(v.qty) > 0 ? `Value ${inr2(Number(v.qty) * formItem.purchaseRate)}` : 'Taken from item master'}>
                <Input readOnly value={formItem ? inr2(formItem.purchaseRate) : ''} />
              </Field>
              <Field label="Reference" span="full" hint={isIn ? 'Job work challan, supplier memo or verification sheet number' : 'Sample slip, gate pass or job work challan number'}>
                <Input value={v.reference} placeholder={isIn ? 'JW/SEP/118' : 'SMP/DEL/33'} onChange={(e) => setValue('reference', e.target.value)} />
              </Field>
              <Field label="Remarks" span="full">
                <Textarea value={v.remarks} placeholder={isIn ? 'Job work return – plating' : 'Samples to dealer'} onChange={(e) => setValue('remarks', e.target.value)} />
              </Field>
            </div>
          </form>
        )}
      </Drawer>

      {/* View */}
      <Drawer
        open={Boolean(viewing)}
        onClose={() => setViewId(null)}
        title={viewing ? `${label} ${viewing.number}` : ''}
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
          <div className="stack">
            <KeyValue
              cols={2}
              items={[
                { label: 'Entry number', value: <span className="doc-no">{viewing.number}</span> },
                { label: 'Date', value: fmtDate(viewing.date) },
                { label: 'Item', value: `${items.get(viewing.itemId)?.name} (${items.get(viewing.itemId)?.code})`, span: 2 },
                { label: 'Warehouse', value: warehouses.get(viewing.warehouseId)?.name },
                { label: 'Quantity', value: `${isIn ? '+' : '−'}${num(viewing.qty)} ${items.get(viewing.itemId)?.unit}` },
                { label: 'Rate', value: inr2(items.get(viewing.itemId)?.purchaseRate) },
                { label: 'Value', value: inr2(Number(viewing.qty) * (Number(items.get(viewing.itemId)?.purchaseRate) || 0)) },
                { label: 'Reference', value: viewing.reference },
                { label: 'Created by', value: viewing.createdBy },
                { label: 'Remarks', value: viewing.remarks, span: 2 },
              ]}
            />
            <Callout tone="gray">
              Current balance in {warehouses.get(viewing.warehouseId)?.name}: <b>{num(itemStock(state, viewing.itemId, viewing.warehouseId))} {items.get(viewing.itemId)?.unit}</b>
            </Callout>
          </div>
        )}
      </Drawer>
    </>
  )
}
