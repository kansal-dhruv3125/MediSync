import { useEffect, useState } from 'react'
import MedicationForm from '../components/MedicationForm.jsx'
import MedicationList from '../components/MedicationList.jsx'
import { getMedications, addMedication, updateMedication, deleteMedication } from '../services/api.js'

// The Medications page.
// Responsibilities:
//   - load medications from JSON Server when the page opens
//   - show the add/edit form and the list
//   - call the api.js functions for add, update and delete
export default function MedicationsPage() {
  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingMedication, setEditingMedication] = useState(null)
  const [actionError, setActionError] = useState('')

  // Load all medications once when the page mounts
  useEffect(() => {
    loadMedications()
  }, [])

  async function loadMedications() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getMedications()
      setMedications(data)
    } catch {
      setLoadError('Unable to load your medications. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Called by the form after a successful validation (adding)
  async function handleAdd(medication) {
    setActionError('')
    try {
      await addMedication(medication)
      await loadMedications()
      setShowForm(false)
    } catch {
      setActionError('Could not save the medication. Please try again.')
    }
  }

  // Called by the form after a successful validation (editing)
  async function handleUpdate(medication) {
    setActionError('')
    try {
      await updateMedication(editingMedication.id, medication)
      await loadMedications()
      setEditingMedication(null)
      setShowForm(false)
    } catch {
      setActionError('Could not update the medication. Please try again.')
    }
  }

  // Opens the form in edit mode with the selected medication
  function handleEdit(medication) {
    setEditingMedication(medication)
    setShowForm(true)
    setActionError('')
  }

  // Deletes a medication after a simple confirmation
  async function handleDelete(medication) {
    const confirmed = window.confirm(
      `Delete "${medication.name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    setActionError('')
    try {
      await deleteMedication(medication.id)
      // If the deleted medication was open in the edit form, close the form
      if (editingMedication && editingMedication.id === medication.id) {
        handleCancel()
      }
      await loadMedications()
    } catch {
      setActionError('Could not delete the medication. Please try again.')
    }
  }

  // Closes the form and resets edit mode
  function handleCancel() {
    setShowForm(false)
    setEditingMedication(null)
    setActionError('')
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2 className="page-title">Medications</h2>
          <p className="page-subtitle">Add, edit and remove your medications.</p>
        </div>
        {!showForm && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            + Add Medication
          </button>
        )}
      </div>

      {actionError && <p className="error-banner">{actionError}</p>}

      {/* The key makes React remount the form whenever the edit target
          changes, so the form always starts with the correct data. */}
      {showForm && (
        <MedicationForm
          key={editingMedication ? editingMedication.id : 'new'}
          initialMedication={editingMedication}
          onSubmit={editingMedication ? handleUpdate : handleAdd}
          onCancel={handleCancel}
        />
      )}

      {loading && <p className="status-message">Loading medications…</p>}

      {!loading && loadError && <p className="status-message error">{loadError}</p>}

      {!loading && !loadError && (
        <MedicationList
          medications={medications}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
