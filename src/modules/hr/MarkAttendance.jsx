/**
 * Mark attendance — one sheet per date. Present / half day / absent / leave with in-out
 * times and overtime. Weekly offs, holidays and approved leave are filled in automatically.
 * Frontend-only demo (mock store).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCheck, ChevronLeft, ChevronRight, Lock, RotateCcw, Save } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { hrIndex, isEmployedOn, isLate, isWeeklyOff, leaveTypeApplies, MARKABLE, shiftOf, workHours, DAY_STATUS, monthTitle } from '../../store/hr.js'
import { DEPARTMENTS, SHIFTS, WEEKDAYS } from '../../data/constants.js'
import { addDays, fmtDate, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Badge, Button, Callout, Card, DatePicker, DocNo, Input, PageHeader, SearchBar, Select, useConfirm, useToast } from '../../components/ui/index.js'
import { DayChip, HR_CRUMB, lockedRun, NoAccess } from './shared.jsx'

const pad = (n) => String(n).padStart(2, '0')
const plusMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

export default function MarkAttendance() {
  usePageTitle('Mark attendance')
  const { state, save } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const t = today()
  const date = params.get('date') && params.get('date') <= t ? params.get('date') : t
  const sheet = (state.attendance || []).find((a) => a.date === date)
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [filters, setFilters] = useState({ department: '', shift: '', q: '' })

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(sheet?.entries || {})))
    setDirty(false)
    setErrors({})
  }, [sheet, date])

  const idx = hrIndex(state)
  const holiday = idx.holidays.get(date)
  const locked = lockedRun(state, date.slice(0, 7))
  const canEdit = !locked && (sheet ? can('HR', 'edit') || can('HR', 'add') : can('HR', 'add'))
  const types = (state.leaveTypes || []).filter((lt) => lt.status === 'Active')
  const typeById = new Map((state.leaveTypes || []).map((lt) => [lt.id, lt]))
  const apps = new Map((state.leaveApplications || []).map((l) => [l.id, l]))

  const allRows = useMemo(
    () =>
      (state.employees || [])
        .filter((e) => e.status === 'Active' && isEmployedOn(e, date))
        .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name))
        .map((emp) => {
          const leave = idx.leaveDays.get(`${emp.id}|${date}`)
          const off = holiday ? 'H' : isWeeklyOff(emp, date) ? 'WO' : null
          return { emp, leave, off }
        }),
    [state.employees, date, idx, holiday],
  )

  const effective = (r) => {
    const e = draft[r.emp.id]
    if (e && (e.status === 'P' || e.status === 'HD')) return e.status
    if (r.leave) return 'L'
    return e?.status || r.off || null
  }

  const counts = allRows.reduce((a, r) => {
    const c = effective(r)
    a[c || 'none'] = (a[c || 'none'] || 0) + 1
    return a
  }, {})

  const rows = allRows.filter(({ emp }) => {
    if (filters.department && emp.department !== filters.department) return false
    if (filters.shift && emp.shift !== filters.shift) return false
    const q = filters.q.trim().toLowerCase()
    return !q || `${emp.name} ${emp.code} ${emp.designation}`.toLowerCase().includes(q)
  })

  const update = (empId, fn) => {
    setDraft((d) => {
      const next = { ...d }
      const value = fn(d[empId])
      if (value) next[empId] = value
      else delete next[empId]
      return next
    })
    setDirty(true)
    setErrors((e) => ({ ...e, [empId]: undefined }))
  }

  const setStatus = (emp, code) =>
    update(emp.id, (cur) => {
      if (cur?.status === code) return null
      const sh = shiftOf(emp)
      const past = date < t
      if (code === 'P') return { status: 'P', in: cur?.in || sh.start, out: cur?.out || (past ? sh.end : ''), ot: cur?.ot || 0, remarks: cur?.remarks || '' }
      if (code === 'HD') return { status: 'HD', in: cur?.in || sh.start, out: cur?.out || (past ? plusMinutes(sh.start, 270) : ''), ot: 0, remarks: cur?.remarks || '' }
      if (code === 'A') return { status: 'A', remarks: cur?.remarks || '' }
      const first = types.find((lt) => leaveTypeApplies(lt, emp))
      return { status: 'L', leaveTypeId: cur?.leaveTypeId || first?.id, remarks: cur?.remarks || '' }
    })

  const setField = (emp, field, value) => update(emp.id, (cur) => ({ ...(cur || { status: 'P' }), [field]: value }))

  const markAllPresent = () => {
    let n = 0
    const next = { ...draft }
    rows.forEach(({ emp, leave, off }) => {
      if (next[emp.id] || leave || off) return
      const sh = shiftOf(emp)
      next[emp.id] = { status: 'P', in: sh.start, out: date < t ? sh.end : '', ot: 0, remarks: '' }
      n += 1
    })
    setDraft(next)
    if (n) setDirty(true)
    toast.info(n ? `${n} employee(s) marked present` : 'Nobody left to mark', n ? 'Review exceptions, then save the sheet.' : 'Everyone shown is already marked, on leave or off.')
  }

  const submit = async () => {
    const errs = {}
    Object.entries(draft).forEach(([id, e]) => {
      if (e.status === 'L' && !e.leaveTypeId) errs[id] = 'Select the leave type'
      if ((e.status === 'P' || e.status === 'HD') && !e.in) errs[id] = 'Enter the in time'
      if (e.in && e.out && e.out <= e.in) errs[id] = 'Out time must be after in time'
      if (Number(e.ot) < 0 || Number(e.ot) > 8) errs[id] = 'Overtime must be 0 to 8 hours'
    })
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('Check the highlighted rows', `${Object.keys(errs).length} row(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const entries = Object.fromEntries(Object.entries(draft).map(([id, e]) => [id, { ...e, ot: Number(e.ot) || 0 }]))
    save('attendance', { ...(sheet || {}), id: sheet?.id || `att-${date}`, date, name: fmtDate(date), entries, markedBy: user?.name }, { action: 'marked' })
    setSaving(false)
    setDirty(false)
    toast.success('Attendance saved', `${Object.keys(entries).length} employee(s) marked for ${fmtDate(date)}.`)
  }

  const goTo = async (d) => {
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', message: 'Attendance changes for this date have not been saved.', confirmLabel: 'Discard', tone: 'danger' }))) return
    const next = new URLSearchParams(params)
    next.set('date', d > t ? t : d)
    setParams(next)
  }

  if (!can('HR')) return <NoAccess what="attendance" />

  return (
    <>
      <PageHeader
        title="Mark attendance"
        subtitle={`${WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]}, ${fmtDate(date)}${holiday ? `, ${holiday.name} (holiday)` : ''}`}
        breadcrumbs={[HR_CRUMB, { label: 'Mark attendance' }]}
        actions={
          <>
            <Button to={`/hr/register?month=${date.slice(0, 7)}`}>Monthly register</Button>
            {canEdit && <Button icon={CheckCheck} onClick={markAllPresent}>Mark remaining present</Button>}
          </>
        }
      />

      {locked && (
        <Callout tone="amber" icon={Lock} style={{ marginBottom: 14 }}>
          Salary for {monthTitle(locked.month)} is {locked.status.toLowerCase()} (<DocNo to={`/hr/payroll/${locked.id}`}>{locked.number}</DocNo>), so attendance for this month is locked.
        </Callout>
      )}

      <div className="att-toolbar">
        <div className="att-date">
          <Button iconOnly icon={ChevronLeft} onClick={() => goTo(addDays(date, -1))} aria-label="Previous day" />
          <DatePicker value={date} max={t} onChange={(d) => d && goTo(d)} />
          <Button iconOnly icon={ChevronRight} onClick={() => goTo(addDays(date, 1))} disabled={date >= t} aria-label="Next day" />
          {date !== t && <Button size="sm" variant="ghost" onClick={() => goTo(t)}>Today</Button>}
        </div>
        <Select size="sm" options={DEPARTMENTS} placeholder="All departments" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} style={{ width: 170 }} />
        <Select size="sm" options={SHIFTS.map((s) => s.name)} placeholder="All shifts" value={filters.shift} onChange={(e) => setFilters((f) => ({ ...f, shift: e.target.value }))} style={{ width: 130 }} />
        <div style={{ width: 220 }}>
          <SearchBar value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Search employee…" />
        </div>
        <div className="att-counts">
          {['P', 'HD', 'A', 'L', 'WO', 'H'].filter((c) => counts[c]).map((c) => (
            <span key={c} className="att-count"><DayChip code={c} size="sm" /> {DAY_STATUS[c].label} <b>{counts[c]}</b></span>
          ))}
          <span className="att-count" style={counts.none ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>Not marked <b>{counts.none || 0}</b></span>
        </div>
      </div>

      <Card flush>
        <div className="table-wrap">
          <table className="table att-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Shift</th>
                <th>Status</th>
                <th>Leave / note</th>
                <th>In</th>
                <th>Out</th>
                <th className="align-right">OT (h)</th>
                <th className="align-right">Hours</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const { emp, leave, off } = r
                const e = draft[emp.id]
                const code = effective(r)
                const worked = code === 'P' || code === 'HD'
                const sh = shiftOf(emp)
                const late = worked && isLate(emp, e)
                const app = leave && apps.get(leave.appId)
                return (
                  <tr key={emp.id} className={off && !worked ? 'is-off' : ''}>
                    <td>
                      <div className="cell-primary">{emp.name}</div>
                      <div className="cell-secondary"><span className="mono">{emp.code}</span>, {emp.designation}</div>
                      {errors[emp.id] && <div className="field-error">{errors[emp.id]}</div>}
                    </td>
                    <td>
                      <div>{emp.shift}</div>
                      <div className="cell-secondary">{sh.start}–{sh.end}</div>
                    </td>
                    <td>
                      <div className="att-seg" role="group" aria-label={`Attendance for ${emp.name}`}>
                        {MARKABLE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`s-${c} ${code === c ? 'on' : ''}`}
                            disabled={!canEdit || (leave && !leave.halfDay && (c === 'A' || c === 'L'))}
                            onClick={() => setStatus(emp, c)}
                            title={DAY_STATUS[c].label}
                            aria-pressed={code === c}
                          >
                            {DAY_STATUS[c].short}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      {e?.status === 'L' ? (
                        <Select
                          size="sm"
                          disabled={!canEdit}
                          value={e.leaveTypeId || ''}
                          placeholder="Leave type"
                          options={types.filter((lt) => leaveTypeApplies(lt, emp)).map((lt) => ({ value: lt.id, label: `${lt.code} – ${lt.name}` }))}
                          onChange={(ev) => setField(emp, 'leaveTypeId', ev.target.value)}
                          style={{ width: 170 }}
                        />
                      ) : leave ? (
                        <div>
                          <Badge tone="violet">{typeById.get(leave.leaveTypeId)?.code}{leave.halfDay ? ' ½' : ''} approved</Badge>
                          {app && <div className="att-note"><DocNo to={`/hr/leaves?view=${app.id}`}>{app.number}</DocNo></div>}
                        </div>
                      ) : off ? (
                        <span className="att-note">{off === 'H' ? holiday.name : 'Weekly off'}{worked ? ', worked' : ', mark P if worked'}</span>
                      ) : late ? (
                        <Badge tone="amber">Late</Badge>
                      ) : null}
                    </td>
                    <td>
                      {worked ? <Input size="sm" type="time" className="att-time" value={e?.in || ''} disabled={!canEdit} onChange={(ev) => setField(emp, 'in', ev.target.value)} /> : <span className="muted">—</span>}
                    </td>
                    <td>
                      {worked ? <Input size="sm" type="time" className="att-time" value={e?.out || ''} disabled={!canEdit} onChange={(ev) => setField(emp, 'out', ev.target.value)} /> : <span className="muted">—</span>}
                    </td>
                    <td className="align-right">
                      {code === 'P' ? <Input size="sm" type="number" min={0} max={8} step={0.5} className="att-ot" value={e?.ot ?? 0} disabled={!canEdit} onChange={(ev) => setField(emp, 'ot', ev.target.value === '' ? '' : Number(ev.target.value))} /> : <span className="muted">—</span>}
                    </td>
                    <td className="align-right num">{worked && e?.out ? workHours(e) : '—'}</td>
                    <td>
                      {e ? <Input size="sm" value={e.remarks || ''} disabled={!canEdit} placeholder="Optional" onChange={(ev) => setField(emp, 'remarks', ev.target.value)} style={{ minWidth: 140 }} /> : <span className="muted">—</span>}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={9} className="muted text-center" style={{ padding: 24 }}>No employees match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canEdit && (
        <div className="att-savebar">
          <div className="small ink-2">
            {dirty ? <b className="text-amber">Unsaved changes</b> : sheet ? `Last saved by ${sheet.markedBy || 'System'}` : 'Not saved yet for this date'}
            {' · '}Weekly offs, holidays and approved leave fill in automatically.
          </div>
          <div className="row">
            <Button icon={RotateCcw} disabled={!dirty || saving} onClick={() => { setDraft(JSON.parse(JSON.stringify(sheet?.entries || {}))); setDirty(false); setErrors({}) }}>Discard</Button>
            <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={submit}>Save attendance</Button>
          </div>
        </div>
      )}
    </>
  )
}
