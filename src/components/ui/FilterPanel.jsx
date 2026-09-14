import { RotateCcw } from 'lucide-react'
import { Select } from './FormField.jsx'
import { DateRange } from './DatePicker.jsx'
import Button from './Button.jsx'

/**
 * FilterPanel — config-driven row of filters.
 * filters: [{ key, label?, type: 'select' | 'daterange', options, placeholder, width }]
 * values:  { [key]: value }   (daterange value is { from, to, preset })
 * onChange(key, value); onReset()
 */
export default function FilterPanel({ filters = [], values = {}, onChange, onReset, size = 'sm', inline = true }) {
  const active = filters.some((f) => {
    const v = values[f.key]
    return f.type === 'daterange' ? v?.from || v?.to : v
  })
  return (
    <div className="filter-panel" style={inline ? { alignItems: 'center' } : undefined}>
      {filters.map((f) =>
        f.type === 'daterange' ? (
          <DateRange key={f.key} size={size} value={values[f.key] || {}} onChange={(v) => onChange(f.key, v)} />
        ) : (
          <Select
            key={f.key}
            size={size}
            options={f.options || []}
            placeholder={f.placeholder || `All ${f.label?.toLowerCase() || ''}`.trim()}
            value={values[f.key] || ''}
            onChange={(e) => onChange(f.key, e.target.value)}
            style={{ width: f.width || 160 }}
            aria-label={f.label}
          />
        ),
      )}
      {onReset && active && (
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
