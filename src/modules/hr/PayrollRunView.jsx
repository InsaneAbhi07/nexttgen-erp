/**
 * Salary sheet — review slips, adjust incentive/advance/TDS, recalculate from attendance,
 * approve (owner), mark paid and print salary slips. Frontend-only demo (mock store).
 */
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Banknote, CheckCircle2, Download, FileSpreadsheet, FileText, IndianRupee, Landmark, Pencil, RefreshCw, RotateCcw, Trash2, Users } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { buildPayroll, computeSlip, monthTitle, runTotals } from '../../store/hr.js'
import { fmtDate, fmtDateTime, inr, num, today } from '../../utils/format.js'
import { exportCsv } from '../../utils/export.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Callout, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import NotFound from '../../pages/NotFound.jsx'
import PayslipModal from './Payslip.jsx'
import { HR_CRUMB, NoAccess } from './shared.jsx'

const ADJ_FIELDS = [
  ['incentive', 'Incentive / bonus', 'Added to earnings'],
  ['advance', 'Salary advance recovery', 'Deducted'],
  ['tds', 'TDS', 'Deducted'],
  ['other', 'Other deductions', 'Canteen, fine, uniform…'],
]

export default function PayrollRunView() {
  const { id } = useParams()
  const { state, get, patch, remove } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [adjusting, setAdjusting] = useState(null)
  const [paying, setPaying] = useState(null)
  const run = get('payrollRuns', id)
  usePageTitle(run ? `Salary ${monthTitle(run.month)}` : 'Salary sheet')

  if (!can('Payroll')) return <NoAccess what="salary" back="/hr" />
  if (!run) return <NotFound />

  const draft = run.status === 'Draft'
  const slipId = params.get('slip')
  const openSlip = run.slips.find((s) => s.employeeId === slipId)
  const setSlip = (empId) => {
    const next = new URLSearchParams(params)
    if (empId) next.set('slip', empId)
    else next.delete('slip')
    setParams(next, { replace: !empId })
  }
  const accounts = state.settings.accounts || []

  const recalc = () => {
    const fresh = buildPayroll(state, run.month, run.slips)
    patch('payrollRuns', run.id, { slips: fresh.slips, totals: fresh.totals }, { action: 'recalculated' })
    toast.success('Salary recalculated', `Using the latest attendance and salary structure: ${inr(fresh.totals.net)} net for ${fresh.totals.headcount} employees.`)
  }

  const saveAdjustment = (e) => {
    e.preventDefault()
    const emp = (state.employees || []).find((x) => x.id === adjusting.employeeId)
    if (!emp) {
      toast.error('Employee not found', 'The employee was removed from the master.')
      return
    }
    const slip = computeSlip(state, emp, run.month, adjusting.adj)
    const slips = run.slips.map((s) => (s.employeeId === emp.id ? slip : s))
    patch('payrollRuns', run.id, { slips, totals: runTotals(slips) }, { silent: true })
    setAdjusting(null)
    toast.success('Salary adjusted', `${emp.name}: net pay ${inr(slip.netPay)}.`)
  }

  const approve = async () => {
    const ok = await confirm({ title: `Approve ${monthTitle(run.month)} salary?`, message: `${inr(run.totals.net)} net pay for ${run.totals.headcount} employees. Attendance for ${monthTitle(run.month)} will be locked.`, confirmLabel: 'Approve salary' })
    if (!ok) return
    patch('payrollRuns', run.id, { status: 'Approved', approvedBy: user?.name, approvedAt: new Date().toISOString() }, {
      action: 'approved',
      notify: { type: 'payment', title: 'Salary approved for payment', message: `${run.number} (${monthTitle(run.month)}) — ${inr(run.totals.net)} to be paid to ${run.totals.headcount} employees.`, link: `/hr/payroll/${run.id}` },
    })
    toast.success('Salary approved', 'Accounts can now release the payment.')
  }

  const revert = async () => {
    const ok = await confirm({ title: 'Move back to draft?', message: 'The sheet can be recalculated and adjusted again. Attendance for the month will be unlocked.', confirmLabel: 'Move to draft' })
    if (ok) {
      patch('payrollRuns', run.id, { status: 'Draft', approvedBy: '', approvedAt: '' }, { action: 'reopened' })
      toast.info('Salary sheet reopened', run.number)
    }
  }

  const del = async () => {
    const ok = await confirm({ title: 'Delete salary sheet?', message: `${run.number} for ${monthTitle(run.month)} will be removed. You can generate it again.`, confirmLabel: 'Delete', tone: 'danger' })
    if (ok) {
      remove('payrollRuns', run.id)
      toast.success('Salary sheet deleted', run.number)
      navigate('/hr/payroll')
    }
  }

  const bankTotal = run.slips.filter((s) => s.paymentMode !== 'Cash').reduce((a, s) => a + s.netPay, 0)
  const cashTotal = run.totals.net - bankTotal

  const markPaid = (e) => {
    e.preventDefault()
    if (!paying.paidOn) return toast.error('Enter the payment date')
    const disbursements = [
      { accountId: paying.bankAccountId, amount: bankTotal },
      { accountId: paying.cashAccountId, amount: cashTotal },
    ].filter((d) => d.amount > 0)
    patch('payrollRuns', run.id, { status: 'Paid', paidOn: paying.paidOn, paymentRef: paying.ref.trim(), disbursements }, { action: 'paid' })
    setPaying(null)
    toast.success('Salary marked as paid', `${inr(run.totals.net)} posted to cash & bank.`)
  }

  const exportSheet = () =>
    exportCsv(`salary-${run.month}`, [
      { header: 'Code', value: (s) => s.code },
      { header: 'Employee', value: (s) => s.name },
      { header: 'Department', value: (s) => s.department },
      { header: 'Paid days', value: (s) => s.paidDays },
      { header: 'LOP days', value: (s) => s.lopDays },
      { header: 'OT hours', value: (s) => s.attendance.otHours },
      ...['basic', 'hra', 'conveyance', 'special', 'wages', 'offday', 'ot', 'incentive'].map((k) => ({ header: k.toUpperCase(), value: (s) => s.earnings.find((x) => x.key === k)?.amount || 0 })),
      { header: 'Gross', value: (s) => s.gross },
      ...['pf', 'esi', 'advance', 'tds', 'other'].map((k) => ({ header: `${k.toUpperCase()} deduction`, value: (s) => s.deductions.find((x) => x.key === k)?.amount || 0 })),
      { header: 'Net pay', value: (s) => s.netPay },
      { header: 'Employer PF', value: (s) => s.employerPf },
      { header: 'Employer ESI', value: (s) => s.employerEsi },
      { header: 'Paid by', value: (s) => s.paymentMode },
    ], run.slips)

  const exportBank = () =>
    exportCsv(`bank-transfer-${run.month}`, [
      { header: 'Beneficiary name', value: (s) => s.name },
      { header: 'Account number', value: (s) => s.bank?.account || '' },
      { header: 'IFSC', value: (s) => s.bank?.ifsc || '' },
      { header: 'Bank', value: (s) => s.bank?.bankName || '' },
      { header: 'Amount', value: (s) => s.netPay },
      { header: 'Narration', value: () => `Salary ${monthTitle(run.month)}` },
    ], run.slips.filter((s) => s.paymentMode !== 'Cash' && s.netPay > 0))

  const ded = (s, key) => s.deductions.find((d) => d.key === key)?.amount || 0
  const columns = [
    { key: 'name', header: 'Employee', accessor: (s) => `${s.name} ${s.code}`, sortValue: (s) => s.name, render: (s) => (<div><div className="cell-primary">{s.name}</div><div className="cell-secondary"><span className="mono">{s.code}</span>, {s.designation}</div></div>) },
    { key: 'paidDays', header: 'Paid days', align: 'right', render: (s) => (<div><div className="num">{num(s.paidDays)} / {s.days}</div>{s.lopDays > 0 && <div className="cell-secondary text-red">{num(s.lopDays)} LOP</div>}{s.attendance.unmarked > 0 && <div className="cell-secondary text-amber">{s.attendance.unmarked} not marked</div>}</div>) },
    { key: 'ot', header: 'OT', align: 'right', accessor: (s) => s.attendance.otHours, render: (s) => (s.attendance.otHours ? `${s.attendance.otHours} h` : <span className="muted">—</span>) },
    { key: 'gross', header: 'Gross', align: 'right', render: (s) => inr(s.gross) },
    { key: 'pf', header: 'PF', align: 'right', accessor: (s) => ded(s, 'pf'), render: (s) => (ded(s, 'pf') ? inr(ded(s, 'pf')) : <span className="muted">—</span>) },
    { key: 'esi', header: 'ESI', align: 'right', accessor: (s) => ded(s, 'esi'), render: (s) => (ded(s, 'esi') ? inr(ded(s, 'esi')) : <span className="muted">—</span>) },
    { key: 'adj', header: 'Adjustments', align: 'right', accessor: (s) => s.adjustments.incentive - s.adjustments.advance - s.adjustments.tds - s.adjustments.other, render: (s) => {
      const a = s.adjustments
      const parts = [a.incentive && <span key="i" className="text-green">+{inr(a.incentive)}</span>, (a.advance + a.tds + a.other) > 0 && <span key="d" className="text-red">−{inr(a.advance + a.tds + a.other)}</span>].filter(Boolean)
      return parts.length ? <div className="stack-sm" style={{ gap: 0 }}>{parts}</div> : <span className="muted">—</span>
    } },
    { key: 'netPay', header: 'Net pay', align: 'right', render: (s) => <b className="num">{inr(s.netPay)}</b> },
    { key: 'paymentMode', header: 'Paid by', render: (s) => (s.paymentMode === 'Cash' ? 'Cash' : <span className="small">{s.bank?.bankName}</span>) },
  ]

  return (
    <>
      <PageHeader
        title={`Salary — ${monthTitle(run.month)}`}
        badge={<StatusBadge status={run.status} className="ml-8" />}
        subtitle={`${run.number}, generated ${fmtDate(run.date)} by ${run.generatedBy || 'System'}${run.approvedBy ? `, approved by ${run.approvedBy}` : ''}${run.paidOn ? `, paid on ${fmtDate(run.paidOn)}` : ''}`}
        breadcrumbs={[HR_CRUMB, { label: 'Salary', to: '/hr/payroll' }, { label: run.number }]}
        actions={
          <>
            <Button icon={FileSpreadsheet} onClick={exportSheet}>Export sheet</Button>
            {can('Payroll', 'export') && bankTotal > 0 && <Button icon={Download} onClick={exportBank}>Bank transfer file</Button>}
            {draft && can('Payroll', 'delete') && <Button variant="ghost" icon={Trash2} onClick={del} style={{ color: 'var(--red)' }}>Delete</Button>}
            {draft && can('Payroll', 'edit') && <Button icon={RefreshCw} onClick={recalc}>Recalculate</Button>}
            {draft && can('Payroll', 'approve') && <Button variant="primary" icon={CheckCircle2} onClick={approve}>Approve salary</Button>}
            {run.status === 'Approved' && can('Payroll', 'approve') && <Button icon={RotateCcw} onClick={revert}>Move to draft</Button>}
            {run.status === 'Approved' && (can('Payroll', 'edit') || can('Payroll', 'approve')) && (
              <Button variant="primary" icon={Banknote} onClick={() => setPaying({ paidOn: today(), bankAccountId: accounts.find((a) => a.type === 'Bank')?.id || '', cashAccountId: accounts.find((a) => a.type === 'Cash')?.id || '', ref: '' })}>
                Mark as paid
              </Button>
            )}
          </>
        }
      />

      {draft && (
        <Callout tone={run.totals.unmarked ? 'amber' : 'blue'} style={{ marginBottom: 16 }}>
          {run.totals.unmarked
            ? <><b>{run.totals.unmarked} attendance day(s)</b> are not marked and count as loss of pay. Mark them in the attendance register, then recalculate.</>
            : 'Draft — review the slips, add incentive or advance recovery where needed, then approve. Approved salary locks attendance for the month.'}
        </Callout>
      )}
      {run.status === 'Approved' && <Callout tone="blue" style={{ marginBottom: 16 }}>Approved by {run.approvedBy} on {fmtDateTime(run.approvedAt)}. Waiting for payment: {inr(bankTotal)} by bank, {inr(cashTotal)} in cash.</Callout>}
      {run.status === 'Paid' && (
        <Callout tone="green" style={{ marginBottom: 16 }}>
          Paid on {fmtDate(run.paidOn)}{run.paymentRef ? ` (${run.paymentRef})` : ''}: {(run.disbursements || []).map((d) => `${inr(d.amount)} from ${accounts.find((a) => a.id === d.accountId)?.name || d.accountId}`).join(', ')}.
        </Callout>
      )}

      <div className="grid-4 mb-16">
        <StatCard label="Employees" value={num(run.totals.headcount)} icon={Users} tone="blue" foot={`${run.slips.filter((s) => s.lopDays > 0).length} with loss of pay`} />
        <StatCard label="Gross salary" value={inr(run.totals.gross)} icon={IndianRupee} tone="teal" foot={`Overtime ${inr(run.slips.reduce((a, s) => a + (s.earnings.find((x) => x.key === 'ot')?.amount || 0), 0))}`} />
        <StatCard label="Net pay" value={inr(run.totals.net)} icon={Banknote} tone="green" foot={`Deductions ${inr(run.totals.deductions)}`} />
        <StatCard label="Employer PF + ESI" value={inr(run.totals.employer)} icon={Landmark} tone="violet" foot={`Total cost ${inr(run.totals.gross + run.totals.employer)}`} />
      </div>

      <DataTable
        title="Salary slips"
        subtitle="Click an employee to open the salary slip"
        columns={columns}
        data={run.slips}
        rowKey="employeeId"
        pageSize={25}
        onRowClick={(s) => setSlip(s.employeeId)}
        rowActions={(s) => [
          { label: 'Salary slip', icon: FileText, onClick: () => setSlip(s.employeeId) },
          draft && can('Payroll', 'edit') && { label: 'Adjust', icon: Pencil, onClick: () => setAdjusting({ employeeId: s.employeeId, name: s.name, adj: { ...s.adjustments } }) },
        ].filter(Boolean)}
        exportName={`salary-${run.month}`}
        searchPlaceholder="Search employee…"
        initialSort={{ key: 'name', dir: 'asc' }}
        footer={
          <tr>
            <td className="strong">Total</td>
            <td />
            <td />
            <td className="align-right strong num">{inr(run.totals.gross)}</td>
            <td className="align-right num">{inr(run.slips.reduce((a, s) => a + ded(s, 'pf'), 0))}</td>
            <td className="align-right num">{inr(run.slips.reduce((a, s) => a + ded(s, 'esi'), 0))}</td>
            <td />
            <td className="align-right strong num">{inr(run.totals.net)}</td>
            <td />
            <td />
          </tr>
        }
      />

      <PayslipModal run={run} slip={openSlip} onClose={() => setSlip('')} />

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        size="sm"
        title="Adjust salary"
        subtitle={adjusting?.name}
        footer={
          <>
            <Button onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button variant="primary" type="submit" form="adj-form">Apply</Button>
          </>
        }
      >
        {adjusting && (
          <form id="adj-form" onSubmit={saveAdjustment} className="stack-sm">
            {ADJ_FIELDS.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint} htmlFor={`adj-${key}`}>
                <Input id={`adj-${key}`} type="number" min={0} prefix="₹" value={adjusting.adj[key] || ''} onChange={(e) => setAdjusting((a) => ({ ...a, adj: { ...a.adj, [key]: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) } }))} />
              </Field>
            ))}
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        size="sm"
        title="Mark salary as paid"
        subtitle={`${run.number}, ${inr(run.totals.net)}`}
        footer={
          <>
            <Button onClick={() => setPaying(null)}>Cancel</Button>
            <Button variant="primary" type="submit" form="pay-form" icon={Banknote}>Mark as paid</Button>
          </>
        }
      >
        {paying && (
          <form id="pay-form" onSubmit={markPaid} className="stack-sm">
            <Field label="Payment date" required htmlFor="pay-date">
              <Input id="pay-date" type="date" max={today()} value={paying.paidOn} onChange={(e) => setPaying((p) => ({ ...p, paidOn: e.target.value }))} />
            </Field>
            {bankTotal > 0 && (
              <Field label={`Bank transfer — ${inr(bankTotal)}`} htmlFor="pay-bank">
                <Select id="pay-bank" options={accounts.filter((a) => a.type === 'Bank').map((a) => ({ value: a.id, label: a.name }))} value={paying.bankAccountId} onChange={(e) => setPaying((p) => ({ ...p, bankAccountId: e.target.value }))} />
              </Field>
            )}
            {cashTotal > 0 && (
              <Field label={`Cash — ${inr(cashTotal)}`} htmlFor="pay-cash">
                <Select id="pay-cash" options={accounts.filter((a) => a.type === 'Cash').map((a) => ({ value: a.id, label: a.name }))} value={paying.cashAccountId} onChange={(e) => setPaying((p) => ({ ...p, cashAccountId: e.target.value }))} />
              </Field>
            )}
            <Field label="Reference" hint="NEFT batch, cheque number…" htmlFor="pay-ref">
              <Input id="pay-ref" value={paying.ref} onChange={(e) => setPaying((p) => ({ ...p, ref: e.target.value }))} />
            </Field>
          </form>
        )}
      </Modal>
    </>
  )
}
