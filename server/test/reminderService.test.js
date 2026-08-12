// ---------------------------------------------------------------------------
// reminderService.test.js - Phase 8 verification.
//
// Run with:  node --test server/test
// No extra dependencies - uses Node's built-in test runner (node:test).
// The real email sender is replaced with a fake one, so no SMTP server is
// needed and no real email is ever sent.
// ---------------------------------------------------------------------------
const test = require('node:test')
const assert = require('node:assert/strict')

const { checkDueReminders } = require('../src/services/reminderService.js')
const {
  buildReminderText,
  buildReminderSubject,
  buildReminderHtml,
} = require('../src/services/emailService.js')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')

// A fresh in-memory database with users, medications and schedules.
function makeDb() {
  const db = low(new Memory())
  db.defaults({ users: [], medications: [], schedules: [] }).write()
  return db
}

function user(id, name, email) {
  return { id, name, email, passwordHash: 'hash' }
}

function medication(id, userId, name, dose, unit, times) {
  return { id, userId, name, dose, unit, preferredTimes: times }
}

function entry(id, userId, medicationId, medicationName, scheduledTime, extra) {
  return { id, userId, medicationId, medicationName, scheduledTime, status: 'pending', ...extra }
}

// A fake sender that records every reminder call and always "succeeds".
function fakeSender(records) {
  return async (user, medication, scheduleEntry) => {
    records.push({ user, medication, scheduleEntry })
    return { sent: true }
  }
}

// A fixed "now" of 10:00 so tests are deterministic.
const NOW = new Date('2026-08-13T10:00:00')

// --- TEST: correct user's email is selected --------------------------------

test('Phase 8 - reminder goes to the OWNER of the dose', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('users').push(user(2, 'Bob', 'bob@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00')).write()

  const records = []
  const result = await checkDueReminders(db, { now: NOW, sendReminder: fakeSender(records) })

  assert.equal(result.checked, 1)
  assert.equal(result.due, 1)
  assert.equal(result.sent, 1)
  // The email is addressed to the owner (Alice), never to Bob
  assert.equal(records.length, 1)
  assert.equal(records[0].user.email, 'alice@example.com')
})

// --- TEST: correct medication and scheduled time ----------------------------

test('Phase 8 - reminder contains the right medication and time', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Dhruv', 'dhruv@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00')).write()

  const records = []
  await checkDueReminders(db, { now: NOW, sendReminder: fakeSender(records) })

  assert.equal(records[0].medication.name, 'Medicine A')
  assert.equal(records[0].medication.dose, '500')
  assert.equal(records[0].medication.unit, 'mg')
  assert.equal(records[0].scheduleEntry.scheduledTime, '08:00')

  // The email text itself mentions the medicine, dosage and time
  const text = buildReminderText(records[0].user, records[0].medication, records[0].scheduleEntry)
  assert.ok(text.includes('Medicine: Medicine A'))
  assert.ok(text.includes('Dosage: 500 mg'))
  assert.ok(text.includes('Scheduled Time: 08:00'))
  // Neutral wording - it never claims the medicine is safe (the tagline
  // "Safer Timing" contains the letters "safe", so check for a claim)
  assert.ok(text.includes("It's time for your scheduled medication"))
  assert.ok(!text.toLowerCase().includes('is safe'))
  assert.ok(!text.toLowerCase().includes('safe for you'))
})

// --- TEST: already-notified dose is not sent again --------------------------

test('Phase 8 - an already-notified dose is NOT reminded twice', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules')
    .push(entry(1, 1, 1, 'Medicine A', '08:00', { notificationSent: true }))
    .write()

  const records = []
  const result = await checkDueReminders(db, { now: NOW, sendReminder: fakeSender(records) })

  assert.equal(result.due, 0)
  assert.equal(result.sent, 0)
  assert.equal(records.length, 0)
})

// --- TEST: taken / skipped / future doses are not reminded ------------------

test('Phase 8 - taken, skipped and future doses are not reminded', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00', { status: 'taken' })).write()
  db.get('schedules').push(entry(2, 1, 1, 'Medicine A', '08:00', { status: 'skipped' })).write()
  db.get('schedules').push(entry(3, 1, 1, 'Medicine A', '12:00')).write() // not due at 10:00

  const records = []
  const result = await checkDueReminders(db, { now: NOW, sendReminder: fakeSender(records) })

  assert.equal(result.due, 0)
  assert.equal(result.sent, 0)
  assert.equal(records.length, 0)
})

// --- TEST: a failing email does not break the others ------------------------

test('Phase 8 - a failing email never breaks the other reminders', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00')).write()
  db.get('schedules').push(entry(2, 1, 1, 'Medicine A', '09:00')).write()

  // The FIRST send throws; the second succeeds
  let calls = 0
  const flaky = async () => {
    calls += 1
    if (calls === 1) throw new Error('SMTP is down')
    return { sent: true }
  }

  const result = await checkDueReminders(db, { now: NOW, sendReminder: flaky })

  assert.equal(result.due, 2)
  assert.equal(result.failed, 1)
  assert.equal(result.sent, 1)
  // The failed entry is NOT marked as notified, so it can be retried later
  const after = db.get('schedules').find({ id: 1 }).value()
  assert.equal(after.notificationSent, undefined)
  // The successful one IS marked
  assert.equal(db.get('schedules').find({ id: 2 }).value().notificationSent, true)
})

