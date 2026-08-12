// Renders the daily schedule as a simple vertical timeline (Phase 5).
// Each entry shows:
//   - its time and medication + dose
//   - a status badge: ○ Pending / ✓ Taken / — Skipped / ↻ Rescheduled /
//     ⚠ Conflict (when the entry is part of a detected conflict)
//   - "Mark Taken" / "Skip" buttons for pending entries
//   - a "Rescheduled from …" note when the Phase 4 resolver moved it
export default function ScheduleList({
  schedule,
  conflicts = [],
  onUpdateStatus,
  updatingId,
}) {
  if (schedule.length === 0) {
    return (
      <div className="card">
        <p className="empty-message">
          No doses scheduled for today. Click "Generate Today's Schedule" to
          build it from your medications.
        </p>
      </div>
    )
  }

  // Medication@time keys of every entry currently involved in a conflict,
  // so conflicting entries can be flagged directly on the timeline
  const conflictKeys = new Set()
  for (const conflict of conflicts) {
    conflictKeys.add(`${conflict.medicationA}@${conflict.timeA}`)
    conflictKeys.add(`${conflict.medicationB}@${conflict.timeB}`)
  }

  return (
    <div className="schedule-list">
      {schedule.map((entry, index) => {
        const inConflict = conflictKeys.has(
          `${entry.medicationName}@${entry.scheduledTime}`
        )
        const isUpdating = updatingId === entry.id

        return (
          <article
            className="card schedule-entry"
            // Entries always have an id (Phase 5); the fallback keeps older
            // persisted data rendering correctly too
            key={entry.id ?? `${entry.medicationId}-${entry.scheduledTime}-${index}`}
          >
            <div className="schedule-time">{entry.scheduledTime}</div>
            <div className="schedule-info">
              <h3 className="schedule-name">{entry.medicationName}</h3>
              <p className="schedule-dose">
                {entry.dose} {entry.unit}
              </p>
              {/* Phase 4 + 5: show what the resolver changed for this dose */}
              {entry.rescheduled && entry.originalTime && (
                <div className="schedule-notes">
                  <p className="schedule-note">
                    ↻ Rescheduled from {entry.originalTime}
                  </p>
                  <p className="schedule-note schedule-note-ok">
                    ✓ Conflict resolved
                  </p>
                </div>
              )}
            </div>
            <div className="schedule-side">
              <span
                className={
                  inConflict
                    ? 'status-badge status-conflict'
                    : `status-badge ${badgeClass(entry)}`
                }
              >
                {inConflict ? '⚠ Conflict' : badgeText(entry)}
              </span>

              {entry.status === 'pending' && onUpdateStatus && (
                <div className="status-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-taken"
                    onClick={() => onUpdateStatus(entry, 'taken')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating…' : 'Mark Taken'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-skip"
                    onClick={() => onUpdateStatus(entry, 'skipped')}
                    disabled={isUpdating}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

// The badge text for an entry that is not part of a conflict.
// Precedence: rescheduled (a Phase 4 move) overrides the plain status.
function badgeText(entry) {
  if (entry.rescheduled) return '↻ Rescheduled'
  switch (entry.status) {
    case 'taken':
      return '✓ Taken'
    case 'skipped':
      return '— Skipped'
    default:
      return '○ Pending'
  }
}

function badgeClass(entry) {
  if (entry.rescheduled) return 'status-rescheduled'
  if (entry.status === 'taken') return 'status-taken'
  if (entry.status === 'skipped') return 'status-skipped'
  return ''
}
