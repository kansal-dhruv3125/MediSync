// ---------------------------------------------------------------------------
// timeUtils.js - small helpers for working with "HH:MM" 24-hour times.
// ---------------------------------------------------------------------------

// Converts "HH:MM" into the number of minutes since midnight.
// Example: "08:30" -> 510
function parseTime(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Compares two "HH:MM" strings for sorting.
// Returns a negative number if a < b, 0 if equal, positive if a > b.
function compareTimes(a, b) {
  return parseTime(a) - parseTime(b)
}

// timeToMinutes - the same conversion as parseTime, under the name used
// by the conflict detection logic. Example: "08:00" -> 480
function timeToMinutes(time) {
  return parseTime(time)
}

// minutesToTime - converts minutes since midnight back into a "HH:MM" time.
// Example: 540 -> "09:00"
// Values outside the day are clamped, so 1440 (24:00) becomes "23:59" and
// a negative value becomes "00:00". Invalid times are never produced.
function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59))
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
}

// calculateSpacing - absolute difference in minutes between two times.
// Example: calculateSpacing("08:00", "09:00") -> 60
function calculateSpacing(timeA, timeB) {
  return Math.abs(parseTime(timeA) - parseTime(timeB))
}

// Checks that a time is a valid 24-hour "HH:MM" string.
// Example: "08:30" is valid, "25:99" is not.
function isValidTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

module.exports = { parseTime, timeToMinutes, minutesToTime, calculateSpacing, compareTimes, isValidTime }
