/**
 * Stock ledger — running balance per item from mock stock moves (frontend-only demo).
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, stockLedger } from '../../store/selectors.js'
import { COLLECTIONS } from '../../store/collections.js'
import { fmtDate, inr, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, DataTable, DateRange, DocNo, Field, PageHeader, Select, StatusBadge, presetRange } from '../../components/ui/index.js'
import { INV_CRUMB, MoveBadge, TRANSACTION_TYPES, itemOptions, stockStatus } from './helpers.jsx'
import { itemStock } from '../../store/selectors.js'

export default function StockLedgerPage() {
  usePageTitle('Stock ledger')
  const { state } = useErp()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState(() => ({ ...presetRange('30d'), preset: '30d' }))
  const [type, setType] = useState('')
  const items = byId(state.items)
  const warehouses = byId(state.warehouses)

  const defaultItem = state.items.find((i) => i.type === 'Finished Good' && i.status === 'Active')?.id || state.items[0]?.id
  const itemId = params.get('item') && items.has(params.get('item')) ? params.get('item') : defaultItem
  const warehouseId = params.get('warehouse') || ''
  const item = items.get(itemId)

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const summary = useMemo(() => stockLedger(state, { itemId, warehouseId: warehouseId || undefined, from: range.from || undefined, to: range.to || undefined }), [state, itemId, warehouseId, range])
  const ledger = useMemo(
    () => (type ? stockLedger(state, { itemId, warehouseId: warehouseId || undefined, from: range.from || undefined, to: range.to || undefined, type }) : summary),
    [state, itemId, warehouseId, range, type, summary],
  )

  const totalIn = summary.rows.reduce((a, r) => a + r.in, 0)
  const totalOut = summary.rows.reduce((a, r) => a + r.out, 0)
  const closing = summary.rows.length ? summary.rows[summary.rows.length - 1].balance : summary.opening
  const rate = Number(item?.purchaseRate) || 0

  const rows = useMemo(() => {
    const openingRow = {
      id: '__opening',
      date: range.from || '',
      ref: '',
      type: 'Opening balance',
      warehouseId: '',
      in: 0,
      out: 0,
      balance: ledger.opening,
      isOpening: true,
    }
    return [openingRow, ...ledger.rows.map((r) => ({ ...r, warehouseName: warehouses.get(r.warehouseId)?.name || '—' }))]
  }, [ledger, range.from, warehouses])

  const columns = [
    { key: 'date', header: 'Date', sortable: false, accessor: (r) => r.date, render: (r) => (r.isOpening ? (r.date ? fmtDate(r.date) : 'Start') : fmtDate(r.date)) },
    {
      key: 'ref', header: 'Reference', sortable: false, accessor: (r) => r.ref,
      render: (r) => {
        if (r.isOpening) return <span className="muted">—</span>
        const route = COLLECTIONS[r.sourceType]?.route?.({ id: r.sourceId })
        return <DocNo to={route}>{r.ref || 'Opening stock'}</DocNo>
      },
    },
    { key: 'type', header: 'Transaction', sortable: false, accessor: (r) => r.type, render: (r) => (r.isOpening ? <span className="strong">Opening balance</span> : <MoveBadge type={r.type} qty={r.qty} />) },
    { key: 'warehouse', header: 'Warehouse', sortable: false, accessor: (r) => r.warehouseName, render: (r) => (r.isOpening ? <span className="muted">{warehouseId ? warehouses.get(warehouseId)?.name : 'All warehouses'}</span> : r.warehouseName) },
    { key: 'in', header: 'In', align: 'right', sortable: false, accessor: (r) => r.in, render: (r) => (r.in ? <span className="num text-green">+{num(r.in)}</span> : <span className="muted">—</span>) },
    { key: 'out', header: 'Out', align: 'right', sortable: false, accessor: (r) => r.out, render: (r) => (r.out ? <span className="num text-red">−{num(r.out)}</span> : <span className="muted">—</span>) },
    { key: 'balance', header: 'Balance', align: 'right', sortable: false, accessor: (r) => r.balance, render: (r) => <span className="num strong">{num(r.balance)}</span> },
  ]

  const status = item ? stockStatus(itemStock(state, item.id), item.minStock) : null

  return (
    <>
      <PageHeader
        title="Stock ledger"
        subtitle="Every inward and outward movement of an item with its running balance."
        breadcrumbs={[INV_CRUMB, { label: 'Stock ledger' }]}
        actions={<Button icon={BookOpen} to="/inventory/stock">Stock overview</Button>}
      />

      <Card className="mb-16">
        <div className="filter-panel">
          <Field label="Item" className="grow" >
            <Select options={itemOptions(state)} value={itemId} onChange={(e) => setParam('item', e.target.value)} style={{ minWidth: 260 }} />
          </Field>
          <Field label="Warehouse">
            <Select options={state.warehouses.map((w) => ({ value: w.id, label: w.name }))} placeholder="All warehouses" value={warehouseId} onChange={(e) => setParam('warehouse', e.target.value)} />
          </Field>
          <Field label="Date range">
            <DateRange value={range} onChange={setRange} />
          </Field>
          <Field label="Transaction type">
            <Select options={TRANSACTION_TYPES} placeholder="All transactions" value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
        </div>
      </Card>

      {item && (
        <Card
          className="mb-16"
          title={
            <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {item.name} <span className="doc-no">{item.code}</span> <StatusBadge status={status} />
            </span>
          }
          subtitle={`${item.category}, ${item.type}, HSN ${item.hsn}`}
          actions={<Link to={`/masters/items?view=${item.id}`} className="small">Open item master</Link>}
        >
          <div className="ledger-summary">
            <Summary label="Opening" value={`${num(summary.opening)} ${item.unit}`} />
            <Summary label="Total in" value={`+${num(totalIn)}`} tone="text-green" />
            <Summary label="Total out" value={`−${num(totalOut)}`} tone="text-red" />
            <Summary label="Closing" value={`${num(closing)} ${item.unit}`} strong />
            <Summary label="Minimum stock" value={`${num(item.minStock)} ${item.unit}`} />
            <Summary label="Closing value" value={inr(closing * rate)} sub={`at ${inr(rate)} per ${item.unit}`} />
          </div>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={rows}
        pageSize={25}
        searchable={false}
        exportName={`stock-ledger-${item?.code || 'item'}`}
        toolbar={<span className="small muted">{ledger.rows.length} transactions{type ? ` of type ${type}` : ''}</span>}
        footer={
          <tr>
            <td colSpan={4}>Closing balance</td>
            <td className="align-right num text-green">+{num(ledger.rows.reduce((a, r) => a + r.in, 0))}</td>
            <td className="align-right num text-red">−{num(ledger.rows.reduce((a, r) => a + r.out, 0))}</td>
            <td className="align-right num">{num(closing)}</td>
          </tr>
        }
        emptyTitle="No movements in this period"
        emptyDescription="Widen the date range or clear the transaction type."
      />
    </>
  )
}

function Summary({ label, value, tone = '', strong = false, sub }) {
  return (
    <div>
      <div className="kv-label">{label}</div>
      <div className={`num ${tone}`} style={{ fontSize: strong ? 18 : 15, fontWeight: 600 }}>{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  )
}
