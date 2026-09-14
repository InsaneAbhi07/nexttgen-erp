/** Production order cockpit — status, materials, output, cost. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, Calculator, CheckCircle2, ChevronDown, Factory, Gauge, PackageCheck, PackageOpen, Pencil, Percent, Play, Printer, Recycle, Target, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, productionCosting, productionProgress, requiredMaterials } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, pct, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Callout, Card, DocNo, Dropdown, KeyValue, PageHeader, Progress, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, MiniTable, MissingRecord, Stepper, orderStage } from './shared.jsx'

export default function OrderView() {
  const { id } = useParams()
  const { state, get, patch } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [printing, setPrinting] = useState(false)
  const order = get('productionOrders', id)
  usePageTitle(order ? order.number : 'Production order')
  if (!order) return <MissingRecord label="Production order" backTo="/production/orders" />

  const items = byId(state.items)
  const warehouses = byId(state.warehouses)
  const product = items.get(order.productId)
  const bom = state.boms.find((b) => b.id === order.bomId)
  const prog = productionProgress(state, order.id)
  const costing = productionCosting(state, order)
  const materials = requiredMaterials(state, order.bomId, order.plannedQty, order.rmWarehouseId).map((m) => {
    const issued = prog.issued[m.itemId] || 0
    return { ...m, issued, remaining: Math.max(0, Math.round((m.required - issued) * 100) / 100) }
  })
  const issues = state.materialIssues.filter((m) => m.productionOrderId === order.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const wastes = state.wastages.filter((w) => w.productionOrderId === order.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const entries = [...prog.entries].sort((a, b) => (a.date < b.date ? 1 : -1))
  const stage = orderStage(order, prog)
  const cancelled = order.status === 'Cancelled'
  const open = ['Planned', 'Released', 'In Progress'].includes(order.status)
  const running = ['Released', 'In Progress'].includes(order.status)
  const materialPending = materials.some((m) => m.remaining > 0)
  const pctDone = order.plannedQty ? (prog.produced / order.plannedQty) * 100 : 0
  const yieldPct = prog.produced ? (prog.good / prog.produced) * 100 : 0
  const overdue = open && order.expectedDate < today()
  const unit = product?.unit || ''

  const release = () => {
    patch('productionOrders', order.id, { status: 'Released' }, { action: 'released' })
    toast.success('Production order released', `${order.number} is ready for material issue.`)
  }
  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel production order?',
      message: `${order.number} for ${num(order.plannedQty)} × ${product?.name} will be cancelled. Material already issued stays issued; return it through a stock-in if needed.`,
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      tone: 'danger',
    })
    if (ok) {
      patch('productionOrders', order.id, { status: 'Cancelled' }, { action: 'cancelled' })
      toast.success('Production order cancelled', order.number)
    }
  }

  const moreItems = [
    { label: 'Print job card', icon: Printer, onClick: () => setPrinting(true) },
    prog.produced > 0 && { label: 'View costing', icon: Calculator, to: `/production/costing?order=${order.id}` },
    can('Production', 'add') && !cancelled && { label: 'Record wastage', icon: Recycle, to: `/production/wastage?new=1&order=${order.id}` },
    can('Production', 'edit') && open && { label: 'Edit order', icon: Pencil, to: `/production/orders/${order.id}/edit` },
    can('Production', 'edit') && open && prog.produced === 0 && { divider: true },
    can('Production', 'edit') && open && prog.produced === 0 && { label: 'Cancel order', icon: Ban, danger: true, onClick: cancel },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={order.number}
        badge={<StatusBadge status={order.status} />}
        subtitle={`${product?.name}, planned ${num(order.plannedQty)} ${unit}, ${order.priority.toLowerCase()} priority`}
        breadcrumbs={[CRUMB, { label: 'Production orders', to: '/production/orders' }, { label: order.number }]}
        actions={
          <>
            <Dropdown width={200} items={moreItems} trigger={({ toggle }) => <Button iconRight={ChevronDown} onClick={toggle}>More</Button>} />
            {order.status === 'Planned' && can('Production', 'edit') && (
              <Button variant="primary" icon={Play} onClick={release}>
                Release order
              </Button>
            )}
            {running && materialPending && can('Production', 'add') && (
              <Button variant={prog.produced > 0 || Object.keys(prog.issued).length ? 'secondary' : 'primary'} icon={PackageOpen} to={`/production/material-issue/new?order=${order.id}`}>
                Issue material
              </Button>
            )}
            {running && can('Production', 'add') && (Object.keys(prog.issued).length > 0 || !materialPending) && (
              <Button variant="primary" icon={Factory} to={`/production/entries/new?order=${order.id}`}>
                Record production
              </Button>
            )}
          </>
        }
      />

      {cancelled && <Callout tone="red" icon={XCircle} style={{ marginBottom: 16 }}>This order was cancelled. It is kept for reference and no further activity can be recorded.</Callout>}
      {order.status === 'Completed' && (
        <Callout tone="green" icon={CheckCircle2} style={{ marginBottom: 16 }}>
          Completed with {num(prog.good)} good units in {warehouses.get(order.warehouseId)?.name}. Cost per unit {inr2(costing.costPerUnit)}, estimated margin {pct(costing.margin)}.
        </Callout>
      )}

      <Card className="mb-16">
        <Stepper current={stage} cancelled={cancelled} />
        <div className="row" style={{ gap: 12, marginTop: 18 }}>
          <Progress value={pctDone} tone={cancelled ? 'red' : pctDone >= 100 ? 'green' : 'brass'} style={{ flex: 1, height: 8 }} />
          <span className="small strong nowrap">{pct(Math.min(pctDone, 999), 0)} produced</span>
        </div>
      </Card>

      <div className="grid-5 mb-16">
        <StatCard label="Planned" value={`${num(order.plannedQty)} ${unit}`} icon={Target} tone="violet" foot={`Expected ${fmtDate(order.expectedDate)}`} />
        <StatCard label="Produced" value={num(prog.produced)} icon={Factory} tone="brass" foot={`${num(Math.max(0, order.plannedQty - prog.produced))} still to produce`} />
        <StatCard label="Rejected" value={num(prog.rejected)} icon={XCircle} tone="red" foot={`${wastes.length} wastage record(s)`} />
        <StatCard label="Good quantity" value={num(prog.good)} icon={PackageCheck} tone="green" foot="Added to finished goods stock" />
        <StatCard label="Yield" value={prog.produced ? pct(yieldPct) : '—'} icon={Percent} tone="blue" foot="Good units vs produced" />
      </div>

      <div className="prd-split mb-16">
        <Card
          title="Materials"
          subtitle={`${bom?.code || 'BOM'} × ${num(order.plannedQty)} from ${warehouses.get(order.rmWarehouseId)?.name || 'store'}`}
          flush
          actions={running && materialPending && can('Production', 'add') && <Button size="sm" variant="soft" icon={PackageOpen} to={`/production/material-issue/new?order=${order.id}`}>Issue material</Button>}
        >
          <MiniTable
            rowKey="itemId"
            columns={[
              { key: 'item', header: 'Material', render: (m) => (<div><div className="cell-primary">{m.item?.name}</div><div className="cell-secondary">{m.item?.code}, {num(m.perUnit)} {m.unit} per unit</div></div>) },
              { key: 'required', header: 'Required', align: 'right', render: (m) => `${num(m.required)} ${m.unit}` },
              { key: 'issued', header: 'Issued', align: 'right', render: (m) => <span className="strong">{num(m.issued)}</span> },
              {
                key: 'progress',
                header: 'Issue progress',
                render: (m) => <Progress value={m.required ? (m.issued / m.required) * 100 : 0} tone={m.issued >= m.required ? 'green' : 'brass'} style={{ minWidth: 70 }} />,
              },
              { key: 'remaining', header: 'Remaining', align: 'right', render: (m) => (m.remaining > 0 ? num(m.remaining) : <span className="text-green">Done</span>) },
              { key: 'available', header: 'In store', align: 'right', render: (m) => <span className={m.remaining > m.available ? 'text-red strong' : ''}>{num(m.available)}</span> },
            ]}
            rows={materials}
          />
        </Card>

        <div className="stack">
          <Card title="Order details">
            <KeyValue
              cols={2}
              items={[
                { label: 'Product', value: <a href={`/masters/items?view=${product?.id}`} onClick={(e) => { e.preventDefault(); navigate(`/masters/items?view=${product?.id}`) }}>{product?.name}</a>, span: 2 },
                { label: 'BOM', value: bom ? <DocNo to={`/production/bom/${bom.id}`}>{bom.code}</DocNo> : '—' },
                { label: 'Priority', value: <StatusBadge status={order.priority} /> },
                { label: 'Order date', value: fmtDate(order.date) },
                { label: 'Expected completion', value: <span className={overdue ? 'text-red' : ''}>{fmtDate(order.expectedDate)}{overdue ? ' (overdue)' : ''}</span> },
                { label: 'Finished goods to', value: warehouses.get(order.warehouseId)?.name },
                { label: 'Material from', value: warehouses.get(order.rmWarehouseId)?.name },
                { label: 'Remarks', value: order.remarks, span: 2 },
              ]}
            />
          </Card>
          <Card title="Cost so far" actions={prog.produced > 0 && <Button size="sm" variant="ghost" icon={Calculator} to={`/production/costing?order=${order.id}`}>Open costing</Button>}>
            <div className="totals" style={{ maxWidth: 'none' }}>
              <div className="totals-row"><span>Raw material</span><span>{inr(costing.rawMaterialCost)}</span></div>
              <div className="totals-row"><span>Labour</span><span>{inr(costing.labourCost)}</span></div>
              <div className="totals-row"><span>Transport and freight</span><span>{inr(costing.freightCost)}</span></div>
              <div className="totals-row"><span>Other manufacturing</span><span>{inr(costing.otherCost)}</span></div>
              <div className="totals-row grand"><span>Total cost</span><span>{inr(costing.totalCost)}</span></div>
              <div className="totals-row"><span>Cost per good unit</span><span>{costing.good ? inr2(costing.costPerUnit) : '—'}</span></div>
              <div className="totals-row"><span>Estimated margin</span><span className={costing.margin < 25 ? 'text-amber' : 'text-green'}>{costing.good ? pct(costing.margin) : '—'}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Production entries"
        subtitle={`${entries.length} shift entr${entries.length === 1 ? 'y' : 'ies'}`}
        flush
        className="mb-16"
        actions={running && can('Production', 'add') && <Button size="sm" variant="soft" icon={Gauge} to={`/production/entries/new?order=${order.id}`}>Record production</Button>}
      >
        <MiniTable
          empty="No production recorded yet"
          emptyDescription={running ? 'Record shift output once material has been issued.' : undefined}
          onRowClick={(e) => navigate(`/production/entries/${e.id}`)}
          columns={[
            { key: 'number', header: 'Entry', render: (e) => <DocNo to={`/production/entries/${e.id}`}>{e.number}</DocNo> },
            { key: 'date', header: 'Date', render: (e) => fmtDate(e.date) },
            { key: 'shift', header: 'Shift' },
            { key: 'producedQty', header: 'Produced', align: 'right', render: (e) => num(e.producedQty) },
            { key: 'rejectedQty', header: 'Rejected', align: 'right', render: (e) => <span className={Number(e.rejectedQty) ? 'text-red' : 'muted'}>{num(e.rejectedQty)}</span> },
            { key: 'good', header: 'Good', align: 'right', render: (e) => <span className="strong">{num(e.producedQty - (e.rejectedQty || 0))}</span> },
            { key: 'labourCost', header: 'Labour', align: 'right', render: (e) => inr(e.labourCost) },
            { key: 'supervisor', header: 'Supervisor' },
          ]}
          rows={entries}
        />
      </Card>

      <div className="grid-2">
        <Card title="Material issues" flush>
          <MiniTable
            empty="No material issued yet"
            onRowClick={(m) => navigate(`/production/material-issue/${m.id}`)}
            columns={[
              { key: 'number', header: 'Issue', render: (m) => <DocNo to={`/production/material-issue/${m.id}`}>{m.number}</DocNo> },
              { key: 'date', header: 'Date', render: (m) => fmtDate(m.date) },
              { key: 'lines', header: 'Materials', align: 'right', render: (m) => m.lines.filter((l) => Number(l.issuedQty) > 0).length },
              { key: 'issuedBy', header: 'Issued by' },
            ]}
            rows={issues}
          />
        </Card>
        <Card title="Wastage and rejection" flush actions={can('Production', 'add') && !cancelled && <Button size="sm" variant="ghost" icon={Recycle} to={`/production/wastage?new=1&order=${order.id}`}>Record</Button>}>
          <MiniTable
            empty="No wastage recorded"
            columns={[
              { key: 'date', header: 'Date', render: (w) => fmtDate(w.date) },
              { key: 'item', header: 'Item', render: (w) => items.get(w.itemId)?.name },
              { key: 'qty', header: 'Qty', align: 'right', render: (w) => `${num(w.qty)} ${items.get(w.itemId)?.unit || ''}` },
              { key: 'type', header: 'Type', render: (w) => <StatusBadge status={w.type} /> },
            ]}
            rows={wastes}
          />
        </Card>
      </div>

      <DocumentPreview
        open={printing}
        onClose={() => setPrinting(false)}
        onSend={false}
        title="Production Job Card"
        subtitle={`Priority: ${order.priority}`}
        numberLabel="Order No."
        number={order.number}
        date={order.date}
        party={{ heading: 'Product', name: product?.name, address: `${product?.code}, BOM ${bom?.code || ''} v${bom?.version || ''}` }}
        meta={[
          { label: 'Planned qty', value: `${num(order.plannedQty)} ${unit}` },
          { label: 'Expected by', value: fmtDate(order.expectedDate) },
          { label: 'FG warehouse', value: warehouses.get(order.warehouseId)?.name },
          { label: 'Status', value: order.status },
        ]}
        lines={materials.map((m) => ({ id: m.itemId, itemId: m.itemId, perUnit: m.perUnit, required: m.required, issued: m.issued }))}
        columns={[
          { header: 'Per unit', align: 'right', render: (l) => num(l.perUnit) },
          { header: 'Required', align: 'right', render: (l) => num(l.required) },
          { header: 'Issued', align: 'right', render: (l) => num(l.issued) },
          { header: 'Unit', render: (l, it) => it?.unit },
        ]}
        terms={'Check the first piece for fit and finish before running the full batch.\nRecord shift output and rejected pieces in the production entry.\nReturn unused material to the raw material store with a stock-in slip.'}
        signLabel="Production supervisor"
      />
    </>
  )
}
