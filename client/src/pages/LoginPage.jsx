import { useState } from 'react'
import { login } from '../services/api.js'

// Login page (Phase 7).
// Shown when the user is logged out. On success the session token is stored
// by api.js and onLoggedIn(user) tells App to switch to the main app.
export default function LoginPage({ onLoggedIn, onSwitchToSignup, notice = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    const validation = {}
    if (!email.trim()) validation.email = 'Email is required.'
    if (!password) validation.password = 'Password is required.'
    setErrors(validation)
    setFormError('')

    if (Object.keys(validation).length > 0) return

    setSubmitting(true)
    try {
      const data = await login({ email, password })
      onLoggedIn(data.user)
    } catch (err) {
      setFormError(err.message || 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <span className="auth-icon" aria-hidden="true">💊</span>
        <h1 className="auth-brand-name">MediSync</h1>
        <p className="auth-brand-subtitle">
          Medication Dosage &amp; Interaction Scheduler
        </p>
        <h2 className="auth-title">Welcome Back</h2>
        <p className="page-subtitle auth-subtitle">
          Sign in to manage your medications.
        </p>

        {notice && <p className="success-banner">{notice}</p>}
        {formError && <p className="error-banner">{formError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{' '}
          <button type="button" className="link-button" onClick={onSwitchToSignup}>
            Create account
          </button>
        </p>

        <p className="auth-hint">
          Demo account: demo@example.com · password 123456
        </p>
      </div>
    </div>
  )
}
