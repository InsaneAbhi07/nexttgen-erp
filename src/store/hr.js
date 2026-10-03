/**
 * HR engine — attendance status resolution, monthly summaries, leave balances
 * and salary computation. Pure functions over the mock store (frontend-only demo).
 *
 * Attendance is stored as one sheet per date:
 *   { id: 'att-2026-10-03', date, entries: { [employeeId]: { status, in, out, ot, leaveTypeId, remarks } } }
 * status: P (present) | HD (half day) | A (absent) | L (leave)
 * Weekly offs, holidays and approved leave applications are derived, never stored.
 */
import { GRACE_MINUTES, SHIFTS, STATUTORY, WEEKDAYS } from '../data/constants.js'
import { addDays } from '../utils/format.js'

export const DAY_STATUS = {
  P: { label: 'Present', short: 'P', tone: 'green' },
  HD: { label: 'Half Day', short: 'HD', tone: 'amber' },
  A: { label: 'Absent', short: 'A', tone: 'red' },
  L: { label: 'On Leave', short: 'L', tone: 'violet' },
  WO: { label: 'Weekly Off', short: 'WO', tone: 'gray' },
  H: { label: 'Holiday', short: 'H', tone: 'teal' },
}
export const MARKABLE = ['P', 'HD', 'A', 'L']

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* ---------------- Date helpers ---------------- */
export const weekday = (iso) => new Date(`${iso}T00:00:00`).getDay()
export const daysInMonth = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
export const monthDates = (ym) => Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
export const monthTitle = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : '')
export const shiftMonth = (ym, delta) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const eachDate = (from, to, fn) => {
  for (let d = from; d <= to; d = addDays(d, 1)) fn(d)
}
const minutes = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/* ---------------- Employee helpers ---------------- */
export const shiftOf = (emp) => SHIFTS.find((s) => s.name === emp?.shift) || SHIFTS[0]
export const isWeeklyOff = (emp, iso) => WEEKDAYS[weekday(iso)] === (emp?.weeklyOff || 'Sunday')
export const isEmployedOn = (emp, iso) => Boolean(emp) && (!emp.joiningDate || iso >= emp.joiningDate) && (!emp.exitDate || iso <= emp.exitDate)
export const isLate = (emp, entry) => {
  const t = minutes(entry?.in)
  return t !== null && t > minutes(shiftOf(emp).start) + GRACE_MINUTES
}
export const workHours = (entry) => {
  const a = minutes(entry?.in)
  const b = minutes(entry?.out)
  return a === null || b === null || b <= a ? 0 : Math.round(((b - a) / 60) * 10) / 10
}
/** Fixed monthly gross from the salary structure (daily wage × 26 for daily-rated staff). */
export const monthlyGross = (emp) =>
  emp?.salaryType === 'Daily'
    ? Math.round((Number(emp.dailyRate) || 0) * 26)
    : (Number(emp?.basic) || 0) + (Number(emp?.hra) || 0) + (Number(emp?.conveyance) || 0) + (Number(emp?.specialAllowance) || 0)

/* ---------------- Index (memoised per store snapshot) ---------------- */
const idxCache = new WeakMap()

export function hrIndex(state) {
  const hit = idxCache.get(state)
  if (hit) return hit
  const holidays = new Map()
  ;(state.holidays || []).forEach((h) => h.status !== 'Inactive' && holidays.set(h.date, h))
  const sheets = new Map((state.attendance || []).map((a) => [a.date, a]))
  const employees = new Map((state.employees || []).map((e) => [e.id, e]))
  const leaveTypes = new Map((state.leaveTypes || []).map((t) => [t.id, t]))
  const leaveDays = new Map()
  ;(state.leaveApplications || [])
    .filter((l) => l.status === 'Approved')
    .forEach((l) => {
      const emp = employees.get(l.employeeId)
      if (!emp) return
      eachDate(l.from, l.to, (d) => {
        if (!holidays.has(d) && !isWeeklyOff(emp, d)) leaveDays.set(`${emp.id}|${d}`, { leaveTypeId: l.leaveTypeId, halfDay: Boolean(l.halfDay), appId: l.id })
      })
    })
  const idx = { holidays, sheets, employees, leaveTypes, leaveDays }
  idxCache.set(state, idx)
  return idx
}

