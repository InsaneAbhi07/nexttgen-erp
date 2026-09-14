/**
 * Mock authentication (frontend-only demo).
 * Users come from the local mock store; the password for every demo user is "demo123".
 * The session is kept in localStorage ("Remember me") or sessionStorage.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useErp, readSession, SESSION_KEY } from './ErpStore.jsx'

const AuthContext = createContext(null)

export const DEMO_ACCOUNTS = [
  { label: 'Owner / Super Admin', email: 'admin@nexttgen.com' },
  { label: 'Manager', email: 'manager@nexttgen.com' },
  { label: 'Accountant', email: 'accounts@nexttgen.com' },
  { label: 'Sales User', email: 'sales@nexttgen.com' },
]
export const DEMO_PASSWORD = 'demo123'

export function AuthProvider({ children }) {
  const { state, save, patch } = useErp()
  const [session, setSession] = useState(readSession)

  const user = useMemo(
    () => (session ? state.users.find((u) => u.id === session.userId && u.status === 'Active') || null : null),
    [session, state.users],
  )

  const role = useMemo(() => state.roles.find((r) => r.name === user?.role) || null, [state.roles, user])

  const login = useCallback(
    (identifier, password, remember = true) => {
      const id = String(identifier || '').trim().toLowerCase()
      const found = state.users.find((u) => u.email.toLowerCase() === id || u.email.split('@')[0].toLowerCase() === id)
      if (!found) return { ok: false, field: 'email', error: 'No account found for this email or username.' }
      if (found.status !== 'Active') return { ok: false, field: 'email', error: 'This account is inactive. Ask your administrator to activate it.' }
      if (password !== (found.password || DEMO_PASSWORD)) {
        save('loginActivity', { userId: found.id, at: new Date().toISOString(), device: navigator.userAgent.includes('Mobile') ? 'Mobile browser' : 'Desktop browser', ip: '49.36.112.18', location: 'Aligarh, Uttar Pradesh', status: 'Failed' }, { silent: true })
        return { ok: false, field: 'password', error: 'Incorrect password. The demo password is demo123.' }
      }
      const payload = JSON.stringify({ userId: found.id, at: new Date().toISOString() })
      try {
        localStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_KEY)
        ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, payload)
      } catch {
        /* storage unavailable – session only in memory */
      }
      setSession({ userId: found.id })
      save('loginActivity', { userId: found.id, at: new Date().toISOString(), device: navigator.userAgent.includes('Mobile') ? 'Mobile browser' : 'Chrome on Windows', ip: '49.36.112.18', location: 'Aligarh, Uttar Pradesh', status: 'Success' }, { silent: true })
      patch('users', found.id, { lastLogin: new Date().toISOString() }, { silent: true })
      return { ok: true, user: found }
    },
    [state.users, save, patch],
  )

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setSession(null)
  }, [])

  /** can('Sales', 'add') — permission check from the role matrix */
  const can = useCallback(
    (module, perm = 'view') => {
      if (!user) return false
      if (user.role === 'Super Admin') return true
      return Boolean(role?.permissions?.[module]?.[perm])
    },
    [user, role],
  )

  const value = useMemo(() => ({ user, role, login, logout, can, isAuthenticated: Boolean(user) }), [user, role, login, logout, can])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
