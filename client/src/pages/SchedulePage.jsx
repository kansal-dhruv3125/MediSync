import { useEffect, useState } from 'react'
import ScheduleList from '../components/ScheduleList.jsx'
import ConflictList from '../components/ConflictList.jsx'
import ResolutionList from '../components/ResolutionList.jsx'
import {
  getSchedule,
  generateSchedule,
  getScheduleConflicts,
  resolveScheduleConflicts,
  updateScheduleStatus,
} from '../services/api.js'

// The Daily Schedule page.
// Responsibilities:
//   - show the current schedule (loaded from /api/schedule)
//   - "Generate Today's Schedule" button calls /api/schedule/generate
//     and shows the returned schedule
//   - "Check for Conflicts" compares the schedule against the interaction
//     rules (GET /api/schedule/conflicts) and shows the result
//   - "Resolve Conflicts" runs the automatic resolution algorithm
//     (POST /api/schedule/resolve) and shows what changed
//   - "Mark Taken" / "Skip" update an entry's status
//     (PATCH /api/schedule/:id/status) (Phase 5)
export default function SchedulePage() {
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [conflicts, setConflicts] = useState([])
  const [checking, setChecking] = useState(false)

  const [resolution, setResolution] = useState(null)
  const [resolving, setResolving] = useState(false)

  const [updatingId, setUpdatingId] = useState(null)

  // Load the existing schedule (and check it) once when the page opens
  useEffect(() => {
    loadSchedule()
    checkConflicts()
  }, [])

  async function loadSchedule() {
    setLoading(true)
    setError('')
    try {
      const data = await getSchedule()
      setSchedule(data)
    } catch (err) {
      setError(err.message || 'Could not load the schedule.')
    } finally {
      setLoading(false)
    }
  }

  // Ask the backend to rebuild today's schedule from the medications
  async function handleGenerate() {
    setGenerating(true)
    setError('')
    // A fresh schedule starts from the medications' preferred times
    setResolution(null)
    try {
      const data = await generateSchedule()
      setSchedule(data)
    } catch (err) {
      setError(err.message || 'Could not generate the schedule.')
    } finally {
      setGenerating(false)
    }
    // A new schedule may create or remove conflicts - re-check it
    checkConflicts()
  }

  // Ask the backend to run the automatic conflict-resolution algorithm
  async function handleResolve() {
    setResolving(true)
    setError('')
    try {
      const data = await resolveScheduleConflicts()
      setSchedule(data.schedule)
      setResolution(data)
    } catch (err) {
      setError(err.message || 'Could not resolve conflicts.')
    } finally {
      setResolving(false)
    }
    // The schedule changed, so the conflict list must reflect the new state
    checkConflicts()
  }

  // Ask the backend to compare the schedule against the interaction rules
  async function checkConflicts() {
    setChecking(true)
    try {
      const data = await getScheduleConflicts()
      setConflicts(data)
    } catch (err) {
      setError(err.message || 'Could not check for conflicts.')
    } finally {
      setChecking(false)
    }
  }

  // Mark a dose as taken or skipped (PATCH /api/schedule/:id/status)
  async function handleUpdateStatus(entry, status) {
    setUpdatingId(entry.id)
    setError('')
    try {
      await updateScheduleStatus(entry.id, status)
      // Update the entry locally - the change is already persisted on the
      // backend, so it survives a page refresh
      setSchedule((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status } : e))
      )
    } catch (err) {
      setError(err.message || 'Could not update the status. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Summary numbers for the conflict section. "Conflicts detected" is always
  // live from the latest check. Resolved / Unresolved come from the last
  // resolution run and default to 0 so the summary always shows all three
  // numbers consistently.
  const resolvedCount = resolution ? resolution.resolvedConflicts.length : 0
  const unresolvedCount = resolution ? resolution.unresolvedConflicts.length : 0

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2 className="page-title">Today's Schedule</h2>
          <p className="page-subtitle">
            Built automatically from your medications' preferred times.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating…' : "Generate Today's Schedule"}
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading && <p className="status-message">Loading schedule…</p>}

      {!loading && (
        <ScheduleList
          schedule={schedule}
          conflicts={conflicts}
          onUpdateStatus={handleUpdateStatus}
          updatingId={updatingId}
        />
      )}

      {/* The interaction check only makes sense once a schedule exists */}
      {!loading && schedule.length > 0 && (
        <section className="conflict-section">
          <div className="page-heading conflict-heading">
            <div>
              <h2 className="page-title">Interaction Check</h2>
              <p className="page-subtitle">
                Checks today's schedule against the interaction rules.
              </p>
            </div>
            <div className="conflict-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={checkConflicts}
                disabled={checking}
              >
                {checking ? 'Checking…' : 'Check for Conflicts'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResolve}
                disabled={resolving}
              >
                {resolving ? 'Resolving…' : 'Resolve Conflicts'}
              </button>
            </div>
          </div>

          {/* Phase 5: small conflict summary - always shows all three numbers */}
          <div className="conflict-summary">
            <span>
              Conflicts detected: <strong>{conflicts.length}</strong>
            </span>
            <span>
              Resolved: <strong>{resolvedCount}</strong>
            </span>
            <span>
              Unresolved: <strong>{unresolvedCount}</strong>
            </span>
          </div>
          {unresolvedCount > 0 && (
            <p className="unresolved-banner">
              ⚠ {unresolvedCount} conflict
              {unresolvedCount > 1 ? 's' : ''} could not be automatically
              resolved.
            </p>
          )}

          {checking && <p className="status-message">Checking for conflicts…</p>}
          {!checking && <ConflictList conflicts={conflicts} />}

          {/* Phase 4: the result of the automatic conflict resolution */}
          {resolution && (
            <div className="resolution-section">
              <h2 className="page-title resolution-title">Resolution Result</h2>
              <ResolutionList
                resolvedConflicts={resolution.resolvedConflicts}
                unresolvedConflicts={resolution.unresolvedConflicts}
                message={resolution.message}
              />
            </div>
          )}
        </section>
      )}

      <p className="disclaimer">
        This is an educational medication scheduling project. Demonstration
        interaction rules are fictional and should not be used for real
        medical decisions. Consult a qualified healthcare professional for
        medication advice.
      </p>
    </div>
  )
}
