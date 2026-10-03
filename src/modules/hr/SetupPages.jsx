/** Leave types and holiday list — HR setup masters. Frontend-only demo (mock store). */
import CrudPage from '../../components/common/CrudPage.jsx'
import { Badge, StatusBadge } from '../../components/ui/index.js'
import { HOLIDAY_TYPES, WEEKDAYS } from '../../data/constants.js'
import { weekday } from '../../store/hr.js'
import { daysBetween, fmtDate, num, today } from '../../utils/format.js'
import { useAuth } from '../../store/AuthContext.jsx'
import { HR_CRUMB, NoAccess } from './shared.jsx'

const STATUS_FIELD = { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true }

export function LeaveTypesPage() {
  const { can } = useAuth()
  if (!can('HR')) return <NoAccess what="leave types" />
  return (
    <CrudPage
      collection="leaveTypes"
      singular="Leave type"
      title="Leave Types"
      subtitle="Paid and unpaid leave with yearly quota, carry forward and half-day rules used for balances and salary."
      breadcrumbs={[HR_CRUMB, { label: 'Leave Types' }]}
      permissionModule="HR"
      fields={[
        { name: 'name', label: 'Leave name', required: true, placeholder: 'e.g. Casual Leave' },
        { name: 'code', label: 'Short code', required: true, uppercase: true, maxLength: 5, placeholder: 'CL' },
        { name: 'paid', label: 'Paid leave', type: 'switch', checkboxLabel: 'Salary is not deducted for this leave' },
        { name: 'annualQuota', label: 'Days per year', type: 'number', hint: '0 means no limit' },
        { name: 'allowHalfDay', label: 'Half day', type: 'switch', checkboxLabel: 'Can be taken as half day' },
        { name: 'maxConsecutive', label: 'Max days at a time', type: 'number', hint: '0 means no limit' },
        { name: 'carryForward', label: 'Carry forward', type: 'switch', checkboxLabel: 'Unused days move to next year' },
        { name: 'maxCarryForward', label: 'Max carry forward days', type: 'number', visible: (v) => Boolean(v.carryForward) },
        { name: 'encashable', label: 'Encashable', type: 'switch', checkboxLabel: 'Unused days can be paid out' },
        { name: 'noticeDays', label: 'Apply in advance (days)', type: 'number' },
        { name: 'gender', label: 'Applicable to', type: 'select', required: true, options: ['All', 'Female', 'Male'] },
        STATUS_FIELD,
        { name: 'description', label: 'Rules / description', type: 'textarea', span: 'full', rows: 2 },
      ]}
      defaults={{ paid: true, annualQuota: 12, allowHalfDay: true, maxConsecutive: 0, carryForward: false, maxCarryForward: 0, encashable: false, noticeDays: 1, gender: 'All' }}
      columns={[
        { key: 'name', header: 'Leave type', render: (r) => (<div><div className="cell-primary">{r.name}</div><div className="cell-secondary mono">{r.code}</div></div>) },
        { key: 'paid', header: 'Pay', accessor: (r) => (r.paid ? 'Paid' : 'Unpaid'), render: (r) => <Badge tone={r.paid ? 'green' : 'amber'}>{r.paid ? 'Paid' : 'Unpaid'}</Badge> },
        { key: 'annualQuota', header: 'Days / year', align: 'right', render: (r) => (Number(r.annualQuota) ? num(r.annualQuota) : 'No limit') },
        { key: 'allowHalfDay', header: 'Half day', render: (r) => (r.allowHalfDay ? 'Yes' : 'No') },
        { key: 'carryForward', header: 'Carry forward', render: (r) => (r.carryForward ? `Up to ${num(r.maxCarryForward)} days` : 'No') },
        { key: 'gender', header: 'For' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      exportName="leave-types"
      validate={(v, s) => {
        const e = {}
        const code = (v.code || '').trim().toUpperCase()
        if (code && s.leaveTypes.some((t) => t.code.toUpperCase() === code && t.id !== v.id)) e.code = `Code ${code} is already used`
        if (Number(v.annualQuota) < 0) e.annualQuota = 'Can’t be negative'
        return e
      }}
      beforeSave={(v) => ({
        ...v, name: v.name.trim(), code: v.code.trim().toUpperCase(), paid: Boolean(v.paid), allowHalfDay: Boolean(v.allowHalfDay),
        carryForward: Boolean(v.carryForward), encashable: Boolean(v.encashable), annualQuota: Number(v.annualQuota) || 0,
        maxConsecutive: Number(v.maxConsecutive) || 0, maxCarryForward: v.carryForward ? Number(v.maxCarryForward) || 0 : 0, noticeDays: Number(v.noticeDays) || 0,
      })}
      deleteGuard={(r, s) =>
        s.leaveApplications.some((l) => l.leaveTypeId === r.id) || s.attendance.some((a) => Object.values(a.entries).some((x) => x.leaveTypeId === r.id))
          ? 'This leave type is used in leave applications or attendance. Mark it inactive instead.'
          : null
      }
    />
  )
}

export function HolidaysPage() {
  const t = today()
  const { can } = useAuth()
  if (!can('HR')) return <NoAccess what="the holiday list" />
  return (
    <CrudPage
      collection="holidays"
      singular="Holiday"
      title="Holidays"
      subtitle="Paid holidays. They are skipped when counting leave days and paid in salary."
      breadcrumbs={[HR_CRUMB, { label: 'Holidays' }]}
      permissionModule="HR"
      formCols={1}
      fields={[
        { name: 'name', label: 'Holiday', required: true, placeholder: 'e.g. Diwali' },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'type', label: 'Type', type: 'select', required: true, options: HOLIDAY_TYPES },
        { name: 'description', label: 'Notes', type: 'textarea', rows: 2 },
        STATUS_FIELD,
      ]}
      defaults={{ type: 'Festival', date: t }}
      columns={[
        { key: 'date', header: 'Date', render: (r) => (<div><div className="cell-primary nowrap">{fmtDate(r.date)}</div><div className="cell-secondary">{WEEKDAYS[weekday(r.date)]}</div></div>) },
        { key: 'name', header: 'Holiday', render: (r) => <span className="cell-primary">{r.name}</span> },
        { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'National' ? 'blue' : r.type === 'Festival' ? 'brass' : 'gray'}>{r.type}</Badge> },
        { key: 'when', header: 'When', accessor: (r) => daysBetween(t, r.date), render: (r) => { const d = daysBetween(t, r.date); return d < 0 ? <span className="muted">Passed</span> : d === 0 ? 'Today' : `In ${d} days` } },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      filters={[{ key: 'year', label: 'Years', options: (s) => [...new Set(s.holidays.map((h) => h.date.slice(0, 4)))].sort(), match: (r, v) => r.date.startsWith(v) }]}
      exportName="holidays"
      initialSort={{ key: 'date', dir: 'asc' }}
      validate={(v, s) => (s.holidays.some((h) => h.date === v.date && h.id !== v.id) ? { date: 'A holiday already exists on this date' } : {})}
      deleteGuard={(r, s) => {
        const run = s.payrollRuns.find((p) => p.month === r.date.slice(0, 7) && p.status !== 'Draft')
        return run ? `Salary for this month (${run.number}) is already approved.` : null
      }}
    />
  )
}
