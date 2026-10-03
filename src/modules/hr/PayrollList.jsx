/**
 * Salary sheets — the owner generates a month's salary from attendance, reviews it,
 * approves it and marks it paid. Frontend-only demo (mock store).
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Banknote, IndianRupee, Landmark, Play, Users } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { buildPayroll, monthTitle, shiftMonth } from '../../store/hr.js'
import { financialYear } from '../../store/numbering.js'
import { fmtDate, inr, inrCompact, num, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, Card, DataTable, DocNo, KeyValue, PageHeader, Select, StatCard, StatusBadge, useToast } from '../../components/ui/index.js'
import { HR_CRUMB, NoAccess } from './shared.jsx'

export default function PayrollList() {
  usePageTitle('Salary')
  const { state, save } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const t = today()
  const curMonth = t.slice(0, 7)
  const runs = useMemo(() => [...(state.payrollRuns || [])].sort((a, b) => (a.month < b.month ? 1 : -1)), [state.payrollRuns])
  const done = new Set(runs.map((r) => r.month))
  const monthOptions = Array.from({ length: 6 }, (_, i) => shiftMonth(curMonth, -i)).map((m) => ({ value: m, label: `${monthTitle(m)}${done.has(m) ? ' (generated)' : m === curMonth ? ' (running month)' : ''}` }))
  const firstOpen = monthOptions.find((o) => !done.has(o.value) && o.value !== curMonth)?.value || shiftMonth(curMonth, -1)
  const [month, setMonth] = useState(params.get('generate') || firstOpen)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => (done.has(month) ? null : buildPayroll(state, month)), [state, month]) // eslint-disable-line react-hooks/exhaustive-deps
  const existing = runs.find((r) => r.month === month)

  if (!can('Payroll')) return <NoAccess what="salary" back="/hr" />

  const generate = async () => {
    setBusy(true)
    await fakeDelay(500)
    const saved = save(
      'payrollRuns',
      { date: t, month, status: 'Draft', slips: preview.slips, totals: preview.totals, remarks: '', generatedBy: user?.name, approvedBy: '', approvedAt: '', paidOn: '', paymentRef: '', disbursements: [] },
      { action: 'generated' },
    )
    setBusy(false)
    toast.success('Salary sheet generated', `${saved.number}: ${preview.totals.headcount} employees, ${inr(preview.totals.net)} net pay. Review and approve it.`)
    navigate(`/hr/payroll/${saved.id}`)
  }

  const fy = financialYear(t)
  const fyPaid = runs.filter((r) => r.status === 'Paid' && financialYear(`${r.month}-01`) === fy).reduce((a, r) => a + r.totals.net, 0)
  const latest = runs[0]
  const awaiting = runs.filter((r) => r.status !== 'Paid')

  const columns = [
    { key: 'number', header: 'Salary sheet', render: (r) => <DocNo to={`/hr/payroll/${r.id}`}>{r.number}</DocNo> },
    { key: 'month', header: 'Month', render: (r) => <span className="cell-primary">{monthTitle(r.month)}</span> },
    { key: 'headcount', header: 'Employees', align: 'right', accessor: (r) => r.totals.headcount, render: (r) => num(r.totals.headcount) },
    { key: 'gross', header: 'Gross', align: 'right', accessor: (r) => r.totals.gross, render: (r) => inr(r.totals.gross) },
    { key: 'deductions', header: 'Deductions', align: 'right', accessor: (r) => r.totals.deductions, render: (r) => inr(r.totals.deductions) },
    { key: 'net', header: 'Net pay', align: 'right', accessor: (r) => r.totals.net, render: (r) => <b className="num">{inr(r.totals.net)}</b> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'paidOn', header: 'Paid on', render: (r) => (r.paidOn ? fmtDate(r.paidOn) : <span className="muted">—</span>) },
  ]

  return (
    <>
      <PageHeader
        title="Salary"
        subtitle="Monthly salary is calculated from attendance, leave and the salary structure in the employee master."
        breadcrumbs={[HR_CRUMB, { label: 'Salary' }]}
        actions={<Button icon={Users} to="/masters/employees">Employee salary structure</Button>}
      />

      <div className="grid-4 mb-16">
        <StatCard label="Last salary sheet" value={latest ? inrCompact(latest.totals.net) : '—'} icon={IndianRupee} tone="blue" foot={latest ? `${monthTitle(latest.month)}, ${latest.status.toLowerCase()}` : 'Nothing generated yet'} to={latest ? `/hr/payroll/${latest.id}` : undefined} />
        <StatCard label={`Salary paid FY ${fy}`} value={inrCompact(fyPaid)} icon={Banknote} tone="green" foot="Net pay, paid sheets" />
        <StatCard label="PF + ESI, last sheet" value={latest ? inrCompact(latest.totals.pf + latest.totals.esi) : '—'} icon={Landmark} tone="violet" foot="Employee + employer share to deposit" />
        <StatCard label="Waiting for approval or payment" value={awaiting.length} icon={AlertTriangle} tone={awaiting.length ? 'amber' : 'green'} foot={awaiting.map((r) => monthTitle(r.month)).join(', ') || 'All sheets paid'} />
      </div>

      {can('Payroll', 'add') ? (
        <Card title="Generate salary" subtitle="Takes attendance, approved leave, holidays and overtime for the month. You can review and adjust before approving." className="mb-16">
          <div className="row row-wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 260 }}>
              <label className="field-label" htmlFor="pay-month">Salary month</label>
              <Select id="pay-month" options={monthOptions} value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            {existing ? (
              <Button variant="primary" to={`/hr/payroll/${existing.id}`}>Open {existing.number}</Button>
            ) : (
              <Button variant="primary" icon={Play} loading={busy} disabled={!preview?.slips.length} onClick={generate}>Generate {monthTitle(month)} salary</Button>
            )}
          </div>
          {preview && (
            <div className="stack-sm mt-16">
              <div className="card card-body" style={{ background: 'var(--surface-2)' }}>
                <KeyValue
                  cols={4}
                  items={[
                    { label: 'Employees', value: num(preview.totals.headcount) },
                    { label: 'Gross salary', value: inr(preview.totals.gross) },
                    { label: 'Deductions', value: inr(preview.totals.deductions) },
                    { label: 'Net pay', value: <b>{inr(preview.totals.net)}</b> },
                  ]}
                />
              </div>
              {month === curMonth && <Callout tone="amber">{monthTitle(month)} is still running. Days after today will count as not marked (loss of pay). Generate after the month ends.</Callout>}
              {month !== curMonth && preview.totals.unmarked > 0 && (
                <Callout tone="amber">
                  {preview.totals.unmarked} attendance day(s) are not marked and will count as loss of pay. <Link to={`/hr/register?month=${month}`}>Check the register</Link> before generating.
                </Callout>
              )}
            </div>
          )}
          {existing && <Callout tone="blue" style={{ marginTop: 12 }}>Salary for {monthTitle(month)} is already generated ({existing.status.toLowerCase()}).</Callout>}
        </Card>
      ) : (
        <Callout tone="blue" style={{ marginBottom: 16 }}>Only the owner can generate and approve salary. You can view and export salary sheets.</Callout>
      )}

      <DataTable
        title="Salary sheets"
        columns={columns}
        data={runs}
        onRowClick={(r) => navigate(`/hr/payroll/${r.id}`)}
        exportName="salary-sheets"
        searchPlaceholder="Search salary sheets…"
        emptyTitle="No salary generated yet"
        emptyDescription="Generate the first month’s salary above."
      />
    </>
  )
}
