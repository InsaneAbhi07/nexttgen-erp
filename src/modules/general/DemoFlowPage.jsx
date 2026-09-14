/**
 * Demo walkthrough — guides a presenter through the end-to-end flow:
 * masters, purchase, production, sales, accounts and reports.
 * Steps tick automatically when a record is created in this browser
 * (records created through the UI carry `createdBy`; seed data does not).
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Check, Factory, IndianRupee, KeyRound, Receipt, RotateCcw, ShoppingCart } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { usePageTitle } from '../../utils/hooks.js'
import { DEMO_PASSWORD } from '../../store/AuthContext.jsx'
import { Badge, Button, Callout, Card, PageHeader, Progress, useConfirm, useToast } from '../../components/ui/index.js'
import FlowRail from '../../components/common/FlowRail.jsx'
import './general.css'

const byUser = (list = [], pred) => list.filter((r) => r.createdBy && (!pred || pred(r)))
const latest = (list) => [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]

function buildSections(state) {
  const cust = latest(byUser(state.customers))
  const sup = latest(byUser(state.suppliers))
  const rm = latest(byUser(state.items, (i) => i.type === 'Raw Material'))
  const fg = latest(byUser(state.items, (i) => i.type === 'Finished Good'))
  const bom = latest(byUser(state.boms))
  const po = latest(byUser(state.purchaseOrders))
  const grn = latest(byUser(state.grns))
  const prd = latest(byUser(state.productionOrders))
  const mi = latest(byUser(state.materialIssues))
  const pe = latest(byUser(state.productionEntries))
  const so = latest(byUser(state.salesOrders))
  const dc = latest(byUser(state.deliveryChallans))
  const inv = latest(byUser(state.salesInvoices))
  const rct = latest(byUser(state.receipts))

  return [
    {
      key: 'start',
      title: 'Getting started',
      steps: [
        { title: 'Sign in', show: 'Use the Owner / Super Admin demo account to show role-based access.', to: '/profile', done: true },
        { title: 'Owner dashboard', show: 'Today’s sales, purchase, receivables, payables, production and low stock at a glance.', to: '/dashboard', done: true },
      ],
    },
    {
      key: 'masters',
      title: 'Masters',
      steps: [
        { title: 'Create a customer', show: 'Add a dealer with GSTIN, credit limit and payment terms.', to: '/masters/customers?new=1', done: Boolean(cust) },
        { title: 'Create a supplier', show: 'Add a component vendor with GSTIN and credit terms.', to: '/masters/suppliers?new=1', done: Boolean(sup) },
        { title: 'Create a raw material', show: 'Lock body, spring or brass rod with HSN, GST and minimum stock.', to: '/masters/items?new=1&type=Raw%20Material', done: Boolean(rm) },
        { title: 'Create a finished product', show: 'The lock you manufacture, with sales rate and warehouse.', to: '/masters/items?new=1&type=Finished%20Good', done: Boolean(fg) },
      ],
    },
    {
      key: 'purchase',
      title: 'Purchase',
      steps: [
        { title: 'Create a purchase order', show: 'Select the supplier and raw material; show discount, GST split and grand total.', to: sup ? `/purchase/orders/new?supplier=${sup.id}` : '/purchase/orders/new', done: Boolean(po) },
        { title: 'Receive material (GRN)', show: 'Record received, rejected and accepted quantity against the PO.', to: po ? `/purchase/grn/new?po=${po.id}` : '/purchase/grn/new', done: Boolean(grn) },
        { title: 'Stock updated', show: 'Open the stock ledger to show the GRN increasing raw material stock.', to: rm ? `/inventory/ledger?item=${rm.id}` : '/inventory/stock', done: Boolean(grn) },
      ],
    },
    {
      key: 'production',
      title: 'Production',
      steps: [
        { title: 'Create a bill of material', show: 'Define components per unit, e.g. lock body, shackle, 2 springs, 4 screws.', to: fg ? `/production/bom/new?product=${fg.id}` : '/production/bom/new', done: Boolean(bom) },
        { title: 'Create a production order', show: 'Plan quantity and show required materials, available stock and shortage.', to: fg ? `/production/orders/new?product=${fg.id}&qty=100` : '/production/orders/new', done: Boolean(prd) },
        { title: 'Issue material', show: 'Issue components from the raw material store to the shop floor.', to: prd ? `/production/material-issue/new?order=${prd.id}` : '/production/material-issue/new', done: Boolean(mi) },
        { title: 'Record production', show: 'Enter produced, rejected and wastage quantity with labour cost.', to: prd ? `/production/entries/new?order=${prd.id}` : '/production/entries/new', done: Boolean(pe) },
        { title: 'Finished goods stock', show: 'Show good units added to the Finished Goods Godown and the batch cost.', to: fg ? `/inventory/ledger?item=${fg.id}` : '/inventory/stock', done: Boolean(pe) },
      ],
    },
    {
      key: 'sales',
      title: 'Sales',
      steps: [
        { title: 'Create a sales order', show: 'Book the order for the new customer with rates and delivery date.', to: cust ? `/sales/orders/new?customer=${cust.id}` : '/sales/orders/new', done: Boolean(so) },
        { title: 'Dispatch with a delivery challan', show: 'Deliver full or part quantity with transporter and vehicle details.', to: so ? `/sales/challans/new?so=${so.id}` : '/sales/challans/new', done: Boolean(dc) },
        { title: 'Raise the sales invoice', show: 'Open the tax invoice preview with CGST/SGST or IGST and amount in words.', to: dc ? `/sales/invoices/new?dc=${dc.id}` : '/sales/invoices/new', done: Boolean(inv) },
      ],
    },
    {
      key: 'accounts',
      title: 'Accounts',
      steps: [
        { title: 'Receive customer payment', show: 'Record a UPI, NEFT or cheque receipt against the invoice.', to: inv ? `/accounts/receipts/new?invoice=${inv.id}` : '/accounts/receipts/new', done: Boolean(rct) },
        { title: 'Outstanding updated', show: 'Show the invoice balance reduce in outstanding and the customer ledger.', to: '/accounts/outstanding?tab=receivable', done: Boolean(rct) },
      ],
    },
    {
      key: 'reports',
      title: 'Reports',
      steps: [{ title: 'View reports', show: 'Sales, purchase, stock, production costing and GST summary with export and print.', to: '/reports', done: Boolean(rct) }],
    },
  ]
}

const RAIL = [
  { key: 'purchase', label: 'Purchase', icon: ShoppingCart },
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'sales', label: 'Sales', icon: Receipt },
  { key: 'accounts', label: 'Accounts', icon: IndianRupee },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
]

export default function DemoFlowPage() {
  usePageTitle('Demo walkthrough')
  const { state, resetDemo } = useErp()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const sections = useMemo(() => buildSections(state), [state])

  const steps = sections.flatMap((s) => s.steps)
  const doneCount = steps.filter((s) => s.done).length
  const nextStep = steps.find((s) => !s.done)
  let counter = 0

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'Records created during the walkthrough will be removed and fresh sample data loaded.',
      confirmLabel: 'Reset data',
      tone: 'danger',
    })
    if (!ok) return
    resetDemo()
    toast.success('Demo data reset', 'The walkthrough starts again from the first step.')
  }

  return (
    <>
      <PageHeader
        title="Demo walkthrough"
        subtitle="Follow the flow from supplier to customer receipt. Steps tick off as you create records."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Demo walkthrough' }]}
        actions={
          <>
            <Button icon={RotateCcw} onClick={handleReset}>
              Reset demo data
            </Button>
            {nextStep && (
              <Button variant="primary" onClick={() => navigate(nextStep.to)}>
                Continue: {nextStep.title.toLowerCase()}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-16" bodyClassName="demo-rail-body">
        <FlowRail
          steps={RAIL.map((r) => {
            const sec = sections.find((s) => s.key === r.key)
            const d = sec.steps.filter((s) => s.done).length
            return { key: r.key, label: r.label, icon: r.icon, value: `${d} of ${sec.steps.length}`, sub: d === sec.steps.length ? 'Complete' : 'steps done' }
          })}
        />
      </Card>

      <div className="demo-layout">
        <div className="stack">
          {sections.map((sec) => {
            const d = sec.steps.filter((s) => s.done).length
            return (
              <Card key={sec.key} title={sec.title} actions={<Badge tone={d === sec.steps.length ? 'green' : 'gray'}>{d} of {sec.steps.length} done</Badge>} flush>
                <ol className="demo-steps">
                  {sec.steps.map((step) => {
                    counter += 1
                    const isNext = step === nextStep
                    return (
                      <li key={step.title} className={`demo-step ${step.done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
                        <span className="demo-step-no" aria-label={step.done ? 'Done' : `Step ${counter}`}>
                          {step.done ? <Check size={14} strokeWidth={2.5} /> : counter}
                        </span>
                        <div className="grow">
                          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <span className="strong" style={{ color: 'var(--ink)' }}>{step.title}</span>
                            {isNext && <Badge tone="blue">Next</Badge>}
                          </div>
                          <div className="small muted">{step.show}</div>
                        </div>
                        <Button size="sm" variant={isNext ? 'primary' : 'secondary'} to={step.to}>
                          Open
                        </Button>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )
          })}
        </div>

        <aside className="demo-aside">
          <Card title="Progress">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="small muted">
                {doneCount} of {steps.length} steps
              </span>
              <span className="strong">{Math.round((doneCount / steps.length) * 100)}%</span>
            </div>
            <Progress value={(doneCount / steps.length) * 100} tone="brass" />
            {nextStep ? (
              <p className="small ink-2 mt-16">
                Next: <b>{nextStep.title}</b>. {nextStep.show}
              </p>
            ) : (
              <Callout tone="green" style={{ marginTop: 14 }}>
                Walkthrough complete. Every stage of the flow has been demonstrated.
              </Callout>
            )}
          </Card>
          <Card title="Presenter notes">
            <ul className="demo-notes">
              <li>
                <KeyRound size={14} /> Every demo account uses the password <span className="mono strong">{DEMO_PASSWORD}</span>.
              </li>
              <li>Press Ctrl + K anywhere to search customers, items and documents.</li>
              <li>Records are saved in this browser, so refreshing keeps your progress.</li>
              <li>Reset the data before each client meeting for a clean start.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  )
}
