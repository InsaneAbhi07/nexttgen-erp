/**
 * Role & permission matrix — frontend-only demo. Changes apply to the sidebar
 * and action buttons immediately (permissions are read from the mock store).
 */
import { useEffect, useMemo, useState } from 'react'
import { Lock, Plus, RotateCcw, Save, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { PERMISSION_MODULES, PERMISSION_TYPES } from '../../data/constants.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { Badge, Button, Callout, Card, Field, Input, Modal, PageHeader, Select, Textarea, useConfirm, useToast } from '../../components/ui/index.js'
import './roles.css'

const PERM_LABEL = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete', approve: 'Approve', print: 'Print', export: 'Export' }

const normalise = (perms = {}) =>
  Object.fromEntries(PERMISSION_MODULES.map((m) => [m, Object.fromEntries(PERMISSION_TYPES.map((p) => [p, Boolean(perms?.[m]?.[p])]))]))

const allOn = () => Object.fromEntries(PERMISSION_MODULES.map((m) => [m, Object.fromEntries(PERMISSION_TYPES.map((p) => [p, true]))]))

export default function RolesPage() {
  usePageTitle('Roles and permissions')
  const { state, patch, save, remove } = useErp()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState(() => state.roles.find((r) => r.name === 'Manager')?.id || state.roles[0]?.id)
  const role = state.roles.find((r) => r.id === selectedId) || state.roles[0]
  const locked = role?.name === 'Super Admin'
  const [draft, setDraft] = useState(() => (locked ? allOn() : normalise(role?.permissions)))
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(null)

  useEffect(() => {
    setDraft(role?.name === 'Super Admin' ? allOn() : normalise(role?.permissions))
  }, [role?.id, role?.permissions, role?.name])

  const dirty = useMemo(() => !locked && JSON.stringify(draft) !== JSON.stringify(normalise(role?.permissions)), [draft, role, locked])
  const canEdit = can('Users & Access', 'edit') && !locked
  const userCount = (name) => state.users.filter((u) => u.role === name).length

  const selectRole = async (id) => {
    if (id === selectedId) return
    if (dirty) {
      const ok = await confirm({ title: 'Discard unsaved changes?', message: `Permission changes for ${role.name} have not been saved.`, confirmLabel: 'Discard changes', tone: 'danger' })
      if (!ok) return
    }
    setSelectedId(id)
  }

  const setPerm = (module, perm, value) =>
    setDraft((d) => {
      const row = { ...d[module], [perm]: value }
      if (perm === 'view' && !value) PERMISSION_TYPES.forEach((p) => (row[p] = false))
      if (perm !== 'view' && value) row.view = true
      return { ...d, [module]: row }
    })

  const setRow = (module, value) => setDraft((d) => ({ ...d, [module]: Object.fromEntries(PERMISSION_TYPES.map((p) => [p, value])) }))

  const setColumn = (perm, value) =>
    setDraft((d) =>
      Object.fromEntries(
        PERMISSION_MODULES.map((m) => {
          const row = { ...d[m], [perm]: value }
          if (perm === 'view' && !value) PERMISSION_TYPES.forEach((p) => (row[p] = false))
          if (perm !== 'view' && value) row.view = true
          return [m, row]
        }),
      ),
    )

  const saveChanges = async () => {
    setSaving(true)
    await fakeDelay(400)
    patch('roles', role.id, { permissions: draft })
    setSaving(false)
    toast.success('Permissions saved', `${role.name} permissions are applied to ${userCount(role.name)} user(s).`)
  }

  const submitAdd = (e) => {
    e.preventDefault()
    const name = adding.name.trim()
    if (!name) return setAdding((a) => ({ ...a, error: 'Enter a role name' }))
    if (state.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) return setAdding((a) => ({ ...a, error: 'A role with this name already exists' }))
    const source = state.roles.find((r) => r.id === adding.copyFrom)
    const created = save('roles', {
      name,
      description: adding.description.trim(),
      system: false,
      permissions: source ? (source.name === 'Super Admin' ? allOn() : normalise(source.permissions)) : normalise({ Dashboard: { view: true } }),
    })
    setAdding(null)
    setSelectedId(created.id)
    toast.success('Role added', `${name} is ready. Adjust its permissions and save.`)
  }

  const deleteRole = async () => {
    if (userCount(role.name)) {
      toast.error('This role can’t be deleted', `${userCount(role.name)} user(s) are assigned to ${role.name}. Move them to another role first.`)
      return
    }
    const ok = await confirm({ title: 'Delete role?', message: `${role.name} will be removed. This can’t be undone.`, confirmLabel: 'Delete role', tone: 'danger' })
    if (!ok) return
    remove('roles', role.id)
    setSelectedId(state.roles.find((r) => r.id !== role.id)?.id)
    toast.success('Role deleted', role.name)
  }

  const enabledCount = PERMISSION_MODULES.reduce((a, m) => a + PERMISSION_TYPES.filter((p) => draft[m]?.[p]).length, 0)

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        subtitle="Decide what each role can view, create, change, approve, print and export."
        breadcrumbs={[{ label: 'Users & Access', to: '/users' }, { label: 'Roles and permissions' }]}
        actions={
          <>
            <Button icon={Users} to="/users">
              Users
            </Button>
            {can('Users & Access', 'add') && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding({ name: '', description: '', copyFrom: '', error: '' })}>
                Add role
              </Button>
            )}
          </>
        }
      />

      <div className="roles-layout">
        <Card title="Roles" subtitle={`${state.roles.length} roles`} flush>
          <div className="role-list">
            {state.roles.map((r) => (
              <button key={r.id} type="button" className={`role-item ${r.id === role?.id ? 'active' : ''}`} onClick={() => selectRole(r.id)}>
                <span className="row-between" style={{ width: '100%' }}>
                  <span className="strong">{r.name}</span>
                  <span className="tiny muted">{userCount(r.name)} users</span>
                </span>
                <span className="small muted">{r.description || 'No description'}</span>
              </button>
            ))}
          </div>
        </Card>

        {role && (
          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                <ShieldCheck size={16} /> {role.name}
                {locked && <Badge tone="brass"><Lock size={11} /> Locked</Badge>}
                {dirty && <Badge tone="amber" dot>Unsaved changes</Badge>}
              </span>
            }
            subtitle={`${enabledCount} of ${PERMISSION_MODULES.length * PERMISSION_TYPES.length} permissions enabled, ${userCount(role.name)} user(s) assigned`}
            actions={
              !role.system &&
              can('Users & Access', 'delete') && (
                <Button size="sm" variant="ghost" icon={Trash2} onClick={deleteRole} style={{ color: 'var(--red)' }}>
                  Delete role
                </Button>
              )
            }
            flush
            footer={
              canEdit && (
                <div className="row-between row-wrap">
                  <span className="small muted">Turning off View removes all other permissions for that module.</span>
                  <div className="row">
                    <Button icon={RotateCcw} disabled={!dirty || saving} onClick={() => setDraft(normalise(role.permissions))}>
                      Discard
                    </Button>
                    <Button variant="primary" icon={Save} disabled={!dirty} loading={saving} onClick={saveChanges}>
                      Save changes
                    </Button>
                  </div>
                </div>
              )
            }
          >
            {locked && (
              <div style={{ padding: '14px 16px 0' }}>
                <Callout tone="amber" icon={Lock}>
                  Super Admin always has full access so the company can never be locked out. Create a separate role for restricted admins.
                </Callout>
              </div>
            )}
            <div className="table-wrap">
              <table className="table perm-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    {PERMISSION_TYPES.map((p) => {
                      const checked = PERMISSION_MODULES.every((m) => draft[m]?.[p])
                      return (
                        <th key={p}>
                          <label className="perm-col-toggle">
                            <span>{PERM_LABEL[p]}</span>
                            <input type="checkbox" checked={checked} disabled={!canEdit} onChange={(e) => setColumn(p, e.target.checked)} aria-label={`${PERM_LABEL[p]} for all modules`} />
                          </label>
                        </th>
                      )
                    })}
                    <th>All</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((m) => {
                    const rowAll = PERMISSION_TYPES.every((p) => draft[m]?.[p])
                    return (
                      <tr key={m}>
                        <td className="cell-primary nowrap">{m}</td>
                        {PERMISSION_TYPES.map((p) => (
                          <td key={p}>
                            <input
                              type="checkbox"
                              className="perm-check"
                              checked={Boolean(draft[m]?.[p])}
                              disabled={!canEdit}
                              onChange={(e) => setPerm(m, p, e.target.checked)}
                              aria-label={`${PERM_LABEL[p]} ${m}`}
                            />
                          </td>
                        ))}
                        <td>
                          <input type="checkbox" className="perm-check" checked={rowAll} disabled={!canEdit} onChange={(e) => setRow(m, e.target.checked)} aria-label={`All permissions for ${m}`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        title="Add role"
        subtitle="Start from an existing role to save time"
        footer={
          <>
            <Button onClick={() => setAdding(null)}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-role-form">
              Add role
            </Button>
          </>
        }
      >
        {adding && (
          <form id="add-role-form" onSubmit={submitAdd} className="stack" noValidate>
            <Field label="Role name" required error={adding.error}>
              <Input value={adding.name} error={adding.error} placeholder="e.g. Quality Inspector" onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value, error: '' }))} autoFocus />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={adding.description} placeholder="What this role is responsible for" onChange={(e) => setAdding((a) => ({ ...a, description: e.target.value }))} />
            </Field>
            <Field label="Copy permissions from" hint="Leave empty to start with dashboard access only">
              <Select placeholder="Start from scratch" options={state.roles.map((r) => ({ value: r.id, label: r.name }))} value={adding.copyFrom} onChange={(e) => setAdding((a) => ({ ...a, copyFrom: e.target.value }))} />
            </Field>
          </form>
        )}
      </Modal>
    </>
  )
}
