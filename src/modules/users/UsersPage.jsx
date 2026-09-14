/**
 * User management — frontend-only demo. New users sign in with password demo123.
 */
import { ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'
import CrudPage from '../../components/common/CrudPage.jsx'
import { Avatar, Badge, Button, StatusBadge } from '../../components/ui/index.js'
import { useAuth } from '../../store/AuthContext.jsx'
import { DEPARTMENTS, PERMISSION_MODULES } from '../../data/constants.js'
import { fmtDateTime, num, timeAgo } from '../../utils/format.js'
import { formatMobile, MiniTable, SectionTitle, validEmail, validMobile } from '../masters/shared.jsx'

const crumbs = [{ label: 'Users & Access', to: '/users' }, { label: 'Users' }]

export default function UsersPage() {
  const { user: me } = useAuth()

  return (
    <CrudPage
      collection="users"
      singular="User"
      title="Users"
      subtitle="People who can sign in to NexttGen ERP, with their role and department."
      breadcrumbs={crumbs}
      permissionModule="Users & Access"
      headerActions={
        <Button icon={ShieldCheck} to="/users/roles">
          Roles and permissions
        </Button>
      }
      fields={[
        { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Priya Saxena' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@nexttgen.com' },
        { name: 'mobile', label: 'Mobile', type: 'tel', required: true, placeholder: '+91 98970 12345' },
        { name: 'role', label: 'Role', type: 'select', required: true, options: (s) => s.roles.map((r) => r.name) },
        { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true },
      ]}
      defaults={{ role: 'Employee', department: 'Operations' }}
      columns={[
        {
          key: 'name',
          header: 'User',
          accessor: (r) => `${r.name} ${r.email}`,
          sortValue: (r) => r.name,
          render: (r) => (
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={r.name} size="sm" />
              <div>
                <div className="cell-primary">
                  {r.name} {r.id === me?.id && <Badge tone="blue">You</Badge>}
                </div>
                <div className="cell-secondary">{r.email}</div>
              </div>
            </div>
          ),
        },
        { key: 'mobile', header: 'Mobile', render: (r) => <span className="nowrap">{r.mobile}</span> },
        { key: 'role', header: 'Role', render: (r) => <Badge tone={r.role === 'Super Admin' ? 'brass' : r.role === 'Admin' || r.role === 'Manager' ? 'violet' : 'blue'}>{r.role}</Badge> },
        { key: 'department', header: 'Department' },
        { key: 'lastLogin', header: 'Last sign-in', render: (r) => <span title={fmtDateTime(r.lastLogin)}>{timeAgo(r.lastLogin)}</span> },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      filters={[
        { key: 'role', label: 'Roles', options: (s) => s.roles.map((r) => r.name) },
        { key: 'department', label: 'Departments', options: DEPARTMENTS },
        { key: 'status', label: 'Statuses', options: ['Active', 'Inactive'] },
      ]}
      exportName="users"
      initialSort={{ key: 'name', dir: 'asc' }}
      stats={(rows, s) => [
        { label: 'Total users', value: num(rows.length), icon: Users, tone: 'blue', foot: `${new Set(rows.map((r) => r.department)).size} departments` },
        { label: 'Active', value: num(rows.filter((r) => r.status === 'Active').length), icon: UserCheck, tone: 'green', foot: 'Can sign in' },
        { label: 'Inactive', value: num(rows.filter((r) => r.status !== 'Active').length), icon: UserX, tone: 'gray', foot: 'Access disabled' },
        { label: 'Roles', value: num(s.roles.length), icon: ShieldCheck, tone: 'violet', foot: 'Manage permissions', to: '/users/roles' },
      ]}
      validate={(v, s) => {
        const e = {}
        const email = (v.email || '').trim().toLowerCase()
        if (!validEmail(email)) e.email = 'Enter a valid email address'
        else if (s.users.some((u) => u.email.toLowerCase() === email && u.id !== v.id)) e.email = 'Another user already uses this email'
        if (v.mobile && !validMobile(v.mobile)) e.mobile = 'Enter a 10-digit Indian mobile number'
        if (v.id === me?.id && v.status !== 'Active') e.status = 'You cannot deactivate your own account'
        if (v.id === me?.id && v.role !== me.role && me.role === 'Super Admin' && s.users.filter((u) => u.role === 'Super Admin' && u.status === 'Active').length === 1) e.role = 'At least one active Super Admin is required'
        return e
      }}
      beforeSave={(v) => ({
        password: 'demo123',
        lastLogin: null,
        ...v,
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        mobile: formatMobile(v.mobile),
      })}
      deleteGuard={(r, s) => {
        if (r.id === me?.id) return 'You are signed in as this user.'
        if (r.role === 'Super Admin' && s.users.filter((u) => u.role === 'Super Admin').length === 1) return 'At least one Super Admin must remain.'
        return null
      }}
      viewFields={(r) => [
        { label: 'Email', value: r.email },
        { label: 'Mobile', value: r.mobile },
        { label: 'Role', value: r.role },
        { label: 'Department', value: r.department },
        { label: 'Last sign-in', value: r.lastLogin ? fmtDateTime(r.lastLogin) : 'Never' },
        { label: 'Created', value: fmtDateTime(r.createdAt) },
      ]}
      viewExtra={(r, s) => {
        const role = s.roles.find((x) => x.name === r.role)
        const modules = PERMISSION_MODULES.filter((m) => r.role === 'Super Admin' || role?.permissions?.[m]?.view)
        const logins = s.loginActivity.filter((l) => l.userId === r.id).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 5)
        return (
          <>
            <div>
              <SectionTitle action={<Button size="sm" variant="ghost" to="/users/roles">Edit role</Button>}>Module access</SectionTitle>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {modules.length ? modules.map((m) => <Badge key={m} tone="blue">{m}</Badge>) : <span className="muted small">No modules assigned</span>}
              </div>
            </div>
            <div>
              <SectionTitle>Recent sign-ins</SectionTitle>
              <MiniTable
                empty="No sign-in activity yet."
                rows={logins}
                columns={[
                  { header: 'When', render: (l) => fmtDateTime(l.at) },
                  { header: 'Device', render: (l) => l.device },
                  { header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
                ]}
              />
            </div>
          </>
        )
      }}
    />
  )
}
