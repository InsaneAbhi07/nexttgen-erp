/** Shop floor — stage-wise work-in-progress board and stage output log. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, Factory, Gauge, Plus, Route, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId } from '../../store/selectors.js'
import { wipBoard } from '../../store/mfg.js'
import { PROCESS_STAGES } from '../../data/constants.js'
import { fmtDate, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, DataTable, DocNo, FilterPanel, PageHeader, Progress, StatCard, StatusBadge, inDateRange } from '../../components/ui/index.js'
import StageEntryDrawer from './StageEntryDrawer.jsx'
import { CRUMB } from './shared.jsx'

export default function ShopFloorPage() {
  usePageTitle('Shop floor')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const [drawer, setDrawer] = useState(null)
  const items = byId(state.items)
  const orders = byId(state.productionOrders)
  const t = today()

  const board = useMemo(() => wipBoard(state), [state])
  const stagesInUse = PROCESS_STAGES.filter((s) => board.some((r) => r.progress.some((p) => p.stage === s)))
  const columns = stagesInUse.map((stage) => {
    const cards = board
      .map((r) => ({ ...r, op: r.progress.find((p) => p.stage === stage) }))
      .filter((r) => r.op && r.op.waiting > 0)
      .sort((a, b) => b.op.waiting - a.op.waiting)
    return { stage, cards, total: cards.reduce((a, c) => a + c.op.waiting, 0) }
  })

  const entries = state.stageEntries || []
  const todayEntries = entries.filter((e) => e.date === t)
  const wipTotal = columns.reduce((a, c) => a + c.total, 0)

  const logRows = entries
    .filter((e) => (!filters.stage || e.stage === filters.stage) && inDateRange(e.date, filters.period))
    .map((e) => ({ ...e, order: orders.get(e.productionOrderId), product: items.get(e.productId) }))

  const logColumns = [
    { key: 'number', header: 'Entry', render: (e) => <DocNo>{e.number}</DocNo> },
    { key: 'date', header: 'Date', render: (e) => fmtDate(e.date) },
    { key: 'order', header: 'Order', accessor: (e) => e.order?.number, render: (e) => (e.order ? <DocNo to={`/production/orders/${e.order.id}`}>{e.order.number}</DocNo> : '—') },
    { key: 'product', header: 'Product', accessor: (e) => e.product?.name, render: (e) => <span className="cell-primary">{e.product?.name}</span> },
    { key: 'stage', header: 'Stage', render: (e) => (<div><div>{e.stage}</div>{e.mode === 'Job Work' && <div className="cell-secondary">Job work</div>}</div>) },
    { key: 'okQty', header: 'OK', align: 'right', render: (e) => <span className="strong">{num(e.okQty)}</span> },
    { key: 'rejectedQty', header: 'Rejected', align: 'right', render: (e) => <span className={e.rejectedQty ? 'text-red' : 'muted'}>{num(e.rejectedQty)}</span> },
    { key: 'reworkQty', header: 'Rework', align: 'right', render: (e) => <span className={e.reworkQty ? 'text-amber' : 'muted'}>{num(e.reworkQty || 0)}</span> },
    { key: 'operator', header: 'Operator / work centre', render: (e) => (<div><div>{e.operator || '—'}</div><div className="cell-secondary">{e.workCentre}</div></div>) },
    { key: 'shift', header: 'Shift' },
  ]

  return (
    <>
      <PageHeader
        title="Shop floor"
        subtitle="Work-in-progress at every stage, from die casting to packing. Record stage output as pieces move down the line."
        breadcrumbs={[CRUMB, { label: 'Shop floor' }]}
        actions={
          <>
            <Button icon={Route} to="/production/routings">Process routes</Button>
            {can('Production', 'add') && <Button variant="primary" icon={Plus} onClick={() => setDrawer({})}>Record stage output</Button>}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Orders on the floor" value={board.length} icon={ClipboardList} tone="violet" foot={`${board.filter((r) => r.order.status === 'Released').length} released, not started`} to="/production/orders" />
        <StatCard label="Pieces in WIP" value={num(wipTotal)} icon={Boxes} tone="brass" foot={columns.length ? `Most at ${[...columns].sort((a, b) => b.total - a.total)[0].stage.toLowerCase()}` : 'Nothing on the floor'} />
        <StatCard label="Stage output today" value={num(todayEntries.reduce((a, e) => a + e.okQty, 0))} icon={Gauge} tone="blue" foot={`${todayEntries.length} entries recorded`} />
        <StatCard label="Rejected today" value={num(todayEntries.reduce((a, e) => a + (e.rejectedQty || 0), 0))} icon={XCircle} tone="red" foot={`${num(todayEntries.reduce((a, e) => a + (e.reworkQty || 0), 0))} pieces on rework`} />
      </div>

      <Card title="WIP board" subtitle="Pieces waiting at each stage, by production order" className="mb-16">
        {board.length ? (
          <div className="prd-board">
            {columns.map((col) => (
              <div key={col.stage} className="prd-board-col">
                <div className="prd-board-head">
                  {col.stage}
                  <span>{num(col.total)}</span>
                </div>
                {col.cards.map((c) => (
                  <button key={c.order.id} type="button" className="prd-board-card" onClick={() => navigate(`/production/orders/${c.order.id}`)}>
                    <div className="row-between">
                      <span className="doc-no">{c.order.number}</span>
                      {c.op.mode === 'Job Work' && <StatusBadge status="Job Work" />}
                    </div>
                    <div className="small truncate" style={{ margin: '4px 0' }} title={c.product?.name}>{c.product?.name}</div>
                    <div className="row-between">
                      <span className="qty">{num(c.op.waiting)}</span>
                      <span className="small muted">of {num(c.order.plannedQty)}</span>
                    </div>
                    <Progress value={c.op.pct} tone="brass" style={{ marginTop: 6 }} />
                  </button>
                ))}
                {!col.cards.length && <div className="prd-board-empty">Nothing waiting</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small">No released or in-progress orders with a process route. <a href="/production/orders" onClick={(e) => { e.preventDefault(); navigate('/production/orders') }}>Open production orders</a></div>
        )}
      </Card>

      <DataTable
        title="Stage output log"
        columns={logColumns}
        data={logRows}
        exportName="stage-output"
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Search order, product or operator…"
        onRowClick={(e) => e.order && navigate(`/production/orders/${e.order.id}`)}
        filters={
          <FilterPanel
            filters={[
              { key: 'stage', label: 'Stage', options: PROCESS_STAGES, placeholder: 'All stages' },
              { key: 'period', type: 'daterange' },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        emptyTitle="No stage output recorded"
        emptyDescription="Record OK and rejected pieces as they pass each stage."
        emptyAction={can('Production', 'add') && <Button size="sm" variant="primary" icon={Factory} onClick={() => setDrawer({})}>Record stage output</Button>}
      />

      <StageEntryDrawer open={Boolean(drawer)} onClose={() => setDrawer(null)} orderId={drawer?.orderId} stage={drawer?.stage} />
    </>
  )
}