/**
 * Resolved status of one employee on one date.
 * Priority: marked present/half day → approved leave → marked absent/leave → holiday/weekly off → unmarked.
 */
export function dayStatus(idx, emp, date) {
  if (!isEmployedOn(emp, date)) return { code: null, employed: false }
  const entry = idx.sheets.get(date)?.entries?.[emp.id]
  const leave = idx.leaveDays.get(`${emp.id}|${date}`)
  const holiday = idx.holidays.get(date)
  const off = holiday ? 'H' : isWeeklyOff(emp, date) ? 'WO' : null
  const base = { employed: true, entry, off, holiday }
  if (entry?.status === 'P') return { ...base, code: 'P', source: 'marked' }
  if (entry?.status === 'HD') return { ...base, code: 'HD', source: 'marked', leaveTypeId: leave?.halfDay ? leave.leaveTypeId : undefined }
  if (leave) return { ...base, code: 'L', source: 'leave', leaveTypeId: leave.leaveTypeId, halfDay: leave.halfDay, appId: leave.appId }
  if (entry) return { ...base, code: entry.status, source: 'marked', leaveTypeId: entry.leaveTypeId }
  if (off) return { ...base, code: off, source: 'auto' }
  return { ...base, code: null, source: null }
}

/* ---------------- Monthly summary ---------------- */
/**
 * Attendance totals for an employee in a month (YYYY-MM).
 * `upto` (YYYY-MM-DD) ignores later dates — used for the running month.
 */
export function monthSummary(state, emp, ym, upto) {
  const idx = hrIndex(state)
  const s = { days: 0, employedDays: 0, present: 0, halfDay: 0, absent: 0, leavePaid: 0, leaveUnpaid: 0, weeklyOff: 0, holidays: 0, unmarked: 0, late: 0, otHours: 0, worked: 0, offDayWorked: 0, byLeave: {} }
  monthDates(ym).forEach((d) => {
    s.days += 1
    if (upto && d > upto) return
    const st = dayStatus(idx, emp, d)
    if (!st.employed) return
    s.employedDays += 1
    const addLeave = (n) => {
      const lt = idx.leaveTypes.get(st.leaveTypeId)
      if (lt && lt.paid !== false) s.leavePaid += n
      else s.leaveUnpaid += n
      if (st.leaveTypeId) s.byLeave[st.leaveTypeId] = (s.byLeave[st.leaveTypeId] || 0) + n
    }
    if (st.off === 'H') s.holidays += 1
    else if (st.off === 'WO') s.weeklyOff += 1
    switch (st.code) {
      case 'P':
        s.present += 1
        s.worked += 1
        if (st.off) s.offDayWorked += 1
        break
      case 'HD':
        s.halfDay += 1
        s.worked += 0.5
        if (st.off) s.offDayWorked += 0.5
        else if (st.leaveTypeId) addLeave(0.5)
        break
      case 'L':
        if (!st.off) addLeave(st.halfDay ? 0.5 : 1)
        break
      case 'A':
        if (!st.off) s.absent += 1
        break
      case 'H':
      case 'WO':
        break
      default:
        s.unmarked += 1
    }
    if (st.entry && (st.code === 'P' || st.code === 'HD')) {
      if (isLate(emp, st.entry)) s.late += 1
      s.otHours += Number(st.entry.ot) || 0
    }
  })
  s.paidDays = emp?.salaryType === 'Daily' ? s.worked + s.leavePaid + s.holidays : s.worked - s.offDayWorked + s.leavePaid + s.weeklyOff + s.holidays
  s.lopDays = emp?.salaryType === 'Daily' ? 0 : Math.max(0, s.employedDays - s.paidDays)
  return s
}

