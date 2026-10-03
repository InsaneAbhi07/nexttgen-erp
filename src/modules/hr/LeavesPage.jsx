/**
 * Leave applications — apply, approve, reject or cancel. Approved leave flows into the
 * attendance sheet and salary automatically. Frontend-only demo (mock store).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, CalendarPlus, Check, Clock, Plane, X } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { leaveBalances, leaveDaysCount, leaveTypeApplies } from '../../store/hr.js'
import { daysBetween, fmtDate, fmtDateTime, today } from '../../utils/format.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, Callout, DataTable, DocNo, Drawer, Field, FilterPanel, FormField, KeyValue, PageHeader, StatCard, StatusBadge, Tabs, Textarea, useToast } from '../../components/ui/index.js'
import { MiniTable } from '../masters/shared.jsx'
import { daysText, decideLeave, employeeOptions, HR_CRUMB, lockedRun, NoAccess } from './shared.jsx'

const blank = (t, employeeId = '') => ({ employeeId, leaveTypeId: '', from: t, to: t, halfDay: false, reason: '', approveNow: false })

export default function LeavesPage() {
  usePageTitle('Leave applications')
  const { state, save, patch, get } = useErp()
  const { can, user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const t = today()
  const [tab, setTab] = useState('Pending')
  const [filters, setFilters] = useState({})
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [remarks, setRemarks] = useState('')

  const emps = useMemo(() => new Map((state.employees || []).map((e) => [e.id, e])), [state.employees])
  const types = useMemo(() => new Map((state.leaveTypes || []).map((x) => [x.id, x])), [state.leaveTypes])
  const all = state.leaveApplications || []
  const viewing = params.get('view') ? get('leaveApplications', params.get('view')) : null

  useEffect(() => {
    if (params.get('new') === '1') {
      setForm(blank(t, params.get('employee') || ''))
      setErrors({})
      const next = new URLSearchParams(params)
      next.delete('new')
      next.delete('employee')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => setRemarks(''), [viewing?.id])

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const rows = all
    .filter((l) => tab === 'All' || l.status === tab)
    .filter((l) => (!filters.department || emps.get(l.employeeId)?.department === filters.department) && (!filters.leaveTypeId || l.leaveTypeId === filters.leaveTypeId))

  /* ---------- Apply form ---------- */
  const emp = form ? emps.get(form.employeeId) : null
  const lt = form ? types.get(form.leaveTypeId) : null
  const days = form && emp ? leaveDaysCount(state, emp, form.from, form.halfDay ? form.from : form.to, form.halfDay) : 0
  const balances = emp ? leaveBalances(state, emp, Number((form?.from || t).slice(0, 4))) : []
  const bal = lt ? balances.find((b) => b.type.id === lt.id) : null
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === 'from' && f.to < v ? { to: v } : {}) }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (ev) => {
    ev.preventDefault()
    const e = {}
    const to = form.halfDay ? form.from : form.to
    if (!form.employeeId) e.employeeId = 'Select the employee'
    if (!form.leaveTypeId) e.leaveTypeId = 'Select the leave type'
    if (!form.from) e.from = 'Select the start date'
    if (!to || to < form.from) e.to = 'End date must be on or after the start date'
    if (!form.reason.trim()) e.reason = 'Enter the reason'
    if (emp && lt && !e.to) {
      if (!days) e.to = 'The selected dates are all weekly offs or holidays'
      if (Number(lt.maxConsecutive) && days > Number(lt.maxConsecutive)) e.to = `${lt.name} can be taken for at most ${lt.maxConsecutive} days at a time`
      if (bal && bal.balance !== null && days > bal.balance - bal.pending) e.leaveTypeId = `Only ${daysText(Math.max(0, bal.balance - bal.pending))} left${bal.pending ? ' after pending requests' : ''}. Use Leave Without Pay for the rest.`
      if (form.from < emp.joiningDate) e.from = `${emp.name} joined on ${fmtDate(emp.joiningDate)}`
      const clash = all.find((l) => l.employeeId === emp.id && ['Pending', 'Approved'].includes(l.status) && l.from <= to && l.to >= form.from)
      if (clash) e.from = `Overlaps with ${clash.number} (${fmtDate(clash.from)} to ${fmtDate(clash.to)})`
      const locked = lockedRun(state, form.from.slice(0, 7)) || lockedRun(state, to.slice(0, 7))
      if (locked) e.from = `Salary for that month is already ${locked.status.toLowerCase()} (${locked.number})`
    }
    if (Object.keys(e).length) {
      setErrors(e)
      toast.error('Check the highlighted fields', `${Object.keys(e).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const approved = form.approveNow && can('HR', 'approve')
    const saved = save(
      'leaveApplications',
      {
        date: t, employeeId: emp.id, leaveTypeId: lt.id, from: form.from, to, halfDay: Boolean(form.halfDay), days, reason: form.reason.trim(),
        status: approved ? 'Approved' : 'Pending', actionBy: approved ? user?.name : '', actionAt: approved ? new Date().toISOString() : '', actionRemarks: '',
      },
      approved ? {} : { notify: { type: 'system', title: 'Leave request waiting', message: `${emp.name} applied for ${daysText(days)} of ${lt.name} from ${fmtDate(form.from)}.`, link: '/hr/leaves' } },
    )
    setSaving(false)
    setForm(null)
    toast.success(approved ? 'Leave approved' : 'Leave application submitted', `${saved.number}: ${emp.name}, ${daysText(days)} of ${lt.name}.`)
  }

  const decide = (leave, status) => {
    decideLeave(patch, leave, status, user?.name, remarks.trim())
    toast.success(`Leave ${status.toLowerCase()}`, `${leave.number}, ${emps.get(leave.employeeId)?.name}`)
    setParam('view', '')
  }

  if (!can('HR')) return <NoAccess what="leave applications" />

  const count = (s) => all.filter((l) => l.status === s).length
  const onLeaveToday = all.filter((l) => l.status === 'Approved' && l.from <= t && l.to >= t).length
  const monthDays = all.filter((l) => l.status === 'Approved' && l.from.slice(0, 7) === t.slice(0, 7)).reduce((a, l) => a + Number(l.days), 0)

  const columns = [
    { key: 'number', header: 'Application', render: (l) => (<div><DocNo>{l.number}</DocNo><div className="cell-secondary">Applied {fmtDate(l.date)}</div></div>) },
    {
      key: 'employee',
      header: 'Employee',
      accessor: (l) => emps.get(l.employeeId)?.name,
      render: (l) => (<div><div className="cell-primary">{emps.get(l.employeeId)?.name}</div><div className="cell-secondary">{emps.get(l.employeeId)?.department}</div></div>),
    },
    { key: 'type', header: 'Leave', accessor: (l) => types.get(l.leaveTypeId)?.name, render: (l) => (<div><div>{types.get(l.leaveTypeId)?.name}</div><div className="cell-secondary">{types.get(l.leaveTypeId)?.paid === false ? 'Unpaid' : 'Paid'}</div></div>) },
    { key: 'from', header: 'Dates', render: (l) => <span className="nowrap">{fmtDate(l.from)}{l.to !== l.from ? ` – ${fmtDate(l.to)}` : ''}</span> },
    { key: 'days', header: 'Days', align: 'right', render: (l) => (l.halfDay ? 'Half day' : daysText(l.days)) },
    { key: 'reason', header: 'Reason', render: (l) => <span className="ink-2">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => (<div><StatusBadge status={l.status} />{l.actionBy && <div className="cell-secondary">by {l.actionBy}</div>}</div>) },
  ]

  return (
    <>
      <PageHeader
        title="Leave applications"
        subtitle="Approved leave is applied to attendance and salary automatically."
        breadcrumbs={[HR_CRUMB, { label: 'Leave applications' }]}
        actions={
          <>
            <Button to="/hr/leave-types">Leave types</Button>
            {can('HR', 'add') && <Button variant="primary" icon={CalendarPlus} onClick={() => { setForm(blank(t)); setErrors({}) }}>Apply leave</Button>}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Waiting for approval" value={count('Pending')} icon={Clock} tone={count('Pending') ? 'amber' : 'green'} foot="Pending requests" onClick={() => setTab('Pending')} />
        <StatCard label="On leave today" value={onLeaveToday} icon={Plane} tone="violet" foot="Approved leave" />
        <StatCard label="Leave days this month" value={monthDays % 1 ? monthDays.toFixed(1) : monthDays} icon={CalendarPlus} tone="blue" foot="Approved, starting this month" />
        <StatCard label="Rejected" value={count('Rejected')} icon={Ban} tone="gray" foot="All time" onClick={() => setTab('Rejected')} />
      </div>

      <Tabs
        tabs={['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'].map((k) => ({ key: k, label: k, count: k === 'All' ? all.length : count(k) }))}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 12 }}
      />

      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(l) => setParam('view', l.id)}
        exportName="leave-applications"
        searchPlaceholder="Search employee, leave type or reason…"
        initialSort={{ key: 'from', dir: tab === 'Pending' ? 'asc' : 'desc' }}
        filters={
          <FilterPanel
            filters={[
              { key: 'department', label: 'Departments', options: [...new Set((state.employees || []).map((e) => e.department))].sort() },
              { key: 'leaveTypeId', label: 'Leave types', options: (state.leaveTypes || []).map((x) => ({ value: x.id, label: x.name })) },
            ]}
            values={filters}
            onChange={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
            onReset={() => setFilters({})}
          />
        }
        emptyTitle={tab === 'Pending' ? 'No leave waiting for approval' : 'No leave applications'}
        emptyDescription="Leave applied by or for employees will show here."
      />

      {/* Apply */}
      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        title="Apply leave"
        subtitle="Weekly offs and holidays inside the dates are not counted"
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" form="leave-form" loading={saving}>{form?.approveNow ? 'Save and approve' : 'Submit application'}</Button>
          </>
        }
      >
        {form && (
          <form id="leave-form" onSubmit={submit} noValidate>
            <div className="form-grid cols-2">
              <FormField def={{ name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions(state), span: 'full' }} value={form.employeeId} error={errors.employeeId} onChange={(v) => set('employeeId', v)} />
              <FormField
                def={{ name: 'leaveTypeId', label: 'Leave type', type: 'select', required: true, span: 'full', options: (state.leaveTypes || []).filter((x) => x.status === 'Active' && (!emp || leaveTypeApplies(x, emp))).map((x) => ({ value: x.id, label: `${x.name} (${x.code})${x.paid ? '' : ', unpaid'}` })) }}
                value={form.leaveTypeId}
                error={errors.leaveTypeId}
                onChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v, halfDay: types.get(v)?.allowHalfDay ? f.halfDay : false }))}
              />
              <FormField def={{ name: 'from', label: 'From', type: 'date', required: true }} value={form.from} error={errors.from} onChange={(v) => set('from', v)} />
              {!form.halfDay && <FormField def={{ name: 'to', label: 'To', type: 'date', required: true }} value={form.to} error={errors.to} onChange={(v) => set('to', v)} />}
              {lt?.allowHalfDay && (
                <FormField def={{ name: 'halfDay', label: 'Half day', type: 'switch', checkboxLabel: 'Only half a day (single date)', span: 'full' }} value={form.halfDay} onChange={(v) => set('halfDay', v)} />
              )}
              <Field label="Reason" required error={errors.reason} span="full" htmlFor="leave-reason">
                <Textarea id="leave-reason" rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
              </Field>
              {can('HR', 'approve') && (
                <FormField def={{ name: 'approveNow', label: 'Approval', type: 'switch', checkboxLabel: 'Approve now (you are the approver)', span: 'full' }} value={form.approveNow} onChange={(v) => set('approveNow', v)} />
              )}
            </div>
            {emp && (
              <div className="stack-sm mt-16">
                <Callout tone={days ? 'blue' : 'amber'}>
                  {days ? <>This request counts as <b>{daysText(days)}</b>{lt && lt.paid === false ? ', deducted from salary' : ''}.</> : 'No working days in the selected dates.'}
                  {lt && Number(lt.noticeDays) > 0 && daysBetween(t, form.from) < Number(lt.noticeDays) && <> {lt.name} should be applied {lt.noticeDays} day(s) in advance.</>}
                </Callout>
                <BalanceTable balances={balances} />
              </div>
            )}
          </form>
        )}
      </Drawer>

      {/* View */}
      <Drawer
        open={Boolean(viewing)}
        onClose={() => setParam('view', '')}
        title={viewing ? `${emps.get(viewing.employeeId)?.name}` : ''}
        subtitle={viewing ? <span className="row" style={{ gap: 8, marginTop: 4 }}><span className="doc-no">{viewing.number}</span><StatusBadge status={viewing.status} /></span> : null}
        footer={
          viewing && (
            <>
              {['Pending', 'Approved'].includes(viewing.status) && viewing.to >= t && !lockedRun(state, viewing.from.slice(0, 7)) && can('HR', 'edit') && (
                <Button variant="ghost" icon={Ban} style={{ marginRight: 'auto' }} onClick={() => decide(viewing, 'Cancelled')}>Cancel leave</Button>
              )}
              <Button onClick={() => setParam('view', '')}>Close</Button>
              {viewing.status === 'Pending' && can('HR', 'approve') && (
                <>
                  <Button variant="danger" icon={X} onClick={() => decide(viewing, 'Rejected')}>Reject</Button>
                  <Button variant="primary" icon={Check} onClick={() => decide(viewing, 'Approved')}>Approve</Button>
                </>
              )}
            </>
          )
        }
      >
        {viewing && (
          <div className="stack">
            <KeyValue
              cols={2}
              items={[
                { label: 'Leave type', value: types.get(viewing.leaveTypeId)?.name },
                { label: 'Days', value: viewing.halfDay ? 'Half day' : daysText(viewing.days) },
                { label: 'From', value: fmtDate(viewing.from) },
                { label: 'To', value: fmtDate(viewing.to) },
                { label: 'Applied on', value: fmtDate(viewing.date) },
                { label: 'Department', value: emps.get(viewing.employeeId)?.department },
                { label: 'Reason', value: viewing.reason, span: 2 },
                viewing.actionBy && { label: `${viewing.status} by`, value: `${viewing.actionBy}${viewing.actionAt ? `, ${fmtDateTime(viewing.actionAt)}` : ''}`, span: 2 },
                viewing.actionRemarks && { label: 'Remarks', value: viewing.actionRemarks, span: 2 },
              ]}
            />
            {viewing.status === 'Pending' && can('HR', 'approve') && (
              <Field label="Approver remarks" hint="Shown to the employee with your decision" htmlFor="leave-remarks">
                <Textarea id="leave-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
            )}
            {emps.get(viewing.employeeId) && <BalanceTable balances={leaveBalances(state, emps.get(viewing.employeeId), Number(viewing.from.slice(0, 4)))} />}
          </div>
        )}
      </Drawer>
    </>
  )
}

function BalanceTable({ balances }) {
  return (
    <MiniTable
      rows={balances.map((b) => ({ ...b, id: b.type.id }))}
      empty="No leave types apply."
      columns={[
        { header: 'Leave balance', render: (b) => b.type.name },
        { header: 'Quota', align: 'right', render: (b) => (b.quota || 'No limit') },
        { header: 'Used', align: 'right', render: (b) => b.used },
        { header: 'Pending', align: 'right', render: (b) => b.pending || '—' },
        { header: 'Left', align: 'right', render: (b) => (b.balance === null ? '—' : <b className={b.balance - b.pending < 0 ? 'text-red' : ''}>{b.balance}</b>) },
      ]}
    />
  )
}
