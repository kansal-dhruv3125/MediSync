import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MedicationsPage from './pages/MedicationsPage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import { getMe, logout } from './services/api.js'

// Root component of the app (Phase 7 adds authentication).
//
// Logged out: only "Login" and "Signup" are shown - Dashboard, Medications
// and Daily Schedule are not rendered at all (route protection).
// Logged in: the main tabs (Dashboard / Medications / Daily Schedule) plus
// a Logout button. The session is restored from the token on refresh.
export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authView, setAuthView] = useState('login') // 'login' | 'signup'
  const [authNotice, setAuthNotice] = useState('')
  const [activePage, setActivePage] = useState('dashboard')

  // On startup, try to restore the session (GET /api/auth/me)
  useEffect(() => {
    getMe()
      .then((me) => {
        setUser(me)
        setActivePage('dashboard')
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // The token is cleared even if the server call fails
    }
    setUser(null)
    setActivePage('dashboard')
    setAuthView('login')
    setAuthNotice('')
  }

  // While the session is being restored, show a minimal loading state
  if (!authChecked) {
    return (
      <div className="app">
        <Header />
        <p className="status-message">Loading…</p>
      </div>
    )
  }

  // --- Logged out: only authentication pages --------------------------------
  if (!user) {
    return (
      <div className="app">
        <Header />
        <nav className="nav container">
          <button
            type="button"
            className={authView === 'login' ? 'nav-link active' : 'nav-link'}
            onClick={() => setAuthView('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={authView === 'signup' ? 'nav-link active' : 'nav-link'}
            onClick={() => setAuthView('signup')}
          >
            Signup
          </button>
        </nav>
        <main className="container">
          {authView === 'login' ? (
            <LoginPage
              notice={authNotice}
              onLoggedIn={(loggedInUser) => {
                setUser(loggedInUser)
                setActivePage('dashboard')
                setAuthNotice('')
              }}
              onSwitchToSignup={() => setAuthView('signup')}
            />
          ) : (
            <SignupPage
              onSignupSuccess={() => {
                setAuthNotice('Account created successfully. Please log in.')
                setAuthView('login')
              }}
              onSwitchToLogin={() => setAuthView('login')}
            />
          )}
        </main>
      </div>
    )
  }

  // --- Logged in: the main application --------------------------------------
  return (
    <div className="app">
      <Header />
      <nav className="nav container">
        <button
          type="button"
          className={activePage === 'dashboard' ? 'nav-link active' : 'nav-link'}
          onClick={() => setActivePage('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activePage === 'medications' ? 'nav-link active' : 'nav-link'}
          onClick={() => setActivePage('medications')}
        >
          Medications
        </button>
        <button
          type="button"
          className={activePage === 'schedule' ? 'nav-link active' : 'nav-link'}
          onClick={() => setActivePage('schedule')}
        >
          Daily Schedule
        </button>
        <button
          type="button"
          className="nav-link nav-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </nav>
      <main className="container">
        {activePage === 'dashboard' && <DashboardPage user={user} />}
        {activePage === 'medications' && <MedicationsPage />}
        {activePage === 'schedule' && <SchedulePage />}
      </main>
    </div>
  )
}
