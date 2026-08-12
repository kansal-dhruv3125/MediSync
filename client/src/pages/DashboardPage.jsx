import { useEffect, useState } from 'react'
import { getDashboardStats } from '../services/api.js'

// The Dashboard (Phase 5).
// Shows a quick overview built from REAL backend data:
//   - four summary cards: Total Medications, Today's Doses, Conflicts, Resolved
//   - a small schedule-status breakdown (pending / taken / skipped)
// All numbers come from GET /api/dashboard, which computes them from db.json.
export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load the statistics once when the page opens
  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    setError('')
    try {
      const data = await getDashboardStats()
      setStats(data)
    } catch (err) {
      setError(err.message || 'Unable to load the dashboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">
            Welcome back{user && user.name ? `, ${user.name}` : ''}. Here's an
            overview of your medications and today's schedule.
          </p>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {loading && <p className="status-message">Loading dashboard…</p>}

      {!loading && stats && (
        <>
          <div className="stats-grid">
            <StatCard
              icon="💊"
              label="Total Medications"
              value={stats.totalMedications}
            />
            <StatCard icon="🕐" label="Today's Doses" value={stats.todayDoses} />
            <StatCard
              icon="⚠"
              label="Conflicts"
              value={stats.conflicts}
              warn={stats.conflicts > 0}
            />
            <StatCard icon="✓" label="Resolved" value={stats.resolved} />
          </div>

          <div className="card">
            <h3 className="card-title">Schedule Status</h3>
            {stats.todayDoses === 0 ? (
              <p className="empty-message">No doses scheduled for today.</p>
            ) : (
              <div className="status-breakdown">
                <div className="status-item status-item-pending">
                  Pending <strong>{stats.pending}</strong>
                </div>
                <div className="status-item status-item-taken">
                  Taken <strong>{stats.taken}</strong>
                </div>
                <div className="status-item status-item-skipped">
                  Skipped <strong>{stats.skipped}</strong>
                </div>
              </div>
            )}
          </div>

          {stats.totalMedications === 0 && (
            <p className="empty-message">
              No medications added yet. Add one from the Medications tab.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// One summary card on the dashboard grid
function StatCard({ icon, label, value, warn }) {
  return (
    <div className={warn ? 'card stat-card stat-card-warn' : 'card stat-card'}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
