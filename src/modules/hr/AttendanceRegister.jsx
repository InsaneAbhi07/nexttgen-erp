/** Monthly attendance register — employees × days grid with totals. Frontend-only demo. */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { DAY_STATUS, dayStatus, hrIndex, monthDates, monthSummary, monthTitle, shiftMonth, weekday } from '../../store/hr.js'
import { DEPARTMENTS } from '../../data/constants.js'
import { today } from '../../utils/format.js'
import { exportCsv } from '../../utils/export.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, Input, PageHeader, SearchBar, Select } from '../../components/ui/index.js'
import { DayChip, employeeOptions, HR_CRUMB, NoAccess } from './shared.jsx'

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function AttendanceRegister() {
  usePageTitle('Attendance register')
  const { state } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const t = today()
  const month = params.get('month') || t.slice(0, 7)
  const employeeId = params.get('employee') || ''
  const [department, setDepartment] = useState('')
  const [q, setQ] = useState('')

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const dates = useMemo(() => monthDates(month), [month])
  const monthEnd = dates[dates.length - 1]
  const types = new Map((state.leaveTypes || []).map((lt) => [lt.id, lt]))

  const rows = useMemo(() => {
    const idx = hrIndex(state)
    return (state.employees || [])
      .filter((e) => (!e.joiningDate || e.joiningDate <= monthEnd) && (!e.exitDate || e.exitDate >= `${month}-01`))
      .filter((e) => e.status === 'Active' || e.exitDate)
      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name))
      .map((emp) => ({ emp, days: dates.map((d) => (d > t ? null : dayStatus(idx, emp, d))), sum: monthSummary(state, emp, month, t) }))
  }, [state, month, monthEnd, dates, t])

  const visible = rows.filter(({ emp }) => (!employeeId || emp.id === employeeId) && (!department || emp.department === department) && (!q.trim() || `${emp.name} ${emp.code}`.toLowerCase().includes(q.trim().toLowerCase())))

  const cellLabel = (st) => {
    if (!st || !st.employed) return null
    if (st.code === 'L') return types.get(st.leaveTypeId)?.code || 'L'
    return DAY_STATUS[st.code]?.short
  }

  const exportRegister = () =>
    exportCsv(`attendance-register-${month}`, [
      { header: 'Code', value: (r) => r.emp.code },
      { header: 'Employee', value: (r) => r.emp.name },
      { header: 'Department', value: (r) => r.emp.department },
      ...dates.map((d, i) => ({ header: d.slice(8), value: (r) => cellLabel(r.days[i]) || '' })),
      { header: 'Present', value: (r) => r.sum.present },
      { header: 'Half days', value: (r) => r.sum.halfDay },
      { header: 'Leave', value: (r) => r.sum.leavePaid + r.sum.leaveUnpaid },
      { header: 'Absent', value: (r) => r.sum.absent },
      { header: 'Late', value: (r) => r.sum.late },
      { header: 'OT hours', value: (r) => r.sum.otHours },
      { header: 'Paid days', value: (r) => r.sum.paidDays },
    ], visible)

  if (!can('HR')) return <NoAccess what="the attendance register" />

  return (
    <>
      <PageHeader
        title="Attendance register"
        subtitle={`${monthTitle(month)}${month === t.slice(0, 7) ? ', up to today' : ''}. Click a day to open that day’s sheet.`}
        breadcrumbs={[HR_CRUMB, { label: 'Attendance register' }]}
        actions={<Button icon={Download} onClick={exportRegister}>Export</Button>}
      />

      <Card flush>
        <div className="att-toolbar" style={{ padding: '12px 16px', marginBottom: 0 }}>
          <div className="att-date">
            <Button iconOnly icon={ChevronLeft} onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Previous month" />
            <Input type="month" value={month} max={t.slice(0, 7)} onChange={(e) => e.target.value && setParam('month', e.target.value)} style={{ width: 160 }} />
            <Button iconOnly icon={ChevronRight} disabled={month >= t.slice(0, 7)} onClick={() => setParam('month', shiftMonth(month, 1))} aria-label="Next month" />
          </div>
          <Select size="sm" options={employeeOptions(state, { activeOnly: false })} placeholder="All employees" value={employeeId} onChange={(e) => setParam('employee', e.target.value)} style={{ width: 210 }} />
          <Select size="sm" options={DEPARTMENTS} placeholder="All departments" value={department} onChange={(e) => setDepartment(e.target.value)} style={{ width: 170 }} />
          <div style={{ width: 200 }}><SearchBar value={q} onChange={setQ} placeholder="Search employee…" /></div>
          <div className="reg-legend" style={{ marginLeft: 'auto' }}>
            {Object.keys(DAY_STATUS).map((c) => (
              <span key={c}><DayChip code={c} size="sm" /> {DAY_STATUS[c].label}</span>
            ))}
          </div>
        </div>
        <div className="reg-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th className="reg-emp">Employee</th>
                {dates.map((d) => (
                  <th key={d} className={weekday(d) === 0 ? 'off' : ''}>
                    {Number(d.slice(8))}
                    <span className="wd">{WD[weekday(d)]}</span>
                  </th>
                ))}
                <th className="reg-total" title="Present">P</th>
                <th className="reg-total" title="Half days">HD</th>
                <th className="reg-total" title="Leave">L</th>
                <th className="reg-total" title="Absent">A</th>
                <th className="reg-total" title="Overtime hours">OT</th>
                <th className="reg-total" title="Paid days">Paid</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ emp, days, sum }) => (
                <tr key={emp.id}>
                  <td className="reg-emp">
                    <div className="cell-primary">{emp.name}</div>
                    <div className="cell-secondary">{emp.code}, {emp.department}</div>
                  </td>
                  {days.map((st, i) => {
                    const d = dates[i]
                    const label = cellLabel(st)
                    const title = st?.employed ? `${d}: ${st.code ? DAY_STATUS[st.code].label : 'Not marked'}${st.entry?.in ? `, ${st.entry.in}–${st.entry.out || '…'}` : ''}${st.entry?.ot ? `, OT ${st.entry.ot} h` : ''}${st.holiday ? `, ${st.holiday.name}` : ''}` : d
                    return (
                      <td key={d} className={`reg-day ${d === t ? 'today' : ''}`} onClick={() => d <= t && navigate(`/hr/attendance?date=${d}`)}>
                        {st === null ? '' : !st.employed ? <span className="muted">·</span> : <DayChip size="sm" code={st.code} label={label} title={title} />}
                      </td>
                    )
                  })}
                  <td className="reg-total">{sum.present}</td>
                  <td className="reg-total">{sum.halfDay || ''}</td>
                  <td className="reg-total">{sum.leavePaid + sum.leaveUnpaid || ''}</td>
                  <td className={`reg-total ${sum.absent ? 'text-red' : ''}`}>{sum.absent || ''}</td>
                  <td className="reg-total">{sum.otHours || ''}</td>
                  <td className="reg-total">{sum.paidDays}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr><td className="muted" colSpan={dates.length + 7} style={{ padding: 24 }}>No employees for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
