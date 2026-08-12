import { useState } from 'react'
import { signup } from '../services/api.js'

// Signup page (Phase 7).
// Validates locally (name, email format, password length, confirm match),
// then asks the backend to create the account. On success it switches back
// to the login page with a confirmation message.
export default function SignupPage({ onSignupSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm({ ...form, [name]: value })
  }

  // Local validation - mirrors the backend rules (server checks again)
  function validate() {
    const validation = {}
    if (!form.name.trim()) validation.name = 'Full name is required.'
    if (!form.email.trim()) {
      validation.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      validation.email = 'Enter a valid email address.'
    }
    if (!form.password) {
      validation.password = 'Password is required.'
    } else if (form.password.length < 6) {
      validation.password = 'Password must contain at least 6 characters.'
    }
    if (!form.confirmPassword) {
      validation.confirmPassword = 'Please confirm your password.'
    } else if (form.confirmPassword !== form.password) {
      validation.confirmPassword = 'Passwords do not match.'
    }
    return validation
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const validation = validate()
    setErrors(validation)
    setFormError('')

    if (Object.keys(validation).length > 0) return

    setSubmitting(true)
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      onSignupSuccess()
    } catch (err) {
      // Server errors such as "Email is already registered." land here
      setFormError(err.message || 'Could not create the account.')
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
        <h2 className="auth-title">Create Account</h2>
        <p className="page-subtitle auth-subtitle">
          Sign up to manage your medications.
        </p>

        {formError && <p className="error-banner">{formError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              placeholder="e.g. Dhruv"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
            />
            {errors.name && <p className="error">{errors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <div className="field">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              name="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="error">{errors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button type="button" className="link-button" onClick={onSwitchToLogin}>
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
