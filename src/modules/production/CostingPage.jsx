/** Production costing — actual cost per unit vs standard BOM cost. Frontend-only demo. */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Calculator, IndianRupee, Percent, Printer, Tag } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, productionCosting, productionProgress } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, pct } from '../../utils/format.js'
import { printPage } from '../../utils/export.js'
import { usePageTitle } from '../../utils/hooks.js'
import { CHART } from '../../config/theme.js'
import { Button, Callout, Card, DataTable, DocNo, EmptyState, PageHeader, Select, StatCard, StatusBadge } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { CRUMB, MiniTable, bomUnitCost } from './shared.jsx'

export default function CostingPage() {
  usePageTitle('Production costing')
  const { state, get } = useErp()
  const [params, setParams] = useSearchParams()
  const items = byId(state.items)
  const boms = byId(state.boms)

  const producedOrders = useMemo(() => {
    const withEntries = new Set(state.productionEntries.map((e) => e.productionOrderId))
    return state.productionOrders.filter((o) => withEntries.has(o.id)).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [state.productionEntries, state.productionOrders])

  const summary = useMemo(
    () =>
      producedOrders
        .filter((o) => !o.historical)
        .map((o) => {
          const c = productionCosting(state, o)
          return { ...o, c, productName: c.product?.name || '—', costPerUnit: c.costPerUnit, margin: c.margin, total: c.totalCost, good: c.good }
        })
        .filter((r) => r.good > 0),
    [producedOrders, state],
  )

  const defaultOrder = producedOrders.find((o) => o.status === 'Completed' && !o.historical) || producedOrders[0]
  const order = get('productionOrders', params.get('order')) || defaultOrder

  const orderOptions = producedOrders.map((o) => ({ value: o.id, label: `${o.number}, ${items.get(o.productId)?.name}` }))

  const header = (
    <PageHeader
      title="Production costing"
      subtitle="Actual cost per unit from issued material, labour, freight and other manufacturing cost."
      breadcrumbs={[CRUMB, { label: 'Production costing' }]}
      actions={
        <>
          <Select options={orderOptions} value={order?.id || ''} onChange={(e) => setParams({ order: e.target.value })} style={{ width: 300 }} aria-label="Production order" />
          <Button icon={Printer} onClick={printPage} disabled={!order}>Print</Button>
        </>
      }
    />
  )

  if (!order) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState icon={Calculator} title="No production recorded yet" description="Costing appears once a production entry is recorded against an order." action={<Button variant="primary" to="/production/entries/new">Record production</Button>} />
        </div>
      </>
    )
  }

  const c = productionCosting(state, order)
  const prog = productionProgress(state, order.id)
  const bom = boms.get(order.bomId)
  const standardUnit = bom ? bomUnitCost(bom, items) : 0
  const actualMaterialUnit = c.good ? c.rawMaterialCost / c.good : 0
  const variance = actualMaterialUnit - standardUnit
  const conversionUnit = c.good ? (c.labourCost + c.otherCost + c.freightCost) / c.good : 0
  const unitMargin = c.sellingPrice - c.costPerUnit

  const parts = [
    { name: 'Raw material', value: c.rawMaterialCost, color: CHART.blue },
    { name: 'Labour', value: c.labourCost, color: CHART.brass },
    { name: 'Transport and freight', value: c.freightCost, color: CHART.teal },
    { name: 'Other manufacturing', value: c.otherCost, color: CHART.violet },
  ]

  const materialRows = Object.entries(prog.issued).map(([itemId, qty]) => {
    const item = items.get(itemId)
    const comp = bom?.components.find((x) => x.itemId === itemId)
    const rate = Number(item?.purchaseRate) || 0
    const stdQty = comp ? (Number(comp.qty) * c.produced) / (Number(bom.outputQty) || 1) : 0
    return { itemId, item, qty, rate, amount: qty * rate, stdQty, variance: qty - stdQty }
  })

  return (
    <>
      {header}
      <div className="print-area stack">
        <Card>
          <div className="row-between row-wrap">
            <div>
              <div className="row" style={{ gap: 10 }}>
                <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo>
                <StatusBadge status={order.status} />
              </div>
              <div className="strong" style={{ fontSize: 16, marginTop: 4 }}>{c.product?.name}</div>
              <div className="small muted">
                Ordered {fmtDate(order.date)}, planned {num(order.plannedQty)}, produced {num(c.produced)}, rejected {num(c.rejected)}, BOM {bom?.code}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">Good units</div>
              <div className="prd-hero-value">{num(c.good)} {c.product?.unit}</div>
            </div>
          </div>
        </Card>

        {order.status !== 'Completed' && (
          <Callout tone="amber">This order is still in progress. Material is issued for the full batch, so the cost per unit will come down as more production is recorded.</Callout>
        )}

        <div className="grid-4">
          <StatCard label="Total production cost" value={inr(c.totalCost)} icon={IndianRupee} tone="blue" foot={`${num(c.good)} good units`} />
          <StatCard label="Cost per unit" value={inr2(c.costPerUnit)} icon={Calculator} tone="brass" foot={`Standard material ${inr2(standardUnit)}`} />
          <StatCard label="Selling price" value={inr2(c.sellingPrice)} icon={Tag} tone="violet" foot="From item master" />
          <StatCard label="Estimated margin" value={pct(c.margin)} icon={Percent} tone={c.margin < 25 ? 'amber' : 'green'} foot={`${inr2(unitMargin)} per unit`} />
        </div>

        <div className="prd-split">
          <Card title="Cost breakdown" subtitle="Where the money went in this batch">
            <div className="grid-2" style={{ alignItems: 'center' }}>
              <div>
                {parts.map((p) => (
                  <div key={p.name} className="prd-cost-row">
                    <span className="row" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
                      {p.name}
                    </span>
                    <span className="strong num">{inr(p.value)}</span>
                    <span className="bar"><span style={{ width: `${c.totalCost ? (p.value / c.totalCost) * 100 : 0}%`, background: p.color }} /></span>
                  </div>
                ))}
                <div className="prd-cost-row total">
                  <span>Total production cost</span>
                  <span className="num">{inr(c.totalCost)}</span>
                </div>
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={parts} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {parts.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatter={(v) => inr(v)} labelFormatter={() => 'Production cost'} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card title="Standard vs actual" subtitle="Per good unit">
            <div className="totals" style={{ maxWidth: 'none' }}>
              <div className="totals-row"><span>Standard material (BOM)</span><span>{inr2(standardUnit)}</span></div>
              <div className="totals-row"><span>Actual material</span><span>{inr2(actualMaterialUnit)}</span></div>
              <div className="totals-row">
                <span>Material variance</span>
                <span className={variance > 0.5 ? 'text-red' : 'text-green'}>
                  {variance >= 0 ? '+' : '−'}{inr2(Math.abs(variance))} ({standardUnit ? pct((variance / standardUnit) * 100) : '—'})
                </span>
              </div>
              <div className="totals-row"><span>Conversion cost</span><span>{inr2(conversionUnit)}</span></div>
              <div className="totals-row grand"><span>Cost per unit</span><span>{inr2(c.costPerUnit)}</span></div>
              <div className="totals-row"><span>Selling price</span><span>{inr2(c.sellingPrice)}</span></div>
              <div className="totals-row"><span>Margin per unit</span><span className={unitMargin < 0 ? 'text-red' : 'text-green'}>{inr2(unitMargin)}</span></div>
            </div>
          </Card>
        </div>

        <Card title="Material consumption" subtitle="Issued quantity at standard purchase rate, compared with the BOM quantity for units produced" flush>
          <MiniTable
            rowKey="itemId"
            empty="No material issued for this order"
            columns={[
              { key: 'item', header: 'Material', render: (r) => (<div><div className="cell-primary">{r.item?.name}</div><div className="cell-secondary">{r.item?.code}</div></div>) },
              { key: 'stdQty', header: 'BOM qty for output', align: 'right', render: (r) => `${num(r.stdQty)} ${r.item?.unit || ''}` },
              { key: 'qty', header: 'Issued', align: 'right', render: (r) => <span className="strong">{num(r.qty)}</span> },
              { key: 'variance', header: 'Difference', align: 'right', render: (r) => <span className={r.variance > 0.01 ? 'text-amber' : 'muted'}>{r.variance > 0 ? '+' : ''}{num(r.variance)}</span> },
              { key: 'rate', header: 'Rate', align: 'right', render: (r) => inr2(r.rate) },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => inr2(r.amount) },
            ]}
            rows={materialRows}
            footer={
              materialRows.length > 0 && (
                <tr>
                  <td>Total raw material</td>
                  <td colSpan={4} />
                  <td className="align-right">{inr2(c.rawMaterialCost)}</td>
                </tr>
              )
            }
          />
        </Card>
      </div>

      <DataTable
        className="no-print mt-16"
        title="All production orders"
        subtitle="Current orders with recorded output. Select a row to see its breakdown."
        columns={[
          { key: 'number', header: 'Order no.', render: (r) => <DocNo>{r.number}</DocNo> },
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'productName', header: 'Product' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'good', header: 'Good units', align: 'right', render: (r) => num(r.good) },
          { key: 'total', header: 'Total cost', align: 'right', render: (r) => inr(r.total) },
          { key: 'costPerUnit', header: 'Cost / unit', align: 'right', render: (r) => inr2(r.costPerUnit) },
          { key: 'sellingPrice', header: 'Selling price', align: 'right', accessor: (r) => r.c.sellingPrice, render: (r) => inr(r.c.sellingPrice) },
          { key: 'margin', header: 'Margin', align: 'right', render: (r) => <span className={`strong ${r.margin < 25 ? 'text-amber' : 'text-green'}`}>{pct(r.margin)}</span> },
        ]}
        data={summary}
        initialSort={{ key: 'date', dir: 'desc' }}
        exportName="production-costing"
        searchPlaceholder="Search order or product…"
        onRowClick={(r) => {
          setParams({ order: r.id })
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        emptyTitle="No costed orders yet"
      />
    </>
  )
}
