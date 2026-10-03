/**
 * Employee master — personal details, job, shift and the salary structure the payroll
 * engine uses. Salary fields are visible only to roles with Payroll permission.
 * Frontend-only demo (mock store).
 */
import { useMemo } from 'react'
import { CalendarCheck, CalendarDays, CalendarPlus, FileText, IndianRupee, UserCheck, UserPlus, Users } from 'lucide-react'
import CrudPage from '../../components/common/CrudPage.jsx'
import { Badge, Button, DocNo, KeyValue, StatusBadge } from '../../components/ui/index.js'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { nextCode } from '../../store/numbering.js'
import { dayStatus, hrIndex, leaveBalances, monthlyGross, monthSummary, monthTitle } from '../../store/hr.js'
import { DEPARTMENTS, DESIGNATIONS, EMPLOYMENT_TYPES, GENDERS, SALARY_TYPES, SHIFTS, WEEKDAYS } from '../../data/constants.js'
import { addDays, fmtDate, inr, num, today } from '../../utils/format.js'
import { daysText, DayChip, NoAccess } from '../hr/shared.jsx'
import { formatMobile, mastersCrumbs, MiniTable, SectionTitle, validEmail, validMobile } from './shared.jsx'

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const personalFields = [
  { name: 'code', label: 'Employee code', placeholder: 'Auto-generated', hint: 'Leave blank to generate', uppercase: true, section: 'Personal details' },
  { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Sunil Kumar' },
  { name: 'fatherName', label: 'Father’s / spouse name' },
  { name: 'gender', label: 'Gender', type: 'select', required: true, options: GENDERS },
  { name: 'dob', label: 'Date of birth', type: 'date' },
  { name: 'mobile', label: 'Mobile', type: 'tel', required: true, placeholder: '+91 98110 23456' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 },
]

const jobFields = [
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS, section: 'Job and shift' },
  { name: 'designation', label: 'Designation', type: 'select', required: true, options: DESIGNATIONS },
  { name: 'employmentType', label: 'Employment type', type: 'select', required: true, options: EMPLOYMENT_TYPES },
  { name: 'joiningDate', label: 'Date of joining', type: 'date', required: true },
  { name: 'shift', label: 'Shift', type: 'select', required: true, options: SHIFTS.map((s) => ({ value: s.name, label: `${s.name} (${s.start}–${s.end})` })) },
  { name: 'weeklyOff', label: 'Weekly off', type: 'select', required: true, options: WEEKDAYS },
  { name: 'exitDate', label: 'Date of leaving', type: 'date', hint: 'Only if the employee has left' },
  { name: 'userId', label: 'ERP login', type: 'select', placeholder: 'No ERP login', options: (s) => s.users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })) },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true },
]

const isMonthly = (v) => v.salaryType !== 'Daily'
const isBank = (v) => v.paymentMode !== 'Cash'

const salaryFields = [
  { name: 'salaryType', label: 'Salary type', type: 'select', required: true, options: SALARY_TYPES, section: 'Salary structure', hint: 'Monthly salary is pro-rated on paid days; daily wage is paid per day worked' },
  { name: 'dailyRate', label: 'Daily wage', type: 'number', prefix: '₹', visible: (v) => !isMonthly(v) },
  { name: 'basic', label: 'Basic (per month)', type: 'number', prefix: '₹', visible: isMonthly },
  { name: 'hra', label: 'House rent allowance', type: 'number', prefix: '₹', visible: isMonthly },
  { name: 'conveyance', label: 'Conveyance', type: 'number', prefix: '₹', visible: isMonthly },
  { name: 'specialAllowance', label: 'Special allowance', type: 'number', prefix: '₹', visible: isMonthly },
  { name: 'pfApplicable', label: 'Provident fund', type: 'switch', checkboxLabel: 'Deduct PF (12% of basic, up to ₹15,000)' },
  { name: 'esiApplicable', label: 'ESI', type: 'switch', checkboxLabel: 'Deduct ESI (0.75%) when gross is ₹21,000 or less' },
  { name: 'uan', label: 'UAN', maxLength: 12, placeholder: '12-digit UAN', visible: (v) => Boolean(v.pfApplicable) },
  { name: 'esicNo', label: 'ESIC number', maxLength: 17, visible: (v) => Boolean(v.esiApplicable) },
  { name: 'pan', label: 'PAN', uppercase: true, maxLength: 10, placeholder: 'ABCPK1234D' },
  { name: 'paymentMode', label: 'Salary paid by', type: 'select', required: true, options: ['Bank', 'Cash'], section: 'Bank details' },
  { name: 'bankName', label: 'Bank name', visible: isBank },
  { name: 'bankAccount', label: 'Account number', visible: isBank, maxLength: 18 },
  { name: 'ifsc', label: 'IFSC', uppercase: true, maxLength: 11, placeholder: 'HDFC0001234', visible: isBank },
]

