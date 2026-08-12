// ---------------------------------------------------------------------------
// scheduleService.js - the schedule generation business logic.
// This file has NO React and NO Express code: it only turns a list of
// medications into a sorted list of schedule entries, so it is easy to test.
// ---------------------------------------------------------------------------

const { compareTimes, isValidTime } = require('../utils/timeUtils.js')

// Takes a list of medications (as stored in db.json) and returns a schedule:
//   - one schedule entry per preferred time
//   - each entry keeps the medication name, dose and unit
//   - every entry starts with status "pending"
//   - the final list is always sorted chronologically
//   - every entry gets a unique id (1, 2, 3, … in time order) so its status
//     can be updated later via PATCH /api/schedule/:id/status (Phase 5)
//
// Medications without preferred times, and times that are not valid
// "HH:MM" strings, are skipped (they contribute nothing).
function generateSchedule(medications) {
  const entries = []

  for (const medication of medications) {
    const times = Array.isArray(medication.preferredTimes) ? medication.preferredTimes : []

    for (const time of times) {
      // Ignore missing or malformed times instead of crashing
      if (!isValidTime(time)) continue

      entries.push({
        medicationId: medication.id,
        medicationName: medication.name,
        dose: medication.dose,
        unit: medication.unit,
        scheduledTime: time,
        status: 'pending',
      })
    }
  }

  // Always return the schedule sorted by time (e.g. 09:00 before 20:00)
  entries.sort((a, b) => compareTimes(a.scheduledTime, b.scheduledTime))

  // Phase 5: assign ids AFTER sorting, so ids follow the time order.
  // Each generate call replaces the whole schedule, so ids never collide.
  entries.forEach((entry, index) => {
    entry.id = index + 1
  })

  return entries
}

module.exports = { generateSchedule }
