/** Attendance & HR dashboard — today's attendance, trend, leave approvals and payroll status. Frontend-only demo. */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlarmClock, CalendarCheck, CalendarDays, Check, IndianRupee, Plane, UserCheck, UserX, Users, X } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { dayStatus, eachDate, hrIndex, isEmployedOn, isLate, monthlyGross, monthTitle, shiftMonth } from '../../store/hr.js'
import { addDays, fmtDate, inr, num, pct, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { CHART, axisProps } from '../../config/theme.js'
import { Badge, Button, Callout, Card, DocNo, PageHeader, StatCard, StatusBadge, useToast } from '../../components/ui/index.js'
import ChartTooltip from '../../components/common/ChartTooltip.jsx'
import { daysText, DayChip, decideLeave, HR_CRUMB, NoAccess } from './shared.jsx'

export default function HrDashboard() {
  usePageTitle('Attendance & HR')
  const { state, patch } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const t = today()

  const data = useMemo(() => {
    const idx = hrIndex(state)
    const active = (state.employees || []).filter((e) => e.status === 'Active')
    const rows = active.filter((e) => isEmployedOn(e, t)).map((emp) => ({ emp, st: dayStatus(idx, emp, t) }))
    const working = rows.filter((r) => !r.st.off || ['P', 'HD'].includes(r.st.code))
    const count = (code) => working.filter((r) => r.st.code === code).length
    const late = working.filter((r) => r.st.entry && ['P', 'HD'].includes(r.st.code) && isLate(r.emp, r.st.entry))

    const depts = {}
    working.forEach(({ emp, st }) => {
      const d = (depts[emp.department] ||= { name: emp.department, total: 0, P: 0, HD: 0, L: 0, A: 0, none: 0 })
      d.total += 1
      d[st.code || 'none'] += 1
    })

    const trend = []
    eachDate(addDays(t, -29), t, (d) => {
      let present = 0
      let leave = 0
      let absent = 0
      let expected = 0
      active.forEach((emp) => {
        if (!isEmployedOn(emp, d)) return
        const st = dayStatus(idx, emp, d)
        if (st.off && !['P', 'HD'].includes(st.code)) return
        expected += 1
        if (st.code === 'P') present += 1
        else if (st.code === 'HD') present += 0.5
        else if (st.code === 'L') leave += 1
        else if (st.code === 'A') absent += 1
      })
      if (expected >= active.length * 0.3) trend.push({ day: `${d.slice(8)}/${d.slice(5, 7)}`, Present: present, 'On leave': leave, Absent: absent })
    })

    const weekEnd = addDays(t, 6)
    const onLeaveSoon = (state.leaveApplications || [])
      .filter((l) => l.status === 'Approved' && l.to >= t && l.from <= weekEnd)
      .sort((a, b) => (a.from < b.from ? -1 : 1))
    const pending = (state.leaveApplications || []).filter((l) => l.status === 'Pending').sort((a, b) => (a.from < b.from ? -1 : 1))
    const holidays = (state.holidays || []).filter((h) => h.status === 'Active' && h.date >= t).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5)
    return { active, rows, working, late, depts: Object.values(depts).sort((a, b) => b.total - a.total), trend, onLeaveSoon, pending, holidays, present: count('P'), half: count('HD'), leave: count('L'), absent: count('A'), unmarked: count(null) }
  }, [state, t])

  if (!can('HR')) return <NoAccess what="the HR dashboard" />

  const emps = new Map((state.employees || []).map((e) => [e.id, e]))
  const types = new Map((state.leaveTypes || []).map((x) => [x.id, x]))
  const lastMonth = shiftMonth(t.slice(0, 7), -1)
  const runs = [...(state.payrollRuns || [])].sort((a, b) => (a.month < b.month ? 1 : -1))
  const lastRun = runs.find((r) => r.month === lastMonth)
  const latestRun = runs[0]
  const expected = data.working.length
  const attendedPct = expected ? ((data.present + data.half * 0.5) / expected) * 100 : 0

  const act = (leave, status) => {
    decideLeave(patch, leave, status, user?.name)
    toast.success(`Leave ${status.toLowerCase()}`, `${emps.get(leave.employeeId)?.name}, ${daysText(leave.days)} of ${types.get(leave.leaveTypeId)?.name}`)
  }

  return (
    <>
      <PageHeader
        title="Attendance & HR"
        subtitle={`${fmtDate(t)}. Daily attendance, leave approvals and salary for ${data.active.length} active employees.`}
        breadcrumbs={[HR_CRUMB, { label: 'Dashboard' }]}
        actions={
          <>
            <Button icon={CalendarDays} to="/hr/register">Monthly register</Button>
            {can('Payroll', 'add') && <Button icon={IndianRupee} to="/hr/payroll">Generate salary</Button>}
            {can('HR', 'add') && <Button variant="primary" icon={CalendarCheck} to="/hr/attendance">Mark attendance</Button>}
          </>
        }
      />

      {data.unmarked > 0 && (
        <Callout tone="amber" style={{ marginBottom: 16 }}>
          <b>{data.unmarked} employee(s)</b> have not been marked for today yet.{' '}
          <Link to="/hr/attendance">Mark attendance now</Link>
        </Callout>
      )}

      <div className="grid-4 mb-16">
        <StatCard label="Present today" value={`${data.present + data.half} / ${expected}`} icon={UserCheck} tone="green" foot={`${pct(attendedPct, 0)} attendance${data.half ? `, ${data.half} half day` : ''}`} to="/hr/attendance" />
        <StatCard label="Absent" value={data.absent} icon={UserX} tone={data.absent ? 'red' : 'green'} foot={data.unmarked ? `${data.unmarked} not marked yet` : 'All employees marked'} />
        <StatCard label="On leave" value={data.leave} icon={Plane} tone="violet" foot={`${data.pending.length} request(s) waiting`} to="/hr/leaves" />
        <StatCard label="Late arrivals" value={data.late.length} icon={AlarmClock} tone={data.late.length ? 'amber' : 'green'} foot="After shift start + 10 min" />
      </div>

      <div className="grid-2 mb-16">
        <Card title="Attendance trend" subtitle="Working days in the last 30 days (half day counts as 0.5)">
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={data.trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={14} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: 'rgba(15,30,54,0.04)' }} content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Present" stackId="a" fill={CHART.green} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="On leave" stackId="a" fill={CHART.violet} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="Absent" stackId="a" fill={CHART.red} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Today by department" subtitle="Employees scheduled to work today" flush>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="align-right">Staff</th>
                  <th className="align-right">Present</th>
                  <th className="align-right">Leave</th>
                  <th className="align-right">Absent</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {data.depts.map((d) => (
                  <tr key={d.name}>
                    <td className="cell-primary">{d.name}</td>
                    <td className="align-right num">{d.total}</td>
                    <td className="align-right num">{d.P + d.HD}{d.HD ? <span className="muted small"> ({d.HD} HD)</span> : ''}</td>
                    <td className="align-right num">{d.L || '—'}</td>
                    <td className={`align-right num ${d.A ? 'text-red' : ''}`}>{d.A || '—'}</td>
                    <td>
                      <div className="dept-bar" title={`${d.none} not marked`}>
                        <span style={{ width: `${(d.P / d.total) * 100}%`, background: 'var(--green)' }} />
                        <span style={{ width: `${(d.HD / d.total) * 100}%`, background: 'var(--amber)' }} />
                        <span style={{ width: `${(d.L / d.total) * 100}%`, background: 'var(--violet)' }} />
                        <span style={{ width: `${(d.A / d.total) * 100}%`, background: 'var(--red)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.depts.length && (
                  <tr><td colSpan={6} className="muted text-center" style={{ padding: 16 }}>No one is scheduled to work today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid-2 mb-16">
        <Card title="Leave requests awaiting approval" subtitle={`${data.pending.length} pending`} actions={<Button size="sm" variant="ghost" to="/hr/leaves">All leave</Button>}>
          <ul className="hr-list">
            {data.pending.slice(0, 6).map((l) => {
              const emp = emps.get(l.employeeId)
              const lt = types.get(l.leaveTypeId)
              return (
                <li key={l.id}>
                  <div className="grow" style={{ cursor: 'pointer' }} onClick={() => navigate(`/hr/leaves?view=${l.id}`)}>
                    <div className="strong">{emp?.name} <span className="muted small">{emp?.department}</span></div>
                    <div className="muted small">
                      {lt?.code} · {fmtDate(l.from)}{l.to !== l.from ? ` to ${fmtDate(l.to)}` : ''} · {daysText(l.days)}{l.halfDay ? ' (half day)' : ''} · {l.reason}
                    </div>
                  </div>
                  {can('HR', 'approve') && (
                    <div className="row" style={{ gap: 6 }}>
                      <Button size="sm" variant="soft" icon={Check} onClick={() => act(l, 'Approved')}>Approve</Button>
                      <Button size="sm" variant="ghost" icon={X} onClick={() => act(l, 'Rejected')} aria-label="Reject">Reject</Button>
                    </div>
                  )}
                </li>
              )
            })}
            {!data.pending.length && <li className="muted">No leave requests waiting.</li>}
          </ul>
        </Card>

        {can('Payroll') ? (
          <Card title="Salary" subtitle="Generated from attendance; approved by the owner" actions={<Button size="sm" variant="ghost" to="/hr/payroll">All salary sheets</Button>}>
            <div className="stack-sm">
              {!lastRun ? (
                <Callout tone="amber">
                  Salary for <b>{monthTitle(lastMonth)}</b> has not been generated yet.
                  {can('Payroll', 'add') && (
                    <div className="mt-8"><Button size="sm" variant="primary" icon={IndianRupee} to={`/hr/payroll?generate=${lastMonth}`}>Generate {monthTitle(lastMonth)} salary</Button></div>
                  )}
                </Callout>
              ) : (
                <Callout tone={lastRun.status === 'Paid' ? 'green' : 'blue'}>
                  {monthTitle(lastMonth)} salary is <b>{lastRun.status.toLowerCase()}</b>: {inr(lastRun.totals.net)} net for {lastRun.totals.headcount} employees.
                </Callout>
              )}
              {latestRun && (
                <ul className="hr-list">
                  <li>
                    <div className="grow">
                      <DocNo to={`/hr/payroll/${latestRun.id}`}>{latestRun.number}</DocNo> <span className="muted small">{monthTitle(latestRun.month)}</span>
                    </div>
                    <span className="num strong">{inr(latestRun.totals.net)}</span>
                    <StatusBadge status={latestRun.status} />
                  </li>
                  <li>
                    <div className="grow muted">Fixed monthly salary (all active staff)</div>
                    <span className="num strong">{inr(data.active.reduce((a, e) => a + monthlyGross(e), 0))}</span>
                  </li>
                  <li>
                    <div className="grow muted">PF + ESI (employee and employer), last sheet</div>
                    <span className="num strong">{inr(latestRun.totals.pf + latestRun.totals.esi)}</span>
                  </li>
                </ul>
              )}
            </div>
          </Card>
        ) : (
          <Card title="Late arrivals today">
            <LateList late={data.late} />
          </Card>
        )}
      </div>

      <div className="grid-3">
        <Card title="On leave this week">
          <ul className="hr-list">
            {data.onLeaveSoon.slice(0, 6).map((l) => (
              <li key={l.id}>
                <DayChip code="L" label={types.get(l.leaveTypeId)?.code} />
                <div className="grow">
                  <div className="strong">{emps.get(l.employeeId)?.name}</div>
                  <div className="muted small">{fmtDate(l.from)}{l.to !== l.from ? ` to ${fmtDate(l.to)}` : ''}</div>
                </div>
                <span className="small">{daysText(l.days)}</span>
              </li>
            ))}
            {!data.onLeaveSoon.length && <li className="muted">No approved leave this week.</li>}
          </ul>
        </Card>
        {can('Payroll') && (
          <Card title="Late arrivals today">
            <LateList late={data.late} />
          </Card>
        )}
        <Card title="Upcoming holidays" actions={<Button size="sm" variant="ghost" to="/hr/holidays">Holiday list</Button>}>
          <ul className="hr-list">
            {data.holidays.map((h) => (
              <li key={h.id}>
                <span className="hr-date-tile"><b>{h.date.slice(8)}</b><span>{fmtDate(h.date).slice(3, 6)}</span></span>
                <div className="grow">
                  <div className="strong">{h.name}</div>
                  <div className="muted small">{h.type}</div>
                </div>
              </li>
            ))}
            {!data.holidays.length && <li className="muted">No upcoming holidays in the list.</li>}
          </ul>
        </Card>
        {!can('Payroll') && (
          <Card title="Team">
            <div className="row"><Users size={16} /> {num(data.active.length)} active employees</div>
          </Card>
        )}
      </div>
    </>
  )
}

function LateList({ late }) {
  return (
    <ul className="hr-list">
      {late.slice(0, 6).map(({ emp, st }) => (
        <li key={emp.id}>
          <Badge tone="amber">{st.entry.in}</Badge>
          <div className="grow">
            <div className="strong">{emp.name}</div>
            <div className="muted small">{emp.shift} shift, {emp.department}</div>
          </div>
        </li>
      ))}
      {!late.length && <li className="muted">Everyone came on time today.</li>}
    </ul>
  )
}