const usage = (state, id) => {
  const att = (state.attendance || []).find((a) => a.entries?.[id])
  if (att) return `Attendance is recorded for this employee (for example on ${fmtDate(att.date)}). Mark the employee inactive and set the leaving date instead.`
  const run = (state.payrollRuns || []).find((r) => r.slips.some((s) => s.employeeId === id))
  if (run) return `The employee is on salary sheet ${run.number}. Mark the employee inactive instead.`
  return null
}

export default function EmployeesPage() {
  const { state } = useErp()
  const { can } = useAuth()
  const payroll = can('Payroll')
  const t = today()
  const ym = t.slice(0, 7)

  const month = useMemo(() => {
    const map = {}
    ;(state.employees || []).forEach((e) => (map[e.id] = monthSummary(state, e, ym, t)))
    return map
  }, [state, ym, t])
  const todayStatus = useMemo(() => {
    const idx = hrIndex(state)
    return Object.fromEntries((state.employees || []).map((e) => [e.id, dayStatus(idx, e, t)]))
  }, [state, t])

  if (!can('HR')) return <NoAccess what="employee records" back="/masters/items" />

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      accessor: (r) => `${r.name} ${r.code} ${r.designation}`,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="cell-primary">{r.name}</div>
          <div className="cell-secondary"><span className="mono">{r.code}</span>, {r.designation}</div>
        </div>
      ),
    },
    { key: 'department', header: 'Department' },
    {
      key: 'employmentType',
      header: 'Type',
      render: (r) => <Badge tone={r.employmentType === 'Permanent' ? 'blue' : r.employmentType === 'Daily Wage' ? 'brass' : 'violet'}>{r.employmentType}</Badge>,
    },
    { key: 'shift', header: 'Shift', render: (r) => (<div><div>{r.shift}</div><div className="cell-secondary">Off on {r.weeklyOff}</div></div>) },
    { key: 'joiningDate', header: 'Joined', render: (r) => <span className="nowrap">{fmtDate(r.joiningDate)}</span> },
    {
      key: 'today',
      header: 'Today',
      accessor: (r) => todayStatus[r.id]?.code || 'Not marked',
      render: (r) => (r.status === 'Active' ? <DayChip code={todayStatus[r.id]?.code} /> : <span className="muted">—</span>),
    },
    {
      key: 'month',
      header: 'This month',
      align: 'right',
      accessor: (r) => month[r.id]?.worked || 0,
      render: (r) => {
        const m = month[r.id]
        if (!m || !m.employedDays) return <span className="muted">—</span>
        return (
          <div>
            <div className="num strong">{num(m.worked)} days</div>
            <div className="cell-secondary">{m.absent ? <span className="text-red">{m.absent} absent</span> : 'No absence'}{m.late ? `, ${m.late} late` : ''}</div>
          </div>
        )
      },
    },
    payroll && {
      key: 'salary',
      header: 'Salary',
      align: 'right',
      accessor: (r) => monthlyGross(r),
      render: (r) => (
        <div>
          <div className="num strong">{r.salaryType === 'Daily' ? `${inr(r.dailyRate)}/day` : inr(monthlyGross(r))}</div>
          <div className="cell-secondary">{r.salaryType === 'Daily' ? 'Daily wage' : 'Gross per month'}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ].filter(Boolean)

  return (
    <CrudPage
      collection="employees"
      singular="Employee"
      title="Employees"
      subtitle="Staff and workers on the payroll, with shift, weekly off and salary structure used for attendance and salary."
      breadcrumbs={mastersCrumbs('Employees')}
      permissionModule="HR"
      fields={[...personalFields, ...jobFields, ...(payroll ? salaryFields : [])]}
      columns={columns}
      filters={[
        { key: 'department', label: 'Departments', options: (s) => [...new Set((s.employees || []).map((e) => e.department))].sort() },
        { key: 'employmentType', label: 'Types', options: EMPLOYMENT_TYPES },
        { key: 'shift', label: 'Shifts', options: SHIFTS.map((s) => s.name) },
        { key: 'status', label: 'Statuses', options: ['Active', 'Inactive'] },
      ]}
      defaults={{
        gender: 'Male', department: 'Production', designation: 'Machine Operator', employmentType: 'Permanent', joiningDate: t,
        shift: 'General', weeklyOff: 'Sunday', salaryType: 'Monthly', basic: 8000, hra: 3200, conveyance: 1600, specialAllowance: 2200,
        dailyRate: 500, pfApplicable: true, esiApplicable: true, paymentMode: 'Bank',
      }}
      validate={(v, s) => {
        const e = {}
        if (v.mobile && !validMobile(v.mobile)) e.mobile = 'Enter a 10-digit Indian mobile number'
        if (!validEmail(v.email)) e.email = 'Enter a valid email address'
        const code = (v.code || '').trim().toUpperCase()
        if (code && (s.employees || []).some((r) => r.code.toUpperCase() === code && r.id !== v.id)) e.code = `Code ${code} is already in use`
        if (v.exitDate && v.joiningDate && v.exitDate < v.joiningDate) e.exitDate = 'Leaving date can’t be before the joining date'
        if (v.dob && v.dob > addDays(t, -365 * 14)) e.dob = 'Employee must be at least 14 years old'
        if (v.userId && (s.employees || []).some((r) => r.userId === v.userId && r.id !== v.id)) e.userId = 'This login is already linked to another employee'
        if (payroll) {
          if (isMonthly(v) && !(Number(v.basic) > 0)) e.basic = 'Enter the monthly basic salary'
          if (!isMonthly(v) && !(Number(v.dailyRate) > 0)) e.dailyRate = 'Enter the daily wage'
          if (v.pan && !PAN_RE.test(v.pan)) e.pan = 'Enter a valid PAN, e.g. ABCPK1234D'
          if (v.pfApplicable && v.uan && !/^\d{12}$/.test(v.uan)) e.uan = 'UAN must be 12 digits'
          if (isBank(v)) {
            if (!v.bankName) e.bankName = 'Enter bank name'
            if (!/^\d{9,18}$/.test(v.bankAccount || '')) e.bankAccount = 'Enter a 9 to 18 digit account number'
            if (!IFSC_RE.test(v.ifsc || '')) e.ifsc = 'Enter a valid IFSC, e.g. HDFC0001234'
          }
        }
        return e
      }}
      beforeSave={(v, s) => {
        const monthly = isMonthly(v)
        return {
          ...v,
          code: (v.code || '').trim().toUpperCase() || nextCode(s.employees || [], 'EMP'),
          name: v.name.trim(),
          mobile: formatMobile(v.mobile),
          email: (v.email || '').trim().toLowerCase(),
          basic: monthly ? Number(v.basic) || 0 : 0,
          hra: monthly ? Number(v.hra) || 0 : 0,
          conveyance: monthly ? Number(v.conveyance) || 0 : 0,
          specialAllowance: monthly ? Number(v.specialAllowance) || 0 : 0,
          dailyRate: monthly ? 0 : Number(v.dailyRate) || 0,
          pfApplicable: Boolean(v.pfApplicable),
          esiApplicable: Boolean(v.esiApplicable),
          ...(isBank(v) ? {} : { bankName: '', bankAccount: '', ifsc: '' }),
        }
      }}
      exportName="employees"
      searchPlaceholder="Search by name, code or designation…"
      drawerSize="lg"
      initialSort={{ key: 'name', dir: 'asc' }}
      headerActions={<Button icon={CalendarCheck} to="/hr/attendance">Mark attendance</Button>}
      stats={(rows) => {
        const active = rows.filter((r) => r.status === 'Active')
        const present = active.filter((r) => ['P', 'HD'].includes(todayStatus[r.id]?.code)).length
        const newJoiners = active.filter((r) => r.joiningDate >= `${ym}-01` || r.joiningDate >= addDays(t, -30)).length
        return [
          { label: 'Active employees', value: num(active.length), icon: Users, tone: 'blue', foot: `${rows.length - active.length} inactive` },
          { label: 'Present today', value: `${present} / ${active.length}`, icon: UserCheck, tone: 'green', foot: 'Open attendance dashboard', to: '/hr' },
          payroll
            ? { label: 'Fixed salary per month', value: inr(active.reduce((a, r) => a + monthlyGross(r), 0)), icon: IndianRupee, tone: 'violet', foot: 'Gross before attendance', to: '/hr/payroll' }
            : { label: 'Departments', value: num(new Set(active.map((r) => r.department)).size), icon: Users, tone: 'violet', foot: 'With active staff' },
          { label: 'New joiners', value: num(newJoiners), icon: UserPlus, tone: 'teal', foot: 'Last 30 days' },
        ]
      }}
      viewFields={(r, s) => [
        { label: 'Department', value: r.department },
        { label: 'Designation', value: r.designation },
        { label: 'Employment type', value: r.employmentType },
        { label: 'Date of joining', value: fmtDate(r.joiningDate) },
        { label: 'Shift', value: `${r.shift}, off on ${r.weeklyOff}` },
        { label: 'ERP login', value: s.users.find((u) => u.id === r.userId)?.email || 'None' },
        { label: 'Mobile', value: r.mobile },
        { label: 'Email', value: r.email },
        { label: 'Gender', value: r.gender },
        { label: 'Date of birth', value: r.dob ? fmtDate(r.dob) : '' },
        { label: 'Father’s / spouse name', value: r.fatherName },
        r.exitDate && { label: 'Date of leaving', value: fmtDate(r.exitDate) },
        { label: 'Address', value: r.address, span: 2 },
      ]}
      viewExtra={(r, s) => <EmployeeExtra emp={r} state={s} payroll={payroll} summary={month[r.id]} />}
      deleteGuard={(r, s) => usage(s, r.id)}
    />
  )
}

