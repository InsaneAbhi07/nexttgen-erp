/** Material issue slip — detail & print. Frontend-only demo. */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Factory, Printer, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { fmtDate, inr, inr2, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, DocNo, KeyValue, PageHeader, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, MiniTable, MissingRecord } from './shared.jsx'

export default function IssueView() {
  const { id } = useParams()
  const { state, get, remove } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [printing, setPrinting] = useState(false)
  const issue = get('materialIssues', id)
  usePageTitle(issue ? issue.number : 'Material issue')
  if (!issue) return <MissingRecord label="Material issue" backTo="/production/material-issue" />

  const items = byId(state.items)
  const order = get('productionOrders', issue.productionOrderId)
  const product = items.get(order?.productId)
  const warehouse = get('warehouses', issue.warehouseId)
  const lines = issue.lines.map((l) => {
    const item = items.get(l.itemId)
    const rate = Number(item?.purchaseRate) || 0
    return { ...l, item, rate, value: (Number(l.issuedQty) || 0) * rate, stock: itemStock(state, l.itemId, issue.warehouseId) }
  })
  const total = lines.reduce((a, l) => a + l.value, 0)

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete material issue?',
      message: `${issue.number} will be removed and the issued quantities returned to ${warehouse?.name} stock.`,
      confirmLabel: 'Delete issue',
      tone: 'danger',
    })
    if (ok) {
      remove('materialIssues', issue.id)
      toast.success('Material issue deleted', 'Stock has been returned to the store.')
      navigate('/production/material-issue')
    }
  }

  return (
    <>
      <PageHeader
        title={issue.number}
        subtitle={`Issued on ${fmtDate(issue.date)} from ${warehouse?.name || 'store'}`}
        breadcrumbs={[CRUMB, { label: 'Material issue', to: '/production/material-issue' }, { label: issue.number }]}
        actions={
          <>
            {can('Production', 'delete') && !issue.historical && <Button variant="ghost" icon={Trash2} onClick={handleDelete} style={{ color: 'var(--red)' }}>Delete</Button>}
            <Button icon={Printer} onClick={() => setPrinting(true)}>Print issue slip</Button>
            {order && ['Released', 'In Progress'].includes(order.status) && can('Production', 'add') && (
              <Button variant="primary" icon={Factory} to={`/production/entries/new?order=${order.id}`}>Record production</Button>
            )}
          </>
        }
      />

      <div className="prd-split">
        <Card title="Issued materials" subtitle={`${lines.length} material(s), value ${inr(total)}`} flush>
          <MiniTable
            columns={[
              { key: 'item', header: 'Material', render: (l) => (<div><div className="cell-primary">{l.item?.name}</div><div className="cell-secondary">{l.item?.code}</div></div>) },
              { key: 'requiredQty', header: 'Required', align: 'right', render: (l) => `${num(l.requiredQty)} ${l.item?.unit || ''}` },
              { key: 'issuedQty', header: 'Issued', align: 'right', render: (l) => <span className="strong">{num(l.issuedQty)}</span> },
              { key: 'rate', header: 'Rate', align: 'right', render: (l) => inr2(l.rate) },
              { key: 'value', header: 'Value', align: 'right', render: (l) => inr2(l.value) },
              { key: 'stock', header: 'Store balance now', align: 'right', render: (l) => num(l.stock) },
            ]}
            rows={lines}
            footer={
              <tr>
                <td>Total</td>
                <td />
                <td />
                <td />
                <td className="align-right">{inr2(total)}</td>
                <td />
              </tr>
            }
          />
        </Card>
        <Card title="Issue details">
          <KeyValue
            cols={2}
            items={[
              { label: 'Production order', value: order ? <DocNo to={`/production/orders/${order.id}`}>{order.number}</DocNo> : '—' },
              { label: 'Order status', value: order ? <StatusBadge status={order.status} /> : '—' },
              { label: 'Product', value: product?.name, span: 2 },
              { label: 'Planned quantity', value: order ? `${num(order.plannedQty)} ${product?.unit}` : '—' },
              { label: 'Warehouse', value: warehouse?.name },
              { label: 'Issued by', value: issue.issuedBy },
              { label: 'Received by', value: issue.receivedBy },
              { label: 'Remarks', value: issue.remarks, span: 2 },
            ]}
          />
          {order && (
            <Button size="sm" variant="soft" icon={ClipboardList} to={`/production/orders/${order.id}`} style={{ marginTop: 16 }}>
              Open production order
            </Button>
          )}
        </Card>
      </div>

      <DocumentPreview
        open={printing}
        onClose={() => setPrinting(false)}
        onSend={false}
        title="Material Issue Slip"
        subtitle="Stores to shop floor"
        numberLabel="Issue No."
        number={issue.number}
        date={issue.date}
        party={{ heading: 'Issued for', name: product?.name, address: `Production order ${order?.number || ''}, planned ${num(order?.plannedQty || 0)} ${product?.unit || ''}` }}
        meta={[
          { label: 'Warehouse', value: warehouse?.name },
          { label: 'Issued by', value: issue.issuedBy },
          { label: 'Received by', value: issue.receivedBy },
        ]}
        lines={issue.lines}
        columns={[
          { header: 'Required', align: 'right', render: (l) => num(l.requiredQty) },
          { header: 'Issued', align: 'right', render: (l) => num(l.issuedQty) },
          { header: 'Unit', render: (l, it) => it?.unit },
        ]}
        terms={`Material received in good condition by ${issue.receivedBy}.\nUnused material must be returned to stores the same day.\n${issue.remarks || ''}`}
        signLabel="Store in-charge"
      />
    </>
  )
}
