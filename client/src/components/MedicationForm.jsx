import { useState } from 'react'
import { getRequiredTimeCount, validateMedication } from '../utils/validate.js'

// Frequencies available in Phase 1
const FREQUENCIES = ['Once a day', 'Twice a day', 'Three times a day']

// A blank medication. preferredTimes always has 3 slots; only the
// required number is shown and saved.
const EMPTY_FORM = {
  name: '',
  dose: '',
  unit: 'mg',
  frequency: '',
  preferredTimes: ['', '', ''],
}

// The medication form. Used for both adding (no initialMedication)
// and editing (with initialMedication).
export default function MedicationForm({ initialMedication, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initialMedication) return { ...EMPTY_FORM }

    // When editing, fill the form with the existing medication data
    return {
      ...EMPTY_FORM,
      ...initialMedication,
      preferredTimes: [...initialMedication.preferredTimes, '', '', ''].slice(0, 3),
    }
  })

  const [errors, setErrors] = useState({})

  const numberOfTimes = getRequiredTimeCount(form.frequency)

  // Generic change handler for name, dose, unit and frequency
  function handleChange(event) {
    const { name, value } = event.target
    setForm({ ...form, [name]: value })
  }

  // Updates one preferred time slot
  function handleTimeChange(index, value) {
    const times = [...form.preferredTimes]
    times[index] = value
    setForm({ ...form, preferredTimes: times })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const validationErrors = validateMedication(form)
    setErrors(validationErrors)

    // Stop if the form is invalid
    if (Object.keys(validationErrors).length > 0) return

    // Send only the data we want to store
    onSubmit({
      name: form.name.trim(),
      dose: form.dose,
      unit: form.unit,
      frequency: form.frequency,
      preferredTimes: form.preferredTimes.slice(0, numberOfTimes),
    })
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2 className="card-title">
        {initialMedication ? 'Edit Medication' : 'Add Medication'}
      </h2>

      {/* 1. Medication Name */}
      <div className="field">
        <label htmlFor="name">Medication Name</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. Paracetamol"
          value={form.name}
          onChange={handleChange}
        />
        {errors.name && <p className="error">{errors.name}</p>}
      </div>

      {/* 2. Dose and 3. Unit side by side */}
      <div className="field-row">
        <div className="field">
          <label htmlFor="dose">Dose</label>
          <input
            id="dose"
            name="dose"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 500"
            value={form.dose}
            onChange={handleChange}
          />
          {errors.dose && <p className="error">{errors.dose}</p>}
        </div>

        <div className="field">
          <label htmlFor="unit">Unit</label>
          <select id="unit" name="unit" value={form.unit} onChange={handleChange}>
            <option value="mg">mg</option>
            <option value="g">g</option>
            <option value="mcg">mcg</option>
            <option value="ml">ml</option>
            <option value="tablet(s)">tablet(s)</option>
            <option value="capsule(s)">capsule(s)</option>
            <option value="drop(s)">drop(s)</option>
          </select>
        </div>
      </div>

      {/* 4. Frequency */}
      <div className="field">
        <label htmlFor="frequency">Frequency</label>
        <select id="frequency" name="frequency" value={form.frequency} onChange={handleChange}>
          <option value="">-- Select frequency --</option>
          {FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequency}
            </option>
          ))}
        </select>
        {errors.frequency && <p className="error">{errors.frequency}</p>}
      </div>

      {/* 5. Preferred times - one input per frequency */}
      <fieldset className="field times-field">
        <legend>Preferred Time{numberOfTimes !== 1 ? 's' : ''}</legend>
        {Array.from({ length: numberOfTimes }, (_, index) => (
          <div className="field" key={index}>
            <label htmlFor={`preferredTimes-${index}`}>Time {index + 1}</label>
            <input
              id={`preferredTimes-${index}`}
              type="time"
              value={form.preferredTimes[index] || ''}
              onChange={(event) => handleTimeChange(index, event.target.value)}
            />
            {errors[`time${index}`] && <p className="error">{errors[`time${index}`]}</p>}
          </div>
        ))}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {initialMedication ? 'Save Changes' : 'Add Medication'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
