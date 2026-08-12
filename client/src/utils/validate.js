// ---------------------------------------------------------------------------
// validate.js - simple frontend validation helpers.
// validateMedication() returns an object of error messages.
// An empty errors object means the medication is valid.
// ---------------------------------------------------------------------------

// How many preferred times a frequency requires
export function getRequiredTimeCount(frequency) {
  switch (frequency) {
    case 'Once a day':
      return 1
    case 'Twice a day':
      return 2
    case 'Three times a day':
      return 3
    default:
      return 0
  }
}

// Checks that a time string is a valid 24-hour time like "08:30"
function isValidTime(time) {
  // 00-23 hours, then ":", then 00-59 minutes
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

export function validateMedication(medication) {
  const errors = {}

  // Rule 1: name cannot be empty
  if (!medication.name.trim()) {
    errors.name = 'Medication name is required.'
  }

  // Rule 2 & 3: dose cannot be empty and must be greater than 0
  if (medication.dose === '' || medication.dose === null) {
    errors.dose = 'Dose is required.'
  } else if (Number(medication.dose) <= 0) {
    errors.dose = 'Dose must be greater than 0.'
  }

  // Rule 4: frequency must be selected
  if (!medication.frequency) {
    errors.frequency = 'Please select a frequency.'
  }

  // Rule 5 & 6: every required time must be present and valid
  const numberOfTimes = getRequiredTimeCount(medication.frequency)
  for (let i = 0; i < numberOfTimes; i++) {
    const time = medication.preferredTimes[i]
    if (!time) {
      errors[`time${i}`] = `Preferred time ${i + 1} is required.`
    } else if (!isValidTime(time)) {
      errors[`time${i}`] = `Preferred time ${i + 1} is not valid.`
    }
  }

  return errors
}
