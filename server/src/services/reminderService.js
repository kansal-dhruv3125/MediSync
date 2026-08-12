// ---------------------------------------------------------------------------
// reminderService.js - Phase 8: checks scheduled doses and sends reminders.
//
// This file has NO React and NO Express code - it works against the same
// lowdb instance used everywhere else, so it is easy to unit-test with an
// in-memory database.
//
// The "reminder engine" (see server.js) calls checkDueReminders on a timer.
// For every schedule entry that is due it sends an email to the OWNER of
// that entry only (user isolation is automatic: the entry carries userId).
//
// Duplicate protection: an entry is only sent a reminder once. After a real
// email has been handed to the SMTP server, the entry is marked
//   notificationSent: true, notificationSentAt: <ISO timestamp>
// so later checks skip it. Entries are never marked when no email was
// actually sent (e.g. simulated/dev mode or a failed send), so the user
// will not miss the reminder later.
// ---------------------------------------------------------------------------

const { timeToMinutes, isValidTime } = require('../utils/timeUtils.js')
const { sendMedicationReminder } = require('./emailService.js')

// Checks every schedule entry and emails a reminder for the doses that are
// due. Returns a small summary object:
//   { checked, due, sent, simulated, failed }
//
// A dose is "due" when ALL of these hold:
//   - the entry belongs to a real user
//   - the status is still "pending" (taken/skipped doses are never reminded)
//   - it has not been notified yet (notificationSent !== true)
//   - its scheduled time has arrived (scheduledTime <= now)
//
// options (all optional, injectable for tests):
//   now          - the current Date (defaults to new Date())
//   sendReminder - the email function (defaults to the real SMTP sender)
async function checkDueReminders(db, options = {}) {
  const now = options.now || new Date()
  const sendReminder = options.sendReminder || sendMedicationReminder
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const entries = db.get('schedules').value() || []
  const result = { checked: entries.length, due: 0, sent: 0, simulated: 0, failed: 0 }

  for (const entry of entries) {
    // Not pending (already taken/skipped) or already reminded - skip quietly
    if (entry.status !== 'pending' || entry.notificationSent) continue
    // Missing/ill-formed time, or not due yet - skip
    if (!isValidTime(entry.scheduledTime)) continue
    if (timeToMinutes(entry.scheduledTime) > nowMinutes) continue

    result.due += 1

    // The owner of this entry - the reminder goes to THIS user's email only.
    // An orphan entry (no user) is skipped instead of crashing.
    const user = db.get('users').find({ id: entry.userId }).value()
    if (!user) continue

    // Medication details come from the user's OWN medication record when it
    // still exists (scoped by userId - never another user's data), otherwise
    // the entry already carries name/dose/unit.
    const medication =
      db
        .get('medications')
        .find({ id: entry.medicationId, userId: entry.userId })
        .value() || entry

    // One failing email must never stop the other reminders or the server.
    let outcome
    try {
      outcome = await sendReminder(user, medication, entry)
    } catch (error) {
      console.error('[MediSync][reminder] Reminder failed: ' + error.message)
      outcome = { sent: false, error: error.message }
    }

    if (outcome && outcome.sent) {
      // Only a REAL send is recorded - simulated/failed sends are retried
      // on the next check instead of being skipped forever.
      db.get('schedules')
        .find({ id: entry.id })
        .assign({ notificationSent: true, notificationSentAt: now.toISOString() })
        .write()
      result.sent += 1
    } else if (outcome && outcome.simulated) {
      result.simulated += 1
    } else {
      result.failed += 1
    }
  }

  return result
}

module.exports = { checkDueReminders }
