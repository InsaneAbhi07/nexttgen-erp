/** Tabs (underline) and Segmented control. tabs: [{ key, label, count?, icon? }] */

export function Tabs({ tabs, value, onChange, className = '', style }) {
  return (
    <div className={`tabs ${className}`} role="tablist" style={style}>
      {tabs.map((t) => {
        const Icon = t.icon
        return (
          <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={`tab ${value === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
            {Icon && <Icon size={15} />}
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o }
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={value === opt.value} className={value === opt.value ? 'active' : ''} onClick={() => onChange(opt.value)}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
