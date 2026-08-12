// Renders every medication as a clean card with Edit and Delete buttons.
export default function MedicationList({ medications, onEdit, onDelete }) {
  // Show a friendly message when the list is empty
  if (medications.length === 0) {
    return <p className="empty-message">No medications yet. Add your first one above.</p>
  }

  return (
    <div className="medication-list">
      {medications.map((medication) => (
        <article className="card medication-card" key={medication.id}>
          <div className="medication-info">
            <h3 className="medication-name">{medication.name}</h3>
            <p className="medication-dose">
              <strong>{medication.dose} {medication.unit}</strong>
            </p>
            <p className="medication-frequency">{medication.frequency}</p>
            <p className="medication-times">
              {medication.preferredTimes.join(', ')}
            </p>
          </div>
          <div className="medication-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onEdit(medication)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete(medication)}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
