/**
 * Login — mock authentication against demo users in the local store.
 */
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Factory, IndianRupee, Lock, Mail, Receipt, ShoppingCart } from 'lucide-react'
import { useAuth, DEMO_ACCOUNTS, DEMO_PASSWORD } from '../store/AuthContext.jsx'
import { useErp } from '../store/ErpStore.jsx'
import { totalReceivables } from '../store/selectors.js'
import { inrCompact, num, today } from '../utils/format.js'
import { usePageTitle, fakeDelay } from '../utils/hooks.js'
import { Button, Checkbox, Field, useToast } from '../components/ui/index.js'
import BrandMark from '../components/layout/BrandMark.jsx'
import FlowRail from '../components/common/FlowRail.jsx'
import './login.css'

export default function LoginPage() {
  usePageTitle('Sign in')
  const { login, isAuthenticated } = useAuth()
  const { state } = useErp()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [email, setEmail] = useState('admin@nexttgen.com')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const t = today()
  const todaySales = state.salesInvoices.filter((i) => i.date === t).reduce((a, i) => a + i.totals.grandTotal, 0)
  const todayProduction = state.productionEntries.filter((e) => e.date === t).reduce((a, e) => a + Number(e.producedQty), 0)
  const openPOs = state.purchaseOrders.filter((p) => ['Submitted', 'Approved', 'Partially Received'].includes(p.status)).length

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!email.trim()) errs.email = 'Enter your email or username'
    if (!password) errs.password = 'Enter your password'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    await fakeDelay(650)
    const res = login(email, password, remember)
    setLoading(false)
    if (!res.ok) {
      setErrors({ [res.field]: res.error })
      return
    }
    toast.success(`Welcome back, ${res.user.name.split(' ')[0]}`, `Signed in as ${res.user.role}.`)
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return (
    <div className="login-shell">
      <section className="login-visual" aria-hidden>
        <div className="login-brand">
          <BrandMark size={38} />
          <div>
            <div className="login-brand-name">
              NexttGen <b>ERP</b>
            </div>
            <div className="login-brand-sub">Manufacturing &amp; Trading Management System</div>
          </div>
        </div>

        <div className="login-copy">
          <h1>Purchase, production, sales and accounts on one line.</h1>
          <p>Track every lock body, shackle and invoice from supplier gate to customer receipt.</p>
        </div>

        <div className="login-plant">
          <div className="login-plant-head">
            <span>Today at the Aligarh plant</span>
            <span className="login-live">Sample data</span>
          </div>
          <FlowRail
            dark
            compact
            steps={[
              { key: 'p', label: 'Purchase', value: `${openPOs} open POs`, icon: ShoppingCart },
              { key: 'm', label: 'Production', value: `${num(todayProduction)} units`, icon: Factory },
              { key: 's', label: 'Sales', value: inrCompact(todaySales), icon: Receipt },
              { key: 'a', label: 'Receivables', value: inrCompact(totalReceivables(state)), icon: IndianRupee },
            ]}
          />
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-mobile-brand">
            <BrandMark size={34} />
            <span className="strong" style={{ fontSize: 16 }}>NexttGen ERP</span>
          </div>
          <h2 className="login-title">Sign in to your workspace</h2>
          <p className="muted" style={{ marginBottom: 22 }}>Use a demo account below or your email and password.</p>

          <div className="stack" style={{ gap: 14 }}>
            <Field label="Email or username" error={errors.email} htmlFor="login-email">
              <div className="input-group">
                <span className="input-icon"><Mail size={15} /></span>
                <input id="login-email" className={`input ${errors.email ? 'has-error' : ''}`} style={{ height: 40 }} type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </Field>
            <Field label="Password" error={errors.password} htmlFor="login-password">
              <div className="input-group">
                <span className="input-icon"><Lock size={15} /></span>
                <input id="login-password" className={`input ${errors.password ? 'has-error' : ''}`} style={{ height: 40, paddingRight: 40 }} type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="icon-btn" style={{ position: 'absolute', right: 3, width: 34, height: 34 }} onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <div className="row-between">
              <Checkbox label="Remember me" checked={remember} onChange={setRemember} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast.info('Password reset', 'Reset links are disabled in the demo. Use password demo123.')}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" variant="primary" size="lg" block loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>

          <div className="login-demo">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="strong small">Demo accounts</span>
              <span className="small muted">
                Password <span className="mono strong" style={{ color: 'var(--ink)' }}>{DEMO_PASSWORD}</span>
              </span>
            </div>
            <div className="login-demo-list">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className={`login-demo-item ${email === a.email ? 'active' : ''}`}
                  onClick={() => {
                    setEmail(a.email)
                    setPassword(DEMO_PASSWORD)
                    setErrors({})
                  }}
                >
                  <span className="small strong">{a.label}</span>
                  <span className="tiny muted">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="tiny muted" style={{ marginTop: 18, textAlign: 'center' }}>
            Demo build. No server is involved; all records are sample data stored in this browser.
          </p>
        </form>
      </section>
    </div>
  )
}