// --- TEST: user isolation ---------------------------------------------------

test('Phase 8 - a user can never receive another user\'s reminder', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('users').push(user(2, 'Bob', 'bob@example.com')).write()
  db.get('medications').push(medication(1, 1, 'A-secret', '10', 'mg', ['08:00'])).write()
  db.get('medications').push(medication(2, 2, 'B-secret', '20', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'A-secret', '08:00')).write()
  db.get('schedules').push(entry(2, 2, 2, 'B-secret', '08:00')).write()

  const records = []
  await checkDueReminders(db, { now: NOW, sendReminder: fakeSender(records) })

  // Exactly one email per owner, each with their OWN medication
  assert.equal(records.length, 2)
  const aliceMail = records.find((r) => r.user.email === 'alice@example.com')
  const bobMail = records.find((r) => r.user.email === 'bob@example.com')
  assert.equal(aliceMail.medication.name, 'A-secret')
  assert.equal(bobMail.medication.name, 'B-secret')
})

// --- TEST: success marks the dose so a refresh never resends ----------------

test('Phase 8 - a sent dose is marked and never reminded after a refresh', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00')).write()

  const records = []
  const sender = fakeSender(records)

  // First check: sent + marked
  const first = await checkDueReminders(db, { now: NOW, sendReminder: sender })
  assert.equal(first.sent, 1)
  const marked = db.get('schedules').find({ id: 1 }).value()
  assert.equal(marked.notificationSent, true)
  assert.ok(marked.notificationSentAt)

  // Second check (e.g. after a page refresh): nothing is sent again
  const second = await checkDueReminders(db, { now: NOW, sendReminder: sender })
  assert.equal(second.due, 0)
  assert.equal(second.sent, 0)
  assert.equal(records.length, 1)
})

// --- TEST: simulated mode (no SMTP) never marks and never claims success ----

test('Phase 8 - simulated mode sends nothing and does not mark the dose', async () => {
  const db = makeDb()
  db.get('users').push(user(1, 'Alice', 'alice@example.com')).write()
  db.get('medications').push(medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])).write()
  db.get('schedules').push(entry(1, 1, 1, 'Medicine A', '08:00')).write()

  const simulated = async () => ({ sent: false, simulated: true })
  const result = await checkDueReminders(db, { now: NOW, sendReminder: simulated })

  assert.equal(result.simulated, 1)
  assert.equal(result.sent, 0)
  // Not marked, so it WILL be reminded once real credentials are configured
  assert.equal(db.get('schedules').find({ id: 1 }).value().notificationSent, undefined)
})

// --- TEST: subject line includes medicine name + scheduled time -------------

test('Phase 8 - subject line contains the medicine name and scheduled time', () => {
  const med = medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])
  const sch = entry(1, 1, 1, 'Medicine A', '08:00')
  assert.equal(
    buildReminderSubject(med, sch),
    '💊 MediSync Medication Reminder — Medicine A at 08:00'
  )
})

// --- TEST: HTML template shows branding, greeting and medication ------------

test('Phase 8 - HTML template shows user, medicine, dosage and time', () => {
  const u = user(1, 'Dhruv', 'dhruv@example.com')
  const med = medication(1, 1, 'Medicine A', '500', 'mg', ['08:00'])
  const sch = entry(1, 1, 1, 'Medicine A', '08:00')
  const html = buildReminderHtml(u, med, sch)

  // Branding + heading + greeting + neutral message
  assert.ok(html.includes('MediSync'))
  assert.ok(html.includes('Medication Reminder'))
  assert.ok(html.includes('Hello <b>Dhruv</b>'))
  assert.ok(html.includes("It's time for your scheduled medication"))
  // Medication card with real values
  assert.ok(html.includes('Medicine A'))
  assert.ok(html.includes('Dosage:</b> 500 mg'))
  assert.ok(html.includes('Scheduled Time:</b> 08:00'))
  // Reminder note, tagline and educational disclaimer
  assert.ok(html.includes('Please follow your prescribed medication schedule.'))
  assert.ok(html.includes('Smart Scheduling. Safer Timing.'))
  assert.ok(html.includes('educational medication scheduling project'))
  assert.ok(html.includes('consult a qualified healthcare'))
  // Inline CSS only - no external stylesheets, images or remote fonts
  assert.ok(!html.includes('<link'))
  assert.ok(!html.includes('url('))
  assert.ok(!html.includes('@import'))
})

// --- TEST: user-provided values are escaped in the HTML email ---------------

test('Phase 8 - user-provided values are escaped in the HTML email', () => {
  const trickyUser = user(1, 'A&B', 'x@example.com')
  const trickyMed = medication(1, 1, 'Medicine <script>alert(1)</script>', '10', 'mg', ['08:00'])
  const sch = entry(1, 1, 1, 'tricky', '08:00')
  const html = buildReminderHtml(trickyUser, trickyMed, sch)

  // The raw <script> tag never reaches the email; it is escaped
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('A&amp;B'))
})
