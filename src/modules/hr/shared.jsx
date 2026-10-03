/** Shared bits for the HR & payroll screens (frontend-only demo). */
import { ShieldOff } from 'lucide-react'
import { Button, EmptyState } from '../../components/ui/index.js'
import { DAY_STATUS } from '../../store/hr.js'

export const HR_CRUMB = { label: 'HR & Payroll', to: '/hr' }

/** Small coloured status chip used in the attendance sheet and register. */
export function DayChip({ code, label, title, size }) {
  if (!code) return <span className={`day-chip none ${size || ''}`} title={title || 'Not marked'}>–</span>
  return (
    <span className={`day-chip tone-${DAY_STATUS[code]?.tone || 'gray'} ${size || ''}`} title={title || DAY_STATUS[code]?.label}>
      {label || DAY_STATUS[code]?.short || code}
    </span>
  )
}

export function NoAccess({ what = 'this page', back = '/dashboard' }) {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You don’t have access to this page"
      description={`Viewing ${what} needs HR or payroll permission. Ask the owner to update your role.`}
      action={<Button to={back}>Go back</Button>}
    />
  )
}

/** "1.5 days" / "1 day" */
export const daysText = (n) => `${Number(n) % 1 ? Number(n).toFixed(1) : Number(n)} day${Number(n) === 1 ? '' : 's'}`

/** Approve / reject / cancel a leave application. */
export const decideLeave = (patch, leave, status, userName, remarks = '') =>
  patch('leaveApplications', leave.id, { status, actionBy: userName, actionAt: new Date().toISOString(), actionRemarks: remarks }, { action: status.toLowerCase() })

/** Salary for the month is approved or paid → attendance and holidays for it are locked. */
export const lockedRun = (state, ym) => (state.payrollRuns || []).find((r) => r.month === ym && r.status !== 'Draft')

export const employeeOptions =(state, { activeOnly = true } = {}) =>
  (state.employees || [])
    .filter((e) => !activeOnly || e.status === 'Active')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))
