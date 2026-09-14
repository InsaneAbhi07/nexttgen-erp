/**
 * Category, brand and unit masters — frontend-only demo (mock store).
 */
import CrudPage from '../../components/common/CrudPage.jsx'
import { StatusBadge } from '../../components/ui/index.js'
import { useErp } from '../../store/ErpStore.jsx'
import { num } from '../../utils/format.js'
import { mastersCrumbs } from './shared.jsx'

const uniqueName = (collection, label) => (v, s) => {
  const name = (v.name || '').trim().toLowerCase()
  return name && s[collection].some((r) => r.name.trim().toLowerCase() === name && r.id !== v.id) ? { name: `This ${label} already exists` } : {}
}

const usedGuard = (field, label) => (r, s) => {
  const n = s.items.filter((i) => i[field] === r.name).length
  return n ? `${n} item(s) use this ${label}. Move them to another ${label} or mark it inactive.` : null
}

const countCol = (state, field) => ({
  key: 'itemCount',
  header: 'Items',
  align: 'right',
  width: 90,
  accessor: (r) => state.items.filter((i) => i[field] === r.name).length,
  render: (r) => num(state.items.filter((i) => i[field] === r.name).length),
})

const STATUS_FIELD = { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true }

function NameDescriptionMaster({ collection, singular, title, subtitle, field, placeholder }) {
  const { state } = useErp()
  const label = singular.toLowerCase()
  return (
    <CrudPage
      collection={collection}
      singular={singular}
      title={title}
      subtitle={subtitle}
      breadcrumbs={mastersCrumbs(title)}
      formCols={1}
      fields={[
        { name: 'name', label: `${singular} name`, required: true, placeholder },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
        STATUS_FIELD,
      ]}
      columns={[
        { key: 'name', header: singular, render: (r) => <span className="cell-primary">{r.name}</span> },
        { key: 'description', header: 'Description', render: (r) => <span className="ink-2">{r.description || '—'}</span> },
        countCol(state, field),
        { key: 'status', header: 'Status', width: 110, render: (r) => <StatusBadge status={r.status} /> },
      ]}
      exportName={collection}
      initialSort={{ key: 'name', dir: 'asc' }}
      validate={uniqueName(collection, label)}
      beforeSave={(v) => ({ ...v, name: v.name.trim() })}
      deleteGuard={usedGuard(field, label)}
      viewFields={(r, s) => [
        { label: 'Name', value: r.name },
        { label: 'Items', value: num(s.items.filter((i) => i[field] === r.name).length) },
        { label: 'Description', value: r.description, span: 2 },
      ]}
    />
  )
}

export function CategoriesPage() {
  return (
    <NameDescriptionMaster
      collection="categories"
      singular="Category"
      title="Categories"
      subtitle="Group items for reporting, price lists and stock analysis."
      field="category"
      placeholder="e.g. Door Locks"
    />
  )
}

export function BrandsPage() {
  return (
    <NameDescriptionMaster
      collection="brands"
      singular="Brand"
      title="Brands"
      subtitle="House brands and traded brands the company buys or sells."
      field="brand"
      placeholder="e.g. Royal Guard"
    />
  )
}

export function UnitsPage() {
  const { state } = useErp()
  return (
    <CrudPage
      collection="units"
      singular="Unit"
      title="Units"
      subtitle="Units of measure used for stock, purchase and sales quantities."
      breadcrumbs={mastersCrumbs('Units')}
      formCols={1}
      fields={[
        { name: 'name', label: 'Unit code', required: true, placeholder: 'e.g. PCS', uppercase: true, maxLength: 8 },
        { name: 'description', label: 'Description', required: true, placeholder: 'e.g. Pieces' },
        { name: 'decimals', label: 'Decimal places', type: 'number', min: 0, step: 1, hint: 'Use 0 for pieces and 3 for kilograms' },
        STATUS_FIELD,
      ]}
      defaults={{ decimals: 0 }}
      columns={[
        { key: 'name', header: 'Unit', render: (r) => <span className="doc-no">{r.name}</span> },
        { key: 'description', header: 'Description' },
        { key: 'decimals', header: 'Decimal places', align: 'right', render: (r) => num(r.decimals) },
        countCol(state, 'unit'),
        { key: 'status', header: 'Status', width: 110, render: (r) => <StatusBadge status={r.status} /> },
      ]}
      exportName="units"
      titleOf={(r) => r.name}
      validate={(v, s) => {
        const e = uniqueName('units', 'unit')(v, s)
        if (Number(v.decimals) < 0 || Number(v.decimals) > 3) e.decimals = 'Use 0 to 3 decimal places'
        return e
      }}
      beforeSave={(v) => ({ ...v, name: v.name.trim().toUpperCase(), decimals: Number(v.decimals) || 0 })}
      deleteGuard={usedGuard('unit', 'unit')}
      viewFields={(r, s) => [
        { label: 'Unit code', value: r.name },
        { label: 'Description', value: r.description },
        { label: 'Decimal places', value: num(r.decimals) },
        { label: 'Items', value: num(s.items.filter((i) => i.unit === r.name).length) },
      ]}
    />
  )
}