/* ---------------- Leave ---------------- */
/** Working days in a leave request (weekly offs and holidays are not counted). */
export function leaveDaysCount(state, emp, from, to, halfDay = false) {
  if (!emp || !from || !to || to < from) return 0
  if (halfDay) return 0.5
  const idx = hrIndex(state)
  let n = 0
  eachDate(from, to, (d) => {
    if (!idx.holidays.has(d) && !isWeeklyOff(emp, d)) n += 1
  })
  return n
}

export const leaveTypeApplies = (lt, emp) => !lt.gender || lt.gender === 'All' || lt.gender === emp?.gender

/** Leave balances for a calendar year: [{ type, quota, used, pending, balance }] (balance null = no limit). */
export function leaveBalances(state, emp, year) {
  const idx = hrIndex(state)
  const used = {}
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  eachDate(from, to, (d) => {
    const st = dayStatus(idx, emp, d)
    if (!st.leaveTypeId || st.off) return
    if (st.code === 'L') used[st.leaveTypeId] = (used[st.leaveTypeId] || 0) + (st.halfDay ? 0.5 : 1)
    else if (st.code === 'HD') used[st.leaveTypeId] = (used[st.leaveTypeId] || 0) + 0.5
  })
  const pending = {}
  ;(state.leaveApplications || [])
    .filter((l) => l.employeeId === emp.id && l.status === 'Pending' && l.from <= to && l.to >= from)
    .forEach((l) => (pending[l.leaveTypeId] = (pending[l.leaveTypeId] || 0) + (Number(l.days) || 0)))
  return (state.leaveTypes || [])
    .filter((t) => t.status === 'Active' && leaveTypeApplies(t, emp))
    .map((t) => {
      const quota = Number(t.annualQuota) || 0
      const u = used[t.id] || 0
      return { type: t, quota, used: u, pending: pending[t.id] || 0, balance: quota ? quota - u : null }
    })
}

/* ---------------- Payroll ---------------- */
const r0 = (n) => Math.round(Number(n) || 0)

