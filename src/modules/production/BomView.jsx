/** BOM detail page — components, cost breakdown and related production orders. */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChevronDown, CopyPlus, Factory, IndianRupee, Layers, Pencil, Percent, Power, Printer, Tag, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, productionProgress } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, pct } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { SERIES } from '../../config/theme.js'
import { Button, Card, DocNo, Dropdown, KeyValue, PageHeader, Progress, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, MiniTable, MissingRecord, componentRate } from './shared.jsx'

export default function BomView() {
  const { id } = useParams()
  const { state, get, patch, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [printing, setPrinting] = useState(false)
  const bom = get('boms', id)
  usePageTitle(bom ? bom.code : 'BOM')
  if (!bom) return <MissingRecord label="BOM" backTo="/production/bom" />

  const items = byId(state.items)
  const product = items.get(bom.productId)
  const lines = bom.components.map((c) => {
    const item = items.get(c.itemId)
    const rate = componentRate(c, items)
    return { ...c, item, rate, amount: Number(c.qty) * rate }
  })
  const total = lines.reduce((a, l) => a + l.amount, 0)
  const unitCost = total / (Number(bom.outputQty) || 1)
  const salesRate = Number(product?.salesRate) || 0
  const margin = salesRate ? ((salesRate - unitCost) / salesRate) * 100 : 0
  const sorted = [...lines].sort((a, b) => b.amount - a.amount)
  const pie = [
    ...sorted.slice(0, 5).map((l) => ({ name: l.item?.name || 'Item', value: Math.round(l.amount * 100) / 100 })),
    ...(sorted.length > 5 ? [{ name: 'Other components', value: sorted.slice(5).reduce((a, l) => a + l.amount, 0) }] : []),
  ]
  const orders = state.productionOrders.filter((o) => o.bomId === bom.id).sort((a, b) => (a.date < b.date ? 1 : -1))

  const activate = async () => {
    const other = state.boms.find((b) => b.productId === bom.productId && b.status === 'Active' && b.id !== bom.id)
    if (other) {
      const ok = await confirm({ title: 'Replace the active BOM?', message: `${other.code} will be marked inactive for ${product?.name}.`, confirmLabel: 'Activate this BOM' })
      if (!ok) return
      patch('boms', other.id, { status: 'Inactive' }, { silent: true })
    }
    patch('boms', bom.id, { status: 'Active' })
    toast.success('BOM activated', `${bom.code} is now used for new production orders.`)
  }
  const deactivate = async () => {
    const ok = await confirm({ title: 'Mark BOM inactive?', message: `New production orders for ${product?.name} will need another active BOM.`, confirmLabel: 'Mark inactive' })
    if (!ok) return
    patch('boms', bom.id, { status: 'Inactive' })
    toast.success('BOM marked inactive', bom.code)
  }
  const handleDelete = async () => {
    if (orders.length) {
      toast.error('This BOM can’t be deleted', `${orders.length} production order(s) use it. Mark it inactive instead.`)
      return
    }
    const ok = await confirm({ title: 'Delete BOM?', message: `${bom.code} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('boms', bom.id)
      toast.success('BOM deleted', bom.code)
      navigate('/production/bom')
    }
  }

  return (
    <>
      <PageHeader
        title={product?.name || bom.code}
        badge={<StatusBadge status={bom.status} />}
        subtitle={
          <span>
            <span className="doc-no">{bom.code}</span>, version {bom.version}, makes {num(bom.outputQty)} {bom.unit}
          </span>
        }
        breadcrumbs={[CRUMB, { label: 'Bill of material', to: '/production/bom' }, { label: bom.code }]}
        actions={
          <>
            <Dropdown
              width={200}
              items={[
                { label: 'Print BOM', icon: Printer, onClick: () => setPrinting(true) },
                can('Production', 'add') && { label: 'New version', icon: CopyPlus, to: `/production/bom/new?copy=${bom.id}` },
                can('Production', 'edit') && bom.status !== 'Active' && { label: 'Activate', icon: Power, onClick: activate },
                can('Production', 'edit') && bom.status === 'Active' && { label: 'Mark inactive', icon: Power, onClick: deactivate },
                can('Production', 'delete') && { divider: true },
                can('Production', 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: handleDelete },
              ].filter(Boolean)}
              trigger={({ toggle }) => <Button iconRight={ChevronDown} onClick={toggle}>More</Button>}
            />
            {can('Production', 'edit') && <Button icon={Pencil} to={`/production/bom/${bom.id}/edit`}>Edit</Button>}
            {can('Production', 'add') && bom.status === 'Active' && (
              <Button variant="primary" icon={Factory} to={`/production/orders/new?product=${bom.productId}`}>
                Plan production
              </Button>
            )}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Material cost per unit" value={inr2(unitCost)} icon={IndianRupee} tone="brass" foot={`For ${product?.unit || 'unit'} of output`} />
        <StatCard label="Selling price" value={inr(salesRate)} icon={Tag} tone="blue" foot="From item master" />
        <StatCard label="Material margin" value={pct(margin)} icon={Percent} tone={margin < 35 ? 'amber' : 'green'} foot={`${inr2(salesRate - unitCost)} per unit`} />
        <StatCard label="Components" value={lines.length} icon={Layers} tone="violet" foot={`${orders.length} production order(s) use this BOM`} />
      </div>

      <div className="prd-split mb-16">
        <Card title="Components" subtitle={`Quantities for ${num(bom.outputQty)} ${bom.unit}`} flush>
          <MiniTable
            columns={[
              { key: 'item', header: 'Component', render: (l) => (<div><div className="cell-primary">{l.item?.name}</div><div className="cell-secondary">{l.item?.code}, {l.item?.type}</div></div>) },
              { key: 'qty', header: 'Quantity', align: 'right', render: (l) => `${num(l.qty)} ${l.unit || l.item?.unit || ''}` },
              { key: 'rate', header: 'Rate', align: 'right', render: (l) => inr2(l.rate) },
              { key: 'amount', header: 'Amount', align: 'right', render: (l) => <span className="strong">{inr2(l.amount)}</span> },
              { key: 'share', header: 'Share', align: 'right', render: (l) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><Progress value={total ? (l.amount / total) * 100 : 0} tone="brass" style={{ width: 60 }} /><span className="muted small" style={{ width: 38 }}>{total ? pct((l.amount / total) * 100, 0) : '—'}</span></div>) },
            ]}
            rows={lines}
            footer={
              <tr>
                <td>Total material cost</td>
                <td />
                <td />
                <td className="align-right">{inr2(total)}</td>
                <td />
              </tr>
            }
          />
        </Card>

        <Card title="Cost breakdown" subtitle="Share of material cost by component">
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {pie.map((p, i) => (
                    <Cell key={p.name} fill={SERIES[i % SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip formatter={(v) => inr2(v)} labelFormatter={() => 'Material cost'} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="prd-legend mt-8">
            {pie.map((p, i) => (
              <div key={p.name} className="prd-legend-row">
                <span className="sw" style={{ background: SERIES[i % SERIES.length] }} />
                <span className="truncate">{p.name}</span>
                <span className="muted">{total ? pct((p.value / total) * 100, 0) : ''}</span>
                <span className="strong num">{inr2(p.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="prd-split">
        <Card title="Production orders using this BOM" flush>
          <MiniTable
            empty="No production orders yet"
            emptyDescription="Plan production to create the first order with this BOM."
            onRowClick={(o) => navigate(`/production/orders/${o.id}`)}
            columns={[
              { key: 'number', header: 'Order', render: (o) => <DocNo to={`/production/orders/${o.id}`}>{o.number}</DocNo> },
              { key: 'date', header: 'Date', render: (o) => fmtDate(o.date) },
              { key: 'plannedQty', header: 'Planned', align: 'right', render: (o) => num(o.plannedQty) },
              { key: 'produced', header: 'Produced', align: 'right', render: (o) => num(productionProgress(state, o.id).produced) },
              { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
            ]}
            rows={orders.slice(0, 12)}
          />
        </Card>
        <Card title="BOM details">
          <KeyValue
            cols={2}
            items={[
              { label: 'Product', value: product?.name, span: 2 },
              { label: 'Product code', value: product?.code },
              { label: 'Category', value: product?.category },
              { label: 'Output quantity', value: `${num(bom.outputQty)} ${bom.unit}` },
              { label: 'Effective from', value: fmtDate(bom.effectiveFrom) },
              { label: 'Created', value: fmtDate((bom.createdAt || '').slice(0, 10)) },
              { label: 'Status', value: <StatusBadge status={bom.status} /> },
              { label: 'Remarks', value: bom.remarks, span: 2 },
            ]}
          />
        </Card>
      </div>

      <DocumentPreview
        open={printing}
        onClose={() => setPrinting(false)}
        onSend={false}
        title="Bill of Material"
        subtitle={`Version ${bom.version}`}
        numberLabel="BOM code"
        number={bom.code}
        date={bom.effectiveFrom}
        party={{ heading: 'Product', name: product?.name, address: `${product?.code}, ${product?.category}` }}
        meta={[
          { label: 'Output qty', value: `${num(bom.outputQty)} ${bom.unit}` },
          { label: 'Status', value: bom.status },
          { label: 'Cost / unit', value: inr2(unitCost) },
        ]}
        lines={bom.components}
        columns={[
          { header: 'Qty', align: 'right', render: (l) => num(l.qty) },
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'Rate', align: 'right', render: (l) => inr2(componentRate(l, items)) },
          { header: 'Amount', align: 'right', render: (l) => inr2(Number(l.qty) * componentRate(l, items)) },
        ]}
        terms={`Standard material cost per unit: ${inr2(unitCost)}.\nQuantities are for ${num(bom.outputQty)} ${bom.unit} of output.\n${bom.remarks || ''}`}
        signLabel="Production head"
      />
    </>
  )
}
