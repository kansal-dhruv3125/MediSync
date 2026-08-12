// Renders the result of the interaction check:
//   - a green confirmation when there are no conflicts
//   - one warning card for every detected conflict
export default function ConflictList({ conflicts }) {
  if (conflicts.length === 0) {
    return (
      <div className="card conflict-panel conflict-none">
        <p className="conflict-clear">✓ No scheduling conflicts detected.</p>
      </div>
    )
  }

  return (
    <div className="conflict-list">
      {conflicts.map((conflict, index) => (
        <article className="card conflict-entry" key={index}>
          <div className="conflict-entry-head">
            <span className="conflict-icon">⚠</span>
            <h3 className="conflict-title">Scheduling Conflict</h3>
            <span className={`severity-badge severity-${conflict.severity}`}>
              {conflict.severity}
            </span>
          </div>

          <div className="conflict-pair">
            <span className="conflict-med">
              {conflict.medicationA} — {conflict.timeA}
            </span>
            <span className="conflict-med">
              {conflict.medicationB} — {conflict.timeB}
            </span>
          </div>

          <p className="conflict-spacing">
            Required spacing:{' '}
            <strong>{formatMinutes(conflict.requiredSpacing)}</strong>
            {' · '}Actual spacing:{' '}
            <strong>{formatMinutes(conflict.actualSpacing)}</strong>
          </p>

          <p className="conflict-message">{conflict.message}</p>
          <p className="conflict-status">Status: Conflict detected</p>
        </article>
      ))}
    </div>
  )
}

// Turns minutes into a friendly label: 180 -> "3 hours", 60 -> "1 hour"
// Exported so the resolution list can show the same spacing labels.
export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hourLabel = `${hours} hour${hours > 1 ? 's' : ''}`
  return rest === 0 ? hourLabel : `${hourLabel} ${rest} minutes`
}
