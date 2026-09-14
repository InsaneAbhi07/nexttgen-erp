/** Purchase order — detail page (frontend-only demo). */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, CalendarClock, CheckCircle2, IndianRupee, MoreHorizontal, PackageCheck, Pencil, Printer, Send, Trash2, Truck } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { byId, poReceivedQty } from '../../store/selectors.js'
import { calcLine, isInterState } from '../../utils/calc.js'
import { daysBetween, fmtDate, fmtDateTime, inr, inr2, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, Dropdown, KeyValue, PageHeader, Progress, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import TotalsSummary from '../../components/common/TotalsSummary.jsx'
import DocumentPreview from '../../components/common/DocumentPreview.jsx'
import { CRUMB, DocTrail, MissingRecord, SupplierCard, buildPurchaseTrail, partyFor, usePrintParam } from './shared.jsx'

export default function PurchaseOrderView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, get, patch, remove } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const po = get('purchaseOrders', id)
  usePageTitle(po?.number || 'Purchase order')
  const [printOpen, openPrint, closePrint] = usePrintParam()
  const received = useMemo(() => (po ? poReceivedQty(state, po.id) : {}), [state, po])
  const trail = useMemo(() => (po ? buildPurchaseTrail(state, { poId: po.id }) : []), [state, po])

  if (!po) return <MissingRecord what="Purchase order" to="/purchase/orders" />

  const supplier = get('suppliers', po.supplierId)
  const warehouse = get('warehouses', po.warehouseId)
  const pr = get('purchaseRequisitions', po.prId)
  const items = byId(state.items)
  const interState = isInterState(supplier?.state)
  const ordered = po.lines.reduce((a, l) => a + Number(l.qty), 0)
  const got = po.lines.reduce((a, l) => a + Math.min(received[l.itemId] || 0, Number(l.qty)), 0)
  const pct = ordered ? (got / ordered) * 100 : 0
  const open = ['Submitted', 'Approved', 'Partially Received'].includes(po.status)
  const daysLeft = daysBetween(today(), po.expectedDate)
  const hasGrn = state.grns.some((g) => g.poId === po.id)
  const editable = ['Draft', 'Submitted'].includes(po.status) && can('Purchase', 'edit')

  const setStatus = (status, action, title, desc) => {
    patch('purchaseOrders', po.id, { status, ...(status === 'Approved' ? { approvedBy: user?.name, approvedAt: new Date().toISOString() } : {}) }, { action })
    toast.success(title, desc)
  }

  const cancelOrder = async () => {
    const ok = await confirm({
      title: 'Cancel purchase order?',
      message: `${po.number} will be marked cancelled. Inform ${supplier?.name} separately.`,
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      tone: 'danger',
    })
    if (ok) setStatus('Cancelled', 'cancelled', 'Purchase order cancelled', po.number)
  }

  const deleteOrder = async () => {
    if (hasGrn) {
      toast.error('This purchase order can’t be deleted', 'Material has already been received against it.')
      return
    }
    const ok = await confirm({ title: 'Delete purchase order?', message: `${po.number} will be removed from the demo data.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('purchaseOrders', po.id)
      toast.success('Purchase order deleted', po.number)
      navigate('/purchase/orders')
    }
  }

  return (
    <>
      <PageHeader
        title={po.number}
        badge={<StatusBadge status={po.status} />}
        subtitle={`${supplier?.name || 'Supplier'}, dated ${fmtDate(po.date)}`}
        breadcrumbs={[CRUMB, { label: 'Purchase orders', to: '/purchase/orders' }, { label: po.number }]}
        actions={
          <>
            <Button icon={Printer} onClick={openPrint}>
              Print
            </Button>
            {editable && (
              <Button icon={Pencil} to={`/purchase/orders/${po.id}/edit`}>
                Edit
              </Button>
            )}
            {po.status === 'Draft' && can('Purchase', 'edit') && (
              <Button icon={Send} onClick={() => setStatus('Submitted', 'submitted', 'Purchase order submitted', `${po.number} is waiting for approval.`)}>
                Submit
              </Button>
            )}
            {po.status === 'Submitted' && can('Purchase', 'approve') && (
              <Button variant="success" icon={CheckCircle2} onClick={() => setStatus('Approved', 'approved', 'Purchase order approved', `${po.number} is ready for goods receipt.`)}>
                Approve
              </Button>
            )}
            {['Approved', 'Partially Received'].includes(po.status) && can('Purchase', 'add') && (
              <Button variant="primary" icon={PackageCheck} to={`/purchase/grn/new?po=${po.id}`}>
                Receive material
              </Button>
            )}
            {(can('Purchase', 'edit') || can('Purchase', 'delete')) && (
              <Dropdown
                width={200}
                items={[
                  { label: 'Cancel order', icon: Ban, onClick: cancelOrder, hidden: !can('Purchase', 'edit') || !['Draft', 'Submitted', 'Approved'].includes(po.status) },
                  { label: 'Delete', icon: Trash2, danger: true, onClick: deleteOrder, hidden: !can('Purchase', 'delete') },
                ]}
                trigger={({ toggle }) => <Button iconOnly icon={MoreHorizontal} onClick={toggle} aria-label="More actions" />}
              />
            )}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Order value" value={inr(po.totals.grandTotal)} icon={IndianRupee} tone="blue" foot={`${po.lines.length} items, GST ${inr(po.totals.gst)}`} />
        <StatCard label="Received" value={`${Math.round(pct)}%`} icon={PackageCheck} tone={pct >= 100 ? 'green' : 'amber'} foot={`${num(got)} of ${num(ordered)} units`} />
        <StatCard
          label="Expected delivery"
          value={fmtDate(po.expectedDate)}
          icon={CalendarClock}
          tone={open && daysLeft < 0 ? 'red' : 'teal'}
          foot={!open ? po.status : daysLeft < 0 ? `Overdue by ${-daysLeft} days` : daysLeft === 0 ? 'Due today' : `In ${daysLeft} days`}
        />
        <StatCard label="Goods receipts" value={num(state.grns.filter((g) => g.poId === po.id).length)} icon={Truck} tone="violet" foot={warehouse ? `Into ${warehouse.name}` : ''} />
      </div>

      <div className="pur-top mb-16">
        <Card title="Order details">
          <KeyValue
            items={[
              { label: 'PO date', value: fmtDate(po.date) },
              { label: 'Expected delivery', value: fmtDate(po.expectedDate) },
              { label: 'Deliver to', value: warehouse?.name },
              { label: 'Reference', value: po.reference },
              { label: 'Requisition', value: pr ? <Link className="doc-no" to={`/purchase/requisitions/${pr.id}`}>{pr.number}</Link> : null },
              { label: 'Tax type', value: interState ? 'IGST (inter-state)' : 'CGST + SGST' },
              { label: 'Created by', value: po.createdBy || 'Amit Verma' },
              { label: 'Created on', value: fmtDateTime(po.createdAt) },
              { label: 'Approved by', value: po.approvedBy || (['Approved', 'Partially Received', 'Received'].includes(po.status) ? 'Rajesh Kumar' : null) },
            ]}
          />
        </Card>
        <SupplierCard supplier={supplier} />
      </div>

      <Card title="Items" subtitle="Ordered against received quantity" flush className="mb-16" footer={<TotalsSummary totals={po.totals} showWords />}>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>HSN</th>
                <th className="align-right">Ordered</th>
                <th className="align-right">Received</th>
                <th className="align-right">Pending</th>
                <th style={{ width: 110 }}>Progress</th>
                <th className="align-right">Rate</th>
                <th className="align-right">Disc.</th>
                <th className="align-right">GST</th>
                <th className="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l, i) => {
                const it = items.get(l.itemId)
                const r = received[l.itemId] || 0
                const c = calcLine(l)
                return (
                  <tr key={l.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="cell-primary">{it?.name}</div>
                      <div className="cell-secondary">{it?.code}</div>
                    </td>
                    <td className="mono small">{it?.hsn}</td>
                    <td className="align-right num">
                      {num(l.qty)} <span className="muted tiny">{it?.unit}</span>
                    </td>
                    <td className="align-right num">{num(r)}</td>
                    <td className={`align-right num ${Math.max(0, l.qty - r) > 0 ? 'text-amber' : 'muted'}`}>{num(Math.max(0, l.qty - r))}</td>
                    <td>
                      <Progress value={(Math.min(r, l.qty) / l.qty) * 100} />
                    </td>
                    <td className="align-right num">{inr2(l.rate)}</td>
                    <td className="align-right num">{Number(l.discount) ? `${l.discount}%` : '—'}</td>
                    <td className="align-right num">{l.gst}%</td>
                    <td className="align-right num strong">{inr2(c.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Terms & remarks">
          <div className="small ink-2" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {po.terms || 'No terms added.'}
          </div>
          {po.remarks && (
            <div className="mt-16">
              <div className="kv-label">Remarks</div>
              <div className="kv-value">{po.remarks}</div>
            </div>
          )}
        </Card>
        <DocTrail groups={trail} currentId={po.id} />
      </div>

      <DocumentPreview
        open={printOpen}
        onClose={closePrint}
        title="Purchase Order"
        numberLabel="PO No."
        number={po.number}
        date={po.date}
        party={partyFor(supplier)}
        meta={[
          { label: 'Expected delivery', value: fmtDate(po.expectedDate) },
          { label: 'Deliver to', value: warehouse?.name },
          { label: 'Reference', value: po.reference },
        ]}
        lines={po.lines}
        totals={po.totals}
        interState={interState}
        terms={po.terms}
        notes={po.remarks}
        stamp={po.status === 'Cancelled' ? 'CANCELLED' : null}
        sendLabel="Send to supplier"
      />
    </>
  )
}
