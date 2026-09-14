/**
 * CrudPage — config-driven list + add/edit drawer + view drawer for master data.
 * Frontend-only: records are saved to the mock store (localStorage).
 *
 * Props:
 *  collection, singular, title, subtitle, breadcrumbs
 *  fields:   [{ name, label, type, options | (state)=>options, required, span, placeholder, hint, section }]
 *  columns:  DataTable columns
 *  filters:  [{ key, label, options | (state)=>options, match?(row, value, state) }]
 *  defaults: object | (state)=>object          initial values for "Add"
 *  validate: (values, state) => { field: message }
 *  beforeSave: (values, state) => values
 *  viewFields: (row, state) => [{ label, value, span }]
 *  viewExtra:  (row, state) => node            extra content in the view drawer
 *  stats:      (rows, state) => [{ label, value, icon, tone, foot }]
 *  deleteGuard:(row, state) => string | null   reason why a record cannot be deleted
 *  titleOf:    (row) => string
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Button, DataTable, Drawer, FilterPanel, FormField, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../ui/index.js'

export default function CrudPage({
  collection,
  singular,
  title,
  subtitle,
  breadcrumbs,
  fields = [],
  columns = [],
  filters = [],
  defaults = {},
  validate,
  beforeSave,
  viewFields,
  viewExtra,
  stats,
  deleteGuard,
  titleOf = (r) => r.name || r.code || '',
  permissionModule = 'Masters',
  headerActions,
  searchPlaceholder,
  exportName,
  drawerSize = 'md',
  formCols = 2,
  initialSort,
}) {
  usePageTitle(title)
  const { state, save, remove, get } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [filterValues, setFilterValues] = useState({})
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const rows = state[collection] || []
  const viewId = params.get('view')
  const viewing = viewId ? get(collection, viewId) : null

  const openAdd = () => {
    const d = typeof defaults === 'function' ? defaults(state) : defaults
    setForm({ mode: 'add', values: { status: 'Active', ...d }, errors: {} })
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openAdd()
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const resolvedFilters = useMemo(
    () => filters.map((f) => ({ ...f, options: typeof f.options === 'function' ? f.options(state) : f.options })),
    [filters, state],
  )

  const data = useMemo(
    () =>
      rows.filter((r) =>
        resolvedFilters.every((f) => {
          const v = filterValues[f.key]
          if (!v) return true
          return f.match ? f.match(r, v, state) : String(r[f.key]) === String(v)
        }),
      ),
    [rows, resolvedFilters, filterValues, state],
  )

  const closeView = () => {
    const next = new URLSearchParams(params)
    next.delete('view')
    setParams(next, { replace: true })
  }
  const openView = (row) => {
    const next = new URLSearchParams(params)
    next.set('view', row.id)
    setParams(next)
  }
  const openEdit = (row) => {
    closeView()
    setForm({ mode: 'edit', values: { ...row }, errors: {} })
  }

  const setValue = (name, value) => setForm((f) => ({ ...f, values: { ...f.values, [name]: value }, errors: { ...f.errors, [name]: undefined } }))

  const submit = async (e) => {
    e.preventDefault()
    const errors = {}
    fields.forEach((f) => {
      if (f.visible && !f.visible(form.values)) return
      const v = form.values[f.name]
      if (f.required && (v === undefined || v === null || v === '')) errors[f.name] = `${f.type === 'select' ? 'Select' : 'Enter'} ${f.label.toLowerCase()}`
    })
    Object.assign(errors, validate?.(form.values, state, form.mode === 'edit' ? form.values.id : null) || {})
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
    if (Object.keys(clean).length) {
      setForm((f) => ({ ...f, errors: clean }))
      toast.error('Check the highlighted fields', `${Object.keys(clean).length} field(s) need attention.`)
      return
    }
    setSaving(true)
    await fakeDelay(350)
    const values = beforeSave ? beforeSave(form.values, state) : form.values
    const saved = save(collection, values)
    setSaving(false)
    setForm(null)
    toast.success(form.mode === 'add' ? `${singular} added` : `${singular} updated`, `${titleOf(saved)} ${form.mode === 'add' ? 'is now available across the ERP.' : 'has been saved.'}`)
  }

  const handleDelete = async (row) => {
    const reason = deleteGuard?.(row, state)
    if (reason) {
      toast.error(`This ${singular.toLowerCase()} can’t be deleted`, reason)
      return
    }
    const ok = await confirm({
      title: `Delete ${singular.toLowerCase()}?`,
      message: `${titleOf(row)} will be removed from the demo data. This can’t be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (ok) {
      closeView()
      remove(collection, row.id)
      toast.success(`${singular} deleted`, titleOf(row))
    }
  }

  const toggleStatus = (row) => {
    const status = row.status === 'Active' ? 'Inactive' : 'Active'
    save(collection, { ...row, status })
    toast.success(status === 'Active' ? `${singular} activated` : `${singular} deactivated`, titleOf(row))
  }

  const rowActions = (row) => [
    { label: 'View details', icon: Eye, onClick: () => openView(row) },
    can(permissionModule, 'edit') && { label: 'Edit', icon: Pencil, onClick: () => openEdit(row) },
    can(permissionModule, 'edit') && row.status && { label: row.status === 'Active' ? 'Deactivate' : 'Activate', icon: Power, onClick: () => toggleStatus(row) },
    can(permissionModule, 'delete') && { divider: true },
    can(permissionModule, 'delete') && { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(row) },
  ].filter(Boolean)

  const statCards = stats?.(rows, state)
  const visibleFields = form ? fields.filter((f) => !f.visible || f.visible(form.values)) : []
  let lastSection = null

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={
          <>
            {headerActions}
            {can(permissionModule, 'add') && (
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add {singular.toLowerCase()}
              </Button>
            )}
          </>
        }
      />

      {statCards?.length > 0 && (
        <div className={`grid-${Math.min(statCards.length, 4)} mb-16`}>
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        onRowClick={openView}
        rowActions={rowActions}
        exportName={exportName || collection}
        searchPlaceholder={searchPlaceholder || `Search ${title.toLowerCase()}…`}
        initialSort={initialSort}
        filters={
          resolvedFilters.length > 0 && (
            <FilterPanel filters={resolvedFilters} values={filterValues} onChange={(k, v) => setFilterValues((s) => ({ ...s, [k]: v }))} onReset={() => setFilterValues({})} />
          )
        }
        emptyTitle={`No ${title.toLowerCase()} yet`}
        emptyDescription={`Add your first ${singular.toLowerCase()} to start using it in transactions.`}
        emptyAction={can(permissionModule, 'add') && <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>Add {singular.toLowerCase()}</Button>}
      />

      {/* Add / Edit */}
      <Drawer
        open={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size={drawerSize}
        title={form?.mode === 'edit' ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
        subtitle={form?.mode === 'edit' ? titleOf(form.values) : 'Fields marked * are required'}
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="crud-form" loading={saving}>
              {form?.mode === 'edit' ? 'Save changes' : `Add ${singular.toLowerCase()}`}
            </Button>
          </>
        }
      >
        {form && (
          <form id="crud-form" onSubmit={submit} noValidate>
            <div className={`form-grid cols-${formCols}`}>
              {visibleFields.map((f) => {
                const def = { ...f, options: typeof f.options === 'function' ? f.options(state, form.values) : f.options }
                const header = f.section && f.section !== lastSection
                lastSection = f.section || lastSection
                return (
                  <FieldWithSection key={f.name} header={header ? f.section : null}>
                    <FormField def={def} value={form.values[f.name]} error={form.errors[f.name]} onChange={(v) => setValue(f.name, v)} />
                  </FieldWithSection>
                )
              })}
            </div>
          </form>
        )}
      </Drawer>

      {/* View */}
      <Drawer
        open={Boolean(viewing)}
        onClose={closeView}
        size={drawerSize}
        title={viewing ? titleOf(viewing) : ''}
        subtitle={viewing ? <span className="row" style={{ gap: 8, marginTop: 4 }}>{viewing.code && <span className="doc-no">{viewing.code}</span>}{viewing.status && <StatusBadge status={viewing.status} />}</span> : null}
        footer={
          viewing && (
            <>
              {can(permissionModule, 'delete') && (
                <Button variant="ghost" icon={Trash2} onClick={() => handleDelete(viewing)} style={{ marginRight: 'auto', color: 'var(--red)' }}>
                  Delete
                </Button>
              )}
              <Button onClick={closeView}>Close</Button>
              {can(permissionModule, 'edit') && (
                <Button variant="primary" icon={Pencil} onClick={() => openEdit(viewing)}>
                  Edit
                </Button>
              )}
            </>
          )
        }
      >
        {viewing && (
          <div className="stack">
            <KeyValue
              cols={2}
              items={
                viewFields
                  ? viewFields(viewing, state)
                  : fields.map((f) => ({ label: f.label, value: f.type === 'switch' || f.type === 'checkbox' ? (viewing[f.name] ? 'Yes' : 'No') : viewing[f.name], span: f.span === 'full' ? 2 : undefined }))
              }
            />
            {viewExtra?.(viewing, state)}
          </div>
        )}
      </Drawer>
    </>
  )
}

function FieldWithSection({ header, children }) {
  if (!header) return children
  return (
    <>
      <div className="span-full form-section-title" style={{ marginTop: 6, marginBottom: -4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        {header}
      </div>
      {children}
    </>
  )
}