function EmployeeExtra({ emp, state, payroll, summary }) {
  const t = today()
  const balances = leaveBalances(state, emp, Number(t.slice(0, 4)))
  const slips = (state.payrollRuns || [])
    .map((run) => ({ run, slip: run.slips.find((x) => x.employeeId === emp.id) }))
    .filter((x) => x.slip)
    .sort((a, b) => (a.run.month < b.run.month ? 1 : -1))
    .slice(0, 4)
  return (
    <>
      {summary && (
        <div>
          <SectionTitle>{monthTitle(t.slice(0, 7))} so far</SectionTitle>
          <div className="card card-body" style={{ background: 'var(--surface-2)' }}>
            <KeyValue
              cols={4}
              items={[
                { label: 'Present', value: num(summary.present) },
                { label: 'Half days', value: num(summary.halfDay) },
                { label: 'Leave', value: num(summary.leavePaid + summary.leaveUnpaid) },
                { label: 'Absent', value: <span className={summary.absent ? 'text-red' : ''}>{num(summary.absent)}</span> },
                { label: 'Late arrivals', value: num(summary.late) },
                { label: 'Overtime', value: `${num(summary.otHours)} h` },
                { label: 'Not marked', value: <span className={summary.unmarked ? 'text-amber' : ''}>{num(summary.unmarked)}</span> },
                { label: 'Paid days', value: num(summary.paidDays) },
              ]}
            />
          </div>
        </div>
      )}
      <div className="row row-wrap">
        <Button size="sm" icon={CalendarDays} to={`/hr/register?employee=${emp.id}`}>Attendance register</Button>
        <Button size="sm" icon={CalendarPlus} to={`/hr/leaves?new=1&employee=${emp.id}`}>Apply leave</Button>
      </div>
      {payroll && (
        <div className="card card-body" style={{ background: 'var(--surface-2)' }}>
          <KeyValue
            items={
              emp.salaryType === 'Daily'
                ? [
                    { label: 'Daily wage', value: inr(emp.dailyRate) },
                    { label: 'PF / ESI', value: `${emp.pfApplicable ? 'PF' : 'No PF'}, ${emp.esiApplicable ? 'ESI' : 'no ESI'}` },
                    { label: 'Paid by', value: emp.paymentMode === 'Cash' ? 'Cash' : `${emp.bankName}, ${emp.bankAccount}` },
                  ]
                : [
                    { label: 'Basic', value: inr(emp.basic) },
                    { label: 'HRA', value: inr(emp.hra) },
                    { label: 'Conveyance', value: inr(emp.conveyance) },
                    { label: 'Special allowance', value: inr(emp.specialAllowance) },
                    { label: 'Gross per month', value: <b>{inr(monthlyGross(emp))}</b> },
                    { label: 'PF / ESI', value: `${emp.pfApplicable ? 'PF' : 'No PF'}, ${emp.esiApplicable ? 'ESI' : 'no ESI'}` },
                    { label: 'Paid by', value: emp.paymentMode === 'Cash' ? 'Cash' : `${emp.bankName}, ${emp.bankAccount}`, span: 2 },
                    { label: 'IFSC', value: emp.ifsc },
                  ]
            }
          />
        </div>
      )}
      <div>
        <SectionTitle>Leave balance {t.slice(0, 4)}</SectionTitle>
        <MiniTable
          rows={balances.map((b) => ({ ...b, id: b.type.id }))}
          empty="No leave types set up yet."
          columns={[
            { header: 'Leave type', render: (b) => (<span>{b.type.name} <span className="muted mono small">{b.type.code}</span></span>) },
            { header: 'Quota', align: 'right', render: (b) => (b.quota ? num(b.quota) : 'No limit') },
            { header: 'Used', align: 'right', render: (b) => num(b.used) },
            { header: 'Pending', align: 'right', render: (b) => (b.pending ? <span className="text-amber">{num(b.pending)}</span> : '—') },
            { header: 'Balance', align: 'right', render: (b) => (b.balance === null ? '—' : <span className={b.balance < 0 ? 'text-red strong' : 'strong'}>{daysText(b.balance)}</span>) },
          ]}
        />
      </div>
      {payroll && (
        <div>
          <SectionTitle>Recent salary</SectionTitle>
          <MiniTable
            rows={slips.map((x) => ({ ...x, id: x.run.id }))}
            empty="No salary generated for this employee yet."
            columns={[
              { header: 'Month', render: (x) => <DocNo to={`/hr/payroll/${x.run.id}`}>{monthTitle(x.run.month)}</DocNo> },
              { header: 'Paid days', align: 'right', render: (x) => num(x.slip.paidDays) },
              { header: 'Gross', align: 'right', render: (x) => inr(x.slip.gross) },
              { header: 'Net pay', align: 'right', render: (x) => <b>{inr(x.slip.netPay)}</b> },
              { header: 'Status', render: (x) => <StatusBadge status={x.run.status} /> },
              { header: '', align: 'right', render: (x) => <Button size="sm" variant="ghost" icon={FileText} to={`/hr/payroll/${x.run.id}?slip=${emp.id}`}>Slip</Button> },
            ]}
          />
        </div>
      )}
    </>
  )
}
