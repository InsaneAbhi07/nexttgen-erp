/** QC plans — the checklists used for each kind of inspection. Read-only in this demo. */
import { ClipboardCheck } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { QC_PLANS } from '../../store/mfg.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Badge, Callout, Card, PageHeader } from '../../components/ui/index.js'
import { QC_CRUMB } from './QualityDashboard.jsx'
import './quality.css'

const APPLIES = {
  Lock: { types: ['Final'], to: 'Door locks, padlocks and furniture locks' },
  Handle: { types: ['Final'], to: 'Handles, hinges, tower bolts, aldrops and other fittings' },
  'Raw Material': { types: ['Incoming', 'Final'], to: 'Raw materials, castings, components, consumables and semi-finished parts' },
  Packaging: { types: ['Incoming'], to: 'Cartons, blister packs and master cartons' },
  'Job Work': { types: ['Job Work'], to: 'Material received back from platers, buffers and heat treaters' },
  'In-process': { types: ['In-process'], to: 'Patrol checks at any shop-floor stage' },
}

export default function QcPlansPage() {
  usePageTitle('QC plans')
  const { state } = useErp()
  const used = (key) => (state.qcInspections || []).filter((q) => q.planKey === key).length

  return (
    <>
      <PageHeader
        title="QC plans"
        subtitle="The checklist an inspector follows for each kind of lot. The plan is picked automatically from the item and inspection type."
        breadcrumbs={[QC_CRUMB, { label: 'QC plans' }]}
      />
      <Callout style={{ marginBottom: 16 }}>Plans are fixed in this demo. Inspectors can add extra checks to any individual inspection.</Callout>
      <div className="grid-2">
        {Object.entries(QC_PLANS).map(([key, plan]) => (
          <Card key={key} title={plan.name} subtitle={`${plan.checks.length} checks, used in ${used(key)} inspection(s)`} actions={<ClipboardCheck size={16} className="muted" />}>
            <ul className="qc-plan-list">
              {plan.checks.map(([param, spec]) => (
                <li key={param}>
                  <span>{param}</span>
                  <span className="spec">{spec}</span>
                </li>
              ))}
            </ul>
            <div className="qc-applies">
              {APPLIES[key]?.types.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
              <span className="small muted">{APPLIES[key]?.to}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
