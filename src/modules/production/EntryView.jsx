/** Production entry detail. Frontend-only demo. */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Calculator, CheckCircle2, ClipboardList, Factory, PackageCheck, Percent, Recycle, Trash2, XCircle } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock, productionProgress } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num, pct } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Callout, Card, DocNo, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import { CRUMB, MissingRecord } from './shared.jsx'

export default function EntryView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { state, get, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const entry = get('productionEntries', id)
  usePageTitle(entry ? entry.number : 'Production entry')
  if (!entry) return <MissingRecord label="Production entry" backTo="/production/entries" />

  const items = byId(state.items)
  const order = get('productionOrders', entry.productionOrderId)
  const product = items.get(entry.productId)
  const warehouse = get('warehouses', entry.warehouseId)
  const good = Number(entry.producedQty) - (Number(entry.rejectedQty) || 0)
  const yieldPct = Number(entry.producedQty) ? (good / Number(entry.producedQty)) * 100 : 0
  const conversion = (Number(entry.labourCost) || 0) + (Number(entry.otherCost) || 0) + (Number(entry.freightCost) || 0)
  const prog = order ? productionProgress(state, order.id) : null
  const fgBalance = itemStock(state, entry.productId, entry.warehouseId)
  const created = params.get('created') === '1'
  const rejectionRecorded = state.wastages.some((w) => w.productionOrderId === entry.productionOrderId && w.itemId === entry.productId && w.type === 'Rejection' && w.date >= entry.date)

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete production entry?',
      message: `${entry.number} will be removed and ${num(good)} ${product?.unit} taken out of ${warehouse?.name} stock.`,
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (ok) {
      remove('productionEntries', entry.id)
      toast.success('Production entry deleted', 'Finished goods stock has been reversed.')
      navigate(order ? `/production/orders/${order.id}` : '/production/entries')
    }
  }

  return (
    <>
      <PageHeader
        title={entry.number}
        subtitle={`${product?.name}, ${entry.shift?.toLowerCase() || 'day'} shift on ${fmtDate(entry.date)}`}
        breadcrumbs={[CRUMB, { label: 'Production entries', to: '/production/entries' }, { label: entry.number }]}
        actions={
          <>
            {can('Production', 'delete') && !entry.historical && <Button variant="ghost" icon={Trash2} onClick={handleDelete} style={{ color: 'var(--red)' }}>Delete</Button>}
            {order && <Button icon={Calculator} to={`/production/costing?order=${order.id}`}>View costing</Button>}
            {order && ['Released', 'In Progress'].includes(order.status) && can('Production', 'add') && (
              <Button variant="primary" icon={Factory} to={`/production/entries/new?order=${order.id}`}>Record another entry</Button>
            )}
          </>
        }
      />

      <Callout tone={created ? 'green' : 'gray'} icon={CheckCircle2} style={{ marginBottom: 16 }}>
        {created ? 'Production recorded. ' : ''}
        Finished goods stock of {product?.name} in {warehouse?.name} is now <b>{num(fgBalance)} {product?.unit}</b>.{' '}
        <a href={`/inventory/ledger?item=${entry.productId}&warehouse=${entry.warehouseId}`} onClick={(e) => { e.preventDefault(); navigate(`/inventory/ledger?item=${entry.productId}&warehouse=${entry.warehouseId}`) }}>
          View stock ledger
        </a>
      </Callout>

      {Number(entry.rejectedQty) > 0 && !rejectionRecorded && can('Production', 'add') && (
        <Callout tone="amber" icon={Recycle} style={{ marginBottom: 16 }}>
          {num(entry.rejectedQty)} rejected units have no rejection record yet.{' '}
          <a
            href="/production/wastage"
            onClick={(e) => {
              e.preventDefault()
              navigate(`/production/wastage?new=1&order=${entry.productionOrderId}&type=Rejection&qty=${entry.rejectedQty}&item=${entry.productId}`)
            }}
          >
            Record rejection
          </a>
        </Callout>
      )}

      <div className="grid-4 mb-16">
        <StatCard label="Produced" value={`${num(entry.producedQty)} ${product?.unit || ''}`} icon={Factory} tone="brass" foot={`Planned ${num(entry.plannedQty)}`} />
        <StatCard label="Rejected" value={num(entry.rejectedQty)} icon={XCircle} tone="red" foot={`${num(entry.wastageQty || 0)} kg wastage`} />
        <StatCard label="Good quantity" value={num(good)} icon={PackageCheck} tone="green" foot={`Into ${warehouse?.name}`} />
        <StatCard label="Yield" value={pct(yieldPct)} icon={Percent} tone="blue" foot="Good vs produced" />
      </div>

      <div className="prd-split">
        <Card title="Entry details">
          <KeyValue
            items={[
              { label: 'Production order', value: order ? <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo> : '—' },
              { label: 'Order status', value: order ? <StatusBadge status={order.status} /> : '—' },
              { label: 'Order progress', value: order ? `${num(prog.produced)} of ${num(order.plannedQty)} produced` : '—' },
              { label: 'Product', value: product?.name },
              { label: 'Date', value: fmtDate(entry.date) },
              { label: 'Shift', value: entry.shift },
              { label: 'Supervisor', value: entry.supervisor },
              { label: 'Warehouse', value: warehouse?.name },
              { label: 'Recorded by', value: entry.createdBy || 'Mohd. Irfan' },
              { label: 'Remarks', value: entry.remarks, span: 3 },
            ]}
          />
          {order && (
            <Button size="sm" variant="soft" icon={ClipboardList} to={`/production/orders/${order.id}`} style={{ marginTop: 16 }}>
              Open production order
            </Button>
          )}
        </Card>
        <Card title="Conversion cost">
          <div className="totals" style={{ maxWidth: 'none' }}>
            <div className="totals-row"><span>Labour</span><span>{inr(entry.labourCost)}</span></div>
            <div className="totals-row"><span>Other manufacturing</span><span>{inr(entry.otherCost)}</span></div>
            <div className="totals-row"><span>Transport and freight</span><span>{inr(entry.freightCost)}</span></div>
            <div className="totals-row grand"><span>Total</span><span>{inr(conversion)}</span></div>
            <div className="totals-row"><span>Per good unit</span><span>{good > 0 ? inr2(conversion / good) : '—'}</span></div>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>Raw material cost is taken from material issues in production costing.</p>
        </Card>
      </div>
    </>
  )
}
