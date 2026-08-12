// ---------------------------------------------------------------------------
// validate.js - backend validation for medication data (Phase 6).
// Mirrors the rules used on the frontend (client/src/utils/validate.js) so a
// request sent straight to the API (e.g. with curl) is checked too.
// Returns an object of error messages; an empty object means the data is OK.
// ---------------------------------------------------------------------------

const FREQUENCIES = ['Once a day', 'Twice a day', 'Three times a day']

// Checks that a time is a valid 24-hour "HH:MM" string (00:00 - 23:59)
function isValidTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

// How many preferred times a frequency requires
function requiredTimeCount(frequency) {
  if (frequency === 'Once a day') return 1
  if (frequency === 'Twice a day') return 2
  if (frequency === 'Three times a day') return 3
  return 0
}

function validateMedication(medication) {
  const errors = {}

  if (!medication || typeof medication !== 'object') {
    return { medication: 'Medication data is required.' }
  }

  // Rule 1: name cannot be empty
  if (!medication.name || !String(medication.name).trim()) {
    errors.name = 'Medication name is required.'
  }

  // Rule 2 & 3: dose cannot be empty and must be greater than 0
  const dose = Number(medication.dose)
  if (medication.dose === undefined || medication.dose === null || medication.dose === '') {
    errors.dose = 'Dose is required.'
  } else if (Number.isNaN(dose) || dose <= 0) {
    errors.dose = 'Dose must be greater than 0.'
  }

  // Rule 4: frequency must be one of the known values
  if (!FREQUENCIES.includes(medication.frequency)) {
    errors.frequency = 'Please select a valid frequency.'
  }

  // Rule 5 & 6: every required time must be present and valid
  const times = Array.isArray(medication.preferredTimes) ? medication.preferredTimes : []
  const numberOfTimes = requiredTimeCount(medication.frequency)
  for (let i = 0; i < numberOfTimes; i++) {
    if (!times[i]) {
      errors[`time${i}`] = `Preferred time ${i + 1} is required.`
    } else if (!isValidTime(times[i])) {
      errors[`time${i}`] = `Preferred time ${i + 1} is not valid.`
    }
  }

  return errors
}

module.exports = { validateMedication }
