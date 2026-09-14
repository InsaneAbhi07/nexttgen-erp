/**
 * Form primitives: Field wrapper, Input, Select, Textarea, Checkbox, Switch, FormField (generic).
 */

export function Field({ label, required, hint, error, span, className = '', children, htmlFor }) {
  const spanCls = span === 2 ? 'span-2' : span === 'full' ? 'span-full' : ''
  return (
    <div className={`field ${spanCls} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Input({ className = '', error, size, prefix, ...rest }) {
  const input = <input className={`input ${size === 'sm' ? 'input-sm' : ''} ${error ? 'has-error' : ''} ${className}`} {...rest} />
  if (prefix) {
    return (
      <div className="input-affix">
        <span className="affix-prefix">{prefix}</span>
        {input}
      </div>
    )
  }
  return input
}

/** options: array of strings | { value, label } */
export function Select({ options = [], placeholder, className = '', error, size, ...rest }) {
  return (
    <select className={`select ${size === 'sm' ? 'select-sm' : ''} ${error ? 'has-error' : ''} ${className}`} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o }
        return (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        )
      })}
    </select>
  )
}

export function Textarea({ className = '', rows = 3, ...rest }) {
  return <textarea className={`textarea ${className}`} rows={rows} {...rest} />
}

export function Checkbox({ label, checked, onChange, disabled, className = '', ...rest }) {
  return (
    <label className={`checkbox ${className}`}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} {...rest} />
      {label}
    </label>
  )
}

export function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} />
      <span className="track" />
      {label}
    </label>
  )
}

/**
 * Generic field renderer used by config-driven forms.
 * def: { name, label, type: text|number|email|tel|date|select|textarea|checkbox|switch, options, required, span, placeholder, hint, prefix, readOnly, min, step }
 */
export function FormField({ def, value, onChange, error }) {
  const common = {
    id: `f-${def.name}`,
    name: def.name,
    placeholder: def.placeholder,
    disabled: def.disabled,
    readOnly: def.readOnly,
  }
  let control
  switch (def.type) {
    case 'select':
      control = (
        <Select {...common} options={def.options || []} placeholder={def.placeholder ?? 'Select'} value={value ?? ''} error={error} onChange={(e) => onChange(e.target.value)} />
      )
      break
    case 'textarea':
      control = <Textarea {...common} rows={def.rows || 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      break
    case 'checkbox':
      control = <Checkbox label={def.checkboxLabel} checked={value} onChange={onChange} />
      break
    case 'switch':
      control = <Switch label={def.checkboxLabel} checked={value} onChange={onChange} />
      break
    case 'number':
      control = (
        <Input {...common} type="number" min={def.min ?? 0} step={def.step ?? 'any'} prefix={def.prefix} value={value ?? ''} error={error} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      )
      break
    default:
      control = <Input {...common} type={def.type || 'text'} prefix={def.prefix} value={value ?? ''} error={error} maxLength={def.maxLength} onChange={(e) => onChange(def.uppercase ? e.target.value.toUpperCase() : e.target.value)} />
  }
  return (
    <Field label={def.label} required={def.required} hint={def.hint} error={error} span={def.span} htmlFor={common.id}>
      {control}
    </Field>
  )
}

export default FormField
