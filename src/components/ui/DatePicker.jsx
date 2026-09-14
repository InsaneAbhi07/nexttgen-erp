import { addDays, today } from '../../utils/format.js'
import { Select } from './FormField.jsx'

/** DatePicker — native date input styled to match the ERP. value: 'YYYY-MM-DD' */
export function DatePicker({ value, onChange, className = '', size, ...rest }) {
  return (
    <input
      type="date"
      className={`input ${size === 'sm' ? 'input-sm' : ''} ${className}`}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    />
  )
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Preset ranges relative to today (Indian FY starts in April). */
export function presetRange(key) {
  const t = today()
  const d = new Date(`${t}T00:00:00`)
  switch (key) {
    case 'today':
      return { from: t, to: t }
    case 'yesterday':
      return { from: addDays(t, -1), to: addDays(t, -1) }
    case '7d':
      return { from: addDays(t, -6), to: t }
    case '30d':
      return { from: addDays(t, -29), to: t }
    case 'month':
      return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: t }
    case 'lastMonth':
      return { from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)) }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) * 3
      return { from: ymd(new Date(d.getFullYear(), q, 1)), to: t }
    }
    case 'fy': {
      const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
      return { from: `${startYear}-04-01`, to: t }
    }
    case '12m':
      return { from: addDays(t, -364), to: t }
    default:
      return { from: '', to: '' }
  }
}

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'fy', label: 'This financial year' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All dates' },
  { value: 'custom', label: 'Custom range' },
]

/**
 * DateRange — preset select + from/to inputs.
 * value: { from, to, preset }   onChange(nextValue)
 */
export function DateRange({ value = {}, onChange, showPreset = true, size }) {
  const preset = value.preset || 'custom'
  return (
    <div className="date-range row-wrap">
      {showPreset && (
        <Select
          size={size}
          options={RANGE_PRESETS}
          value={preset}
          style={{ width: 150 }}
          aria-label="Date range"
          onChange={(e) => {
            const p = e.target.value
            if (p === 'custom') onChange({ ...value, preset: p })
            else onChange({ ...presetRange(p), preset: p })
          }}
        />
      )}
      <DatePicker size={size} value={value.from} max={value.to || undefined} aria-label="From date" onChange={(from) => onChange({ ...value, from, preset: 'custom' })} />
      <span className="muted small">to</span>
      <DatePicker size={size} value={value.to} min={value.from || undefined} aria-label="To date" onChange={(to) => onChange({ ...value, to, preset: 'custom' })} />
    </div>
  )
}

export const inDateRange = (date, range) => (!range?.from || date >= range.from) && (!range?.to || date <= range.to)

export default DatePicker