/** Employees who are on the payroll for a month. */
export const payrollEmployees = (state, ym) => {
  const start = `${ym}-01`
  const end = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`
  return (state.employees || [])
    .filter((e) => e.status === 'Active' && (!e.joiningDate || e.joiningDate <= end) && (!e.exitDate || e.exitDate >= start))
    .sort((a, b) => (a.code < b.code ? -1 : 1))
}

/**
 * Salary slip for an employee and month, computed from attendance and the salary structure.
 * adj: { incentive, advance, tds, other } — owner-entered adjustments on the salary sheet.
 */
export function computeSlip(state, emp, ym, adj = {}) {
  const dim = daysInMonth(ym)
  const s = monthSummary(state, emp, ym)
  const fixedGross = monthlyGross(emp)
  const earnings = []
  let basicEarned
  let hourly
  if (emp.salaryType === 'Daily') {
    const rate = Number(emp.dailyRate) || 0
    basicEarned = r0(rate * s.paidDays)
    earnings.push({ key: 'wages', label: 'Wages', amount: basicEarned })
    hourly = rate / 8
  } else {
    const f = s.paidDays / dim
    basicEarned = r0((Number(emp.basic) || 0) * f)
    earnings.push({ key: 'basic', label: 'Basic', amount: basicEarned })
    earnings.push({ key: 'hra', label: 'House rent allowance', amount: r0((Number(emp.hra) || 0) * f) })
    earnings.push({ key: 'conveyance', label: 'Conveyance', amount: r0((Number(emp.conveyance) || 0) * f) })
    earnings.push({ key: 'special', label: 'Special allowance', amount: r0((Number(emp.specialAllowance) || 0) * f) })
    if (s.offDayWorked) earnings.push({ key: 'offday', label: 'Holiday / weekly-off work', amount: r0((fixedGross / dim) * s.offDayWorked) })
    hourly = (Number(emp.basic) || 0) / 26 / 8
  }
  if (s.otHours) earnings.push({ key: 'ot', label: `Overtime (${s.otHours} h)`, amount: r0(hourly * STATUTORY.otMultiplier * s.otHours) })
  if (Number(adj.incentive)) earnings.push({ key: 'incentive', label: 'Incentive / bonus', amount: r0(adj.incentive) })
  const gross = earnings.reduce((a, e) => a + e.amount, 0)

  const pf = emp.pfApplicable ? r0((Math.min(basicEarned, STATUTORY.pfWageCeiling) * STATUTORY.pfRate) / 100) : 0
  const esiOn = Boolean(emp.esiApplicable) && fixedGross <= STATUTORY.esiWageLimit
  const esi = esiOn ? Math.ceil((gross * STATUTORY.esiEmployee) / 100) : 0
  const deductions = [
    pf && { key: 'pf', label: 'Provident fund (12%)', amount: pf },
    esi && { key: 'esi', label: 'ESI (0.75%)', amount: esi },
    Number(adj.advance) && { key: 'advance', label: 'Salary advance recovery', amount: r0(adj.advance) },
    Number(adj.tds) && { key: 'tds', label: 'TDS', amount: r0(adj.tds) },
    Number(adj.other) && { key: 'other', label: 'Other deductions', amount: r0(adj.other) },
  ].filter(Boolean)
  const totalDeductions = deductions.reduce((a, d) => a + d.amount, 0)
  const employerPf = pf
  const employerEsi = esiOn ? Math.ceil((gross * STATUTORY.esiEmployer) / 100) : 0

  return {
    employeeId: emp.id,
    code: emp.code,
    name: emp.name,
    department: emp.department,
    designation: emp.designation,
    salaryType: emp.salaryType,
    rate: emp.salaryType === 'Daily' ? Number(emp.dailyRate) || 0 : fixedGross,
    days: dim,
    employedDays: s.employedDays,
    paidDays: s.paidDays,
    lopDays: s.lopDays,
    attendance: { present: s.present, halfDay: s.halfDay, absent: s.absent, leavePaid: s.leavePaid, leaveUnpaid: s.leaveUnpaid, weeklyOff: s.weeklyOff, holidays: s.holidays, unmarked: s.unmarked, late: s.late, otHours: s.otHours },
    earnings: earnings.filter((e) => e.amount),
    deductions,
    gross,
    totalDeductions,
    netPay: Math.max(0, gross - totalDeductions),
    employerPf,
    employerEsi,
    adjustments: { incentive: Number(adj.incentive) || 0, advance: Number(adj.advance) || 0, tds: Number(adj.tds) || 0, other: Number(adj.other) || 0 },
    bank: emp.paymentMode === 'Cash' ? null : { bankName: emp.bankName, account: emp.bankAccount, ifsc: emp.ifsc },
    paymentMode: emp.paymentMode || 'Bank',
  }
}

export const runTotals = (slips) =>
  slips.reduce(
    (a, s) => ({
      headcount: a.headcount + 1,
      gross: a.gross + s.gross,
      deductions: a.deductions + s.totalDeductions,
      net: a.net + s.netPay,
      employer: a.employer + s.employerPf + s.employerEsi,
      pf: a.pf + (s.deductions.find((d) => d.key === 'pf')?.amount || 0) + s.employerPf,
      esi: a.esi + (s.deductions.find((d) => d.key === 'esi')?.amount || 0) + s.employerEsi,
      unmarked: a.unmarked + (s.attendance.unmarked || 0),
    }),
    { headcount: 0, gross: 0, deductions: 0, net: 0, employer: 0, pf: 0, esi: 0, unmarked: 0 },
  )

/** Salary sheet for a month. `previous` keeps owner adjustments when recalculating a draft. */
export function buildPayroll(state, ym, previous = []) {
  const adjOf = new Map(previous.map((s) => [s.employeeId, s.adjustments]))
  const slips = payrollEmployees(state, ym).map((e) => computeSlip(state, e, ym, adjOf.get(e.id)))
  return { month: ym, slips, totals: runTotals(slips) }
}
