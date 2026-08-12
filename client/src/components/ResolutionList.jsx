// Renders the result of the automatic conflict resolution (Phase 4):
//   - a green confirmation when there was nothing to do
//   - one green "✓ Conflict Resolved" card per moved medication
//   - one amber "⚠ Conflict Could Not Be Resolved" card per failed move
import { formatMinutes } from './ConflictList.jsx'

export default function ResolutionList({
  resolvedConflicts,
  unresolvedConflicts,
  message,
}) {
  const total = resolvedConflicts.length + unresolvedConflicts.length

  if (total === 0) {
    return (
      <div className="card conflict-panel conflict-none">
        <p className="conflict-clear">
          ✓ {message || 'No conflicts require resolution.'}
        </p>
      </div>
    )
  }

  return (
    <div className="resolution-list">
      {resolvedConflicts.map((conflict, index) => (
        <article
          className="card resolution-entry resolution-resolved"
          key={`resolved-${index}`}
        >
          <div className="conflict-entry-head">
            <span className="conflict-icon">✓</span>
            <h3 className="conflict-title">Conflict Resolved</h3>
            <span className={`severity-badge severity-${conflict.severity}`}>
              {conflict.severity}
            </span>
          </div>

          <p className="conflict-med">{conflict.medicationB}</p>

          <div className="resolution-times">
            <span>
              Original time: <strong>{conflict.originalTime}</strong>
            </span>
            <span className="resolution-arrow">→</span>
            <span className="resolution-new">
              New time: <strong>{conflict.newTime}</strong>
            </span>
          </div>

          <p className="resolution-reason">
            Reason: Minimum spacing requirement (
            {formatMinutes(conflict.requiredSpacing)})
          </p>
          <p className="conflict-message">{conflict.message}</p>
        </article>
      ))}

      {unresolvedConflicts.map((conflict, index) => (
        <article
          className="card resolution-entry resolution-unresolved"
          key={`unresolved-${index}`}
        >
          <div className="conflict-entry-head">
            <span className="conflict-icon">⚠</span>
            <h3 className="conflict-title">Conflict Could Not Be Resolved</h3>
            <span className={`severity-badge severity-${conflict.severity}`}>
              {conflict.severity}
            </span>
          </div>

          <p className="conflict-med">{conflict.medicationB}</p>
          <p className="conflict-message">
            No valid time slot was found within the day. The medication was
            left at its original time ({conflict.originalTime}).
          </p>
        </article>
      ))}
    </div>
  )
}
