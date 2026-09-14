/**
 * My profile — frontend-only demo. Profile, password and preferences are saved in the mock store.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Check, History, KeyRound, LogOut, Save, UserRound, X } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { DEPARTMENTS } from '../../data/constants.js'
import { usePageTitle, fakeDelay } from '../../utils/hooks.js'
import { fmtDateTime, timeAgo } from '../../utils/format.js'
import { Avatar, Badge, Button, Callout, Card, DataTable, FormField, PageHeader, Progress, StatusBadge, Switch, Tabs, useToast } from '../../components/ui/index.js'
import { formatMobile, validEmail, validMobile } from '../masters/shared.jsx'
import './general.css'

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'security', label: 'Password', icon: KeyRound },
  { key: 'notifications', label: 'Notification preferences', icon: Bell },
  { key: 'activity', label: 'Login activity', icon: History },
]

export default function ProfilePage() {
  usePageTitle('My profile')
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'profile'

  if (!user) return null
  return (
    <>
      <PageHeader title="My profile" subtitle="Your account details, password and alerts." breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'My profile' }]} />

      <div className="card card-body profile-head mb-16">
        <Avatar name={user.name} size="lg" />
        <div className="grow">
          <div className="row row-wrap" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>{user.name}</h2>
            <Badge tone="brass">{user.role}</Badge>
            <StatusBadge status={user.status} />
          </div>
          <div className="small muted">
            {user.email}, {user.department}
          </div>
        </div>
        <div className="small muted">
          Last sign-in
          <div className="ink-2 strong">{user.lastLogin ? timeAgo(user.lastLogin) : 'Now'}</div>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={(k) => setParams({ tab: k })} style={{ marginBottom: 16 }} />
      {tab === 'profile' && <ProfileTab key={user.id} user={user} />}
      {tab === 'security' && <PasswordTab user={user} />}
      {tab === 'notifications' && <PreferencesTab />}
      {tab === 'activity' && <ActivityTab user={user} />}
    </>
  )
}

function ProfileTab({ user }) {
  const { state, patch } = useErp()
  const toast = useToast()
  const [values, setValues] = useState({ name: user.name, email: user.email, mobile: user.mobile, department: user.department })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!values.name.trim()) errs.name = 'Enter your name'
    if (!values.email || !validEmail(values.email)) errs.email = 'Enter a valid email address'
    else if (state.users.some((u) => u.email.toLowerCase() === values.email.trim().toLowerCase() && u.id !== user.id)) errs.email = 'Another user already uses this email'
    if (!validMobile(values.mobile)) errs.mobile = 'Enter a 10-digit Indian mobile number'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await fakeDelay(400)
    patch('users', user.id, { name: values.name.trim(), email: values.email.trim().toLowerCase(), mobile: formatMobile(values.mobile), department: values.department })
    setSaving(false)
    toast.success('Profile saved', 'Your details have been updated.')
  }

  return (
    <Card
      title="Profile information"
      subtitle="Your role is managed by an administrator"
      footer={
        <div className="form-actions">
          <Button variant="primary" icon={Save} type="submit" form="profile-form" loading={saving}>
            Save profile
          </Button>
        </div>
      }
    >
      <form id="profile-form" onSubmit={submit} noValidate className="form-grid cols-2" style={{ maxWidth: 760 }}>
        <FormField def={{ name: 'name', label: 'Full name', required: true }} value={values.name} error={errors.name} onChange={(v) => set('name', v)} />
        <FormField def={{ name: 'email', label: 'Email', type: 'email', required: true, hint: 'Also your sign-in username' }} value={values.email} error={errors.email} onChange={(v) => set('email', v)} />
        <FormField def={{ name: 'mobile', label: 'Mobile', type: 'tel', required: true }} value={values.mobile} error={errors.mobile} onChange={(v) => set('mobile', v)} />
        <FormField def={{ name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS, placeholder: undefined }} value={values.department} onChange={(v) => set('department', v)} />
        <FormField def={{ name: 'role', label: 'Role', readOnly: true }} value={user.role} onChange={() => {}} />
        <FormField def={{ name: 'createdAt', label: 'Member since', readOnly: true }} value={fmtDateTime(user.createdAt)} onChange={() => {}} />
      </form>
    </Card>
  )
}

function PasswordTab({ user }) {
  const { patch } = useErp()
  const toast = useToast()
  const [values, setValues] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const checks = [
    { label: 'At least 8 characters', ok: values.next.length >= 8 },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(values.next) },
    { label: 'A number', ok: /\d/.test(values.next) },
    { label: 'A symbol such as @ or #', ok: /[^A-Za-z0-9]/.test(values.next) },
  ]
  const score = checks.filter((c) => c.ok).length
  const strength = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score]

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (values.current !== (user.password || 'demo123')) errs.current = 'Current password is incorrect'
    if (values.next.length < 6) errs.next = 'Use at least 6 characters'
    else if (values.next === values.current) errs.next = 'Choose a password different from the current one'
    if (values.confirm !== values.next) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await fakeDelay(500)
    patch('users', user.id, { password: values.next }, { silent: true })
    setSaving(false)
    setValues({ current: '', next: '', confirm: '' })
    toast.success('Password changed', 'Use the new password the next time you sign in on this browser.')
  }

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card
        title="Change password"
        footer={
          <div className="form-actions">
            <Button variant="primary" icon={KeyRound} type="submit" form="password-form" loading={saving}>
              Change password
            </Button>
          </div>
        }
      >
        <form id="password-form" onSubmit={submit} noValidate className="form-grid cols-1">
          <FormField def={{ name: 'current', label: 'Current password', type: 'password', required: true }} value={values.current} error={errors.current} onChange={(v) => set('current', v)} />
          <FormField def={{ name: 'next', label: 'New password', type: 'password', required: true }} value={values.next} error={errors.next} onChange={(v) => set('next', v)} />
          {values.next && (
            <div className="stack-sm">
              <div className="row-between small">
                <span className="muted">Strength</span>
                <span className="strong">{strength}</span>
              </div>
              <Progress value={score * 25} tone={score <= 1 ? 'red' : score === 2 ? 'amber' : 'green'} />
            </div>
          )}
          <FormField def={{ name: 'confirm', label: 'Confirm new password', type: 'password', required: true }} value={values.confirm} error={errors.confirm} onChange={(v) => set('confirm', v)} />
        </form>
      </Card>
      <div className="stack">
        <Card title="A strong password has">
          <ul className="pw-checks">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'ok' : ''}>
                {c.ok ? <Check size={14} /> : <X size={14} />} {c.label}
              </li>
            ))}
          </ul>
        </Card>
        <Callout tone="gray">Demo accounts share the password demo123. A change here applies to this browser only.</Callout>
        <div>
          <Button icon={LogOut} onClick={() => toast.info('Other devices', 'In the live product this signs you out on every other device.')}>
            Sign out of other devices
          </Button>
        </div>
      </div>
    </div>
  )
}

const PREFS = [
  { key: 'lowStockAlerts', title: 'Low stock alerts', desc: 'When an item falls to or below its minimum stock' },
  { key: 'paymentReminders', title: 'Payment reminders', desc: 'Overdue customer invoices and supplier bills due this week' },
  { key: 'productionAlerts', title: 'Production updates', desc: 'Orders waiting for material issue and completed batches' },
  { key: 'emailAlerts', title: 'Email copies', desc: 'Also send important alerts to your email address' },
  { key: 'dailySummary', title: 'Daily summary', desc: 'Sales, purchase, production and cash position every evening at 7 PM' },
]

function PreferencesTab() {
  const { state, updateSettings } = useErp()
  const toast = useToast()
  const saved = state.settings.preferences || {}
  const [values, setValues] = useState(saved)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  const submit = async () => {
    setSaving(true)
    await fakeDelay(350)
    updateSettings('preferences', values)
    setSaving(false)
    toast.success('Preferences saved', 'Your notification settings have been updated.')
  }

  return (
    <Card
      title="Notification preferences"
      subtitle="Choose which alerts you receive"
      footer={
        <div className="form-actions">
          <Button variant="primary" icon={Save} disabled={!dirty} loading={saving} onClick={submit}>
            Save preferences
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 720 }}>
        <div className="pref-row">
          <div>
            <div className="strong">In-app notifications</div>
            <div className="small muted">Always on, shown in the bell menu</div>
          </div>
          <Switch checked disabled />
        </div>
        {PREFS.map((p) => (
          <div key={p.key} className="pref-row">
            <div>
              <div className="strong">{p.title}</div>
              <div className="small muted">{p.desc}</div>
            </div>
            <Switch checked={values[p.key]} onChange={(v) => setValues((s) => ({ ...s, [p.key]: v }))} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function ActivityTab({ user }) {
  const { state } = useErp()
  const rows = useMemo(() => state.loginActivity.filter((l) => l.userId === user.id).sort((a, b) => (a.at < b.at ? 1 : -1)), [state.loginActivity, user.id])
  return (
    <DataTable
      title="Login activity"
      subtitle="Sign-ins to your account from this and other devices"
      data={rows}
      exportName="login-activity"
      searchPlaceholder="Search device, IP or location…"
      emptyTitle="No sign-in activity yet"
      columns={[
        { key: 'at', header: 'Date and time', sortValue: (r) => r.at, render: (r) => <span className="nowrap">{fmtDateTime(r.at)}</span> },
        { key: 'device', header: 'Device' },
        { key: 'ip', header: 'IP address', render: (r) => <span className="mono small">{r.ip}</span> },
        { key: 'location', header: 'Location' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  )
}
