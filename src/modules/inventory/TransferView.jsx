/**
 * Stock transfer detail with stock impact and printable transfer note (frontend-only demo).
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Pencil, Printer, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, itemStock } from '../../store/selectors.js'
import { fmtDate, fmtDateTime, inr, num } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, KeyValue, PageHeader, StatusBadge } from '../../components/ui/index.js'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import NotFound from '../../pages/NotFound.jsx'
import { INV_CRUMB } from './helpers.jsx'
import { useTransferActions } from './TransferList.jsx'

export default function TransferView() {
  const { id } = useParams()
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { markReceived, deleteTransfer } = useTransferActions()
  const [preview, setPreview] = useState(false)
  const t = state.stockTransfers.find((x) => x.id === id)
  usePageTitle(t ? `Transfer ${t.number}` : 'Transfer not found')
  if (!t) return <NotFound />

  const items = byId(state.items)
  const warehouses = byId(state.warehouses)
  const from = warehouses.get(t.fromWarehouseId)
  const to = warehouses.get(t.toWarehouseId)
  const totalQty = t.lines.reduce((a, l) => a + Number(l.qty), 0)
  const totalValue = t.lines.reduce((a, l) => a + Number(l.qty) * (Number(items.get(l.itemId)?.purchaseRate) || 0), 0)

  return (
    <>
      <PageHeader
        title={`Transfer ${t.number}`}
        badge={<StatusBadge status={t.status} />}
        subtitle={`${from?.name} to ${to?.name}, ${fmtDate(t.date)}`}
        breadcrumbs={[INV_CRUMB, { label: 'Stock transfers', to: '/inventory/transfers' }, { label: t.number }]}
        actions={
          <>
            {can('Inventory', 'delete') && (
              <Button variant="ghost" icon={Trash2} style={{ color: 'var(--red)' }} onClick={async () => (await deleteTransfer(t)) && navigate('/inventory/transfers')}>
                Delete
              </Button>
            )}
            <Button icon={Printer} onClick={() => setPreview(true)}>Print</Button>
            {can('Inventory', 'edit') && <Button icon={Pencil} to={`/inventory/transfers/${t.id}/edit`}>Edit</Button>}
            {can('Inventory', 'edit') && t.status === 'In Transit' && (
              <Button variant="primary" icon={CheckCircle2} onClick={() => markReceived(t)}>
                Mark as received
              </Button>
            )}
          </>
        }
      />

      <div className="stack">
        <Card title="Transfer details">
          <KeyValue
            cols={4}
            items={[
              { label: 'Transfer number', value: <span className="doc-no">{t.number}</span> },
              { label: 'Date', value: fmtDate(t.date) },
              { label: 'Status', value: <StatusBadge status={t.status} /> },
              { label: 'Vehicle number', value: t.vehicleNo },
              { label: 'From warehouse', value: from?.name },
              { label: 'To warehouse', value: to?.name },
              { label: 'Total quantity', value: num(totalQty) },
              { label: 'Value at purchase rate', value: inr(totalValue) },
              { label: 'Created by', value: t.createdBy || 'Suresh Yadav' },
              { label: 'Received on', value: t.receivedAt ? fmtDateTime(t.receivedAt) : t.status === 'Received' ? fmtDate(t.date) : 'Pending' },
              { label: 'Remarks', value: t.remarks, span: 2 },
            ]}
          />
        </Card>

        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
          <Card title="Items" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th className="align-right">Quantity</th>
                    <th>Unit</th>
                    <th className="align-right">Rate</th>
                    <th className="align-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {t.lines.map((l, i) => {
                    const it = items.get(l.itemId)
                    return (
                      <tr key={l.id || i}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <div className="cell-primary">{it?.name}</div>
                          <div className="cell-secondary">{it?.code}</div>
                        </td>
                        <td className="align-right num strong">{num(l.qty)}</td>
                        <td>{it?.unit}</td>
                        <td className="align-right num">{inr(it?.purchaseRate)}</td>
                        <td className="align-right num">{inr(Number(l.qty) * (Number(it?.purchaseRate) || 0))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td>Total</td>
                    <td className="align-right num">{num(totalQty)}</td>
                    <td />
                    <td />
                    <td className="align-right num">{inr(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="Stock impact" subtitle="Current balances after this transfer">
            {t.lines.map((l, i) => {
              const it = items.get(l.itemId)
              return (
                <div key={l.id || i} className="impact-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-primary truncate">{it?.name}</div>
                    <div className="cell-secondary">
                      <span className="text-red">−{num(l.qty)}</span> <ArrowRight size={11} style={{ verticalAlign: -1, color: 'var(--brass)' }} /> <span className="text-green">+{num(l.qty)}</span> {it?.unit}
                    </div>
                  </div>
                  <div>
                    <div className="tiny muted truncate">{from?.name}</div>
                    <div className="num strong">{num(itemStock(state, l.itemId, t.fromWarehouseId))}</div>
                  </div>
                  <div>
                    <div className="tiny muted truncate">{to?.name}</div>
                    <div className="num strong">{num(itemStock(state, l.itemId, t.toWarehouseId))}</div>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>
      </div>

      <DocumentPreview
        open={preview}
        onClose={() => setPreview(false)}
        onSend={false}
        title="Stock Transfer Note"
        subtitle="Inter-warehouse movement, not a sale"
        numberLabel="Transfer No."
        number={t.number}
        date={t.date}
        meta={[
          { label: 'Status', value: t.status },
          { label: 'Vehicle No.', value: t.vehicleNo },
        ]}
        party={{ heading: 'From warehouse', name: from?.name, address: from?.address, phone: from?.phone }}
        shipTo={{ heading: 'To warehouse', name: to?.name, address: to?.address, right: [{ label: 'Contact', value: to?.contactPerson }, { label: 'Phone', value: to?.phone }] }}
        lines={t.lines}
        columns={[
          { header: 'Unit', render: (l, it) => it?.unit },
          { header: 'Qty', align: 'right', render: (l) => num(l.qty) },
          { header: 'Rate', align: 'right', render: (l, it) => inr(it?.purchaseRate) },
          { header: 'Value', align: 'right', render: (l, it) => inr(Number(l.qty) * (Number(it?.purchaseRate) || 0)) },
        ]}
        notes={t.remarks}
        terms={'Goods moved between own warehouses of the company.\nNo sale is involved; valued at purchase rate for records.\nReceiver to verify quantities and sign on arrival.'}
        signLabel="Store in-charge"
      />
    </>
  )
}
