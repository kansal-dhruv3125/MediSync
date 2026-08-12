// ---------------------------------------------------------------------------
// conflictResolver.test.js - Phase 4 verification (TEST 1 to TEST 6 + edges).
//
// Run with:  node --test server/test
// No extra dependencies - uses Node's built-in test runner (node:test).
// ---------------------------------------------------------------------------
const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveConflicts } = require('../src/algorithms/conflictResolver.js')
const { detectConflicts } = require('../src/services/conflictService.js')
const { generateSchedule } = require('../src/services/scheduleService.js')
const { minutesToTime } = require('../src/utils/timeUtils.js')
const { validateMedication } = require('../src/utils/validate.js')
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  toPublicUser,
  findUserByEmail,
  findUserByToken,
  validateSignup,
} = require('../src/services/authService.js')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')

// A fresh in-memory database for auth tests
function makeDb() {
  const db = low(new Memory())
  db.defaults({ users: [], sessions: [] }).write()
  return db
}

// --- helpers ---------------------------------------------------------------

// Builds a schedule exactly the way the app does: one entry per preferred time
function buildSchedule(medications) {
  return generateSchedule(medications)
}

function med(name, times) {
  return {
    id: name,
    name,
    dose: '10',
    unit: 'mg',
    frequency: 'Once a day',
    preferredTimes: times,
  }
}

function rule(a, b, spacing) {
  return {
    id: `${a}-${b}`,
    medicationA: a,
    medicationB: b,
    minimumSpacingMinutes: spacing,
    severity: 'medium',
    message: `Keep at least ${spacing} minutes between ${a} and ${b}.`,
  }
}

// The scheduled time of a medication, or undefined when it has no entry
function findTime(schedule, name) {
  const entry = schedule.find((e) => e.medicationName === name)
  return entry && entry.scheduledTime
}

// --- TEST 1: no conflict ----------------------------------------------------

test('TEST 1 - no conflict: schedule stays unchanged', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['12:00'])])
  const rules = [rule('A', 'B', 180)]

  const result = resolveConflicts(schedule, rules)

  assert.equal(result.resolvedConflicts.length, 0)
  assert.equal(result.unresolvedConflicts.length, 0)
  assert.equal(result.message, 'No conflicts require resolution.')
  assert.equal(findTime(result.schedule, 'A'), '08:00')
  assert.equal(findTime(result.schedule, 'B'), '12:00')
})

// --- TEST 2: simple conflict ------------------------------------------------

test('TEST 2 - simple conflict: B moves to the nearest valid slot', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['09:00'])])
  const rules = [rule('A', 'B', 180)]

  const result = resolveConflicts(schedule, rules)

  assert.equal(result.resolvedConflicts.length, 1)
  assert.equal(result.unresolvedConflicts.length, 0)

  const resolved = result.resolvedConflicts[0]
  assert.equal(resolved.medicationB, 'B')
  assert.equal(resolved.originalTime, '09:00')
  // 30-minute search: 09:30, 10:00, 10:30, 11:00 is the first valid slot
  assert.equal(resolved.newTime, '11:00')
  assert.equal(resolved.resolved, true)
  assert.equal(findTime(result.schedule, 'B'), '11:00')

  // The moved entry keeps its original time and is flagged rescheduled
  const movedEntry = result.schedule.find((e) => e.medicationName === 'B')
  assert.equal(movedEntry.originalTime, '09:00')
  assert.equal(movedEntry.rescheduled, true)
})

// --- TEST 3: first candidate creates another conflict -----------------------

test('TEST 3 - a candidate that creates another conflict is rejected', () => {
  // A-B needs 180 min, B-C needs 120 min. B at 11:00 would satisfy A
  // (180 min) but is only 60 min from C, so the search must continue
  // until 14:00 (exactly 120 min from C).
  const schedule = buildSchedule([
    med('A', ['08:00']),
    med('B', ['09:00']),
    med('C', ['12:00']),
  ])
  const rules = [rule('A', 'B', 180), rule('B', 'C', 120)]

  const result = resolveConflicts(schedule, rules)

  assert.equal(result.resolvedConflicts.length, 1)
  assert.equal(result.unresolvedConflicts.length, 0)
  assert.equal(result.resolvedConflicts[0].newTime, '14:00')
  assert.equal(findTime(result.schedule, 'B'), '14:00')

  // The fixed medications were not touched
  assert.equal(findTime(result.schedule, 'A'), '08:00')
  assert.equal(findTime(result.schedule, 'C'), '12:00')

  // The final schedule is completely conflict-free
  assert.equal(detectConflicts(result.schedule, rules).length, 0)
})

// --- TEST 4: unresolvable conflict ------------------------------------------

test('TEST 4 - no valid slot: conflict stays unresolved, nothing moves', () => {
  // A at 22:00 and B at 23:00 need 180 min apart. The only reachable
  // candidate for B is 23:30, which is just 90 min from A, so no valid
  // slot exists within the day.
  const schedule = buildSchedule([med('A', ['22:00']), med('B', ['23:00'])])
  const rules = [rule('A', 'B', 180)]

  const result = resolveConflicts(schedule, rules)

  assert.equal(result.resolvedConflicts.length, 0)
  assert.equal(result.unresolvedConflicts.length, 1)

  const unresolved = result.unresolvedConflicts[0]
  assert.equal(unresolved.medicationB, 'B')
  assert.equal(unresolved.originalTime, '23:00')
  assert.equal(unresolved.newTime, null)
  assert.equal(unresolved.resolved, false)

  // B was NOT moved
  assert.equal(findTime(result.schedule, 'B'), '23:00')
  assert.equal(
    result.schedule.find((e) => e.medicationName === 'B').rescheduled,
    undefined
  )
})

// --- TEST 5: multiple conflicts ---------------------------------------------

test('TEST 5 - multiple conflicts resolved without creating new ones', () => {
  const schedule = buildSchedule([
    med('A', ['08:00']),
    med('B', ['09:00']),
    med('C', ['10:00']),
    med('D', ['11:00']),
  ])
  const rules = [rule('A', 'B', 180), rule('C', 'D', 120)]

  const result = resolveConflicts(schedule, rules)

  assert.equal(result.resolvedConflicts.length, 2)
  assert.equal(result.unresolvedConflicts.length, 0)
  assert.equal(findTime(result.schedule, 'B'), '11:00')
  assert.equal(findTime(result.schedule, 'D'), '12:00')
  assert.equal(detectConflicts(result.schedule, rules).length, 0)
})

// --- TEST 6: existing functionality still works ------------------------------

test('TEST 6 - existing functionality: generate + detect still work', () => {
  const meds = [
    med('A', ['08:00']),
    med('B', ['09:00']),
    med('Bad', ['25:00']), // invalid time -> skipped
    med('NoTime', []), // no preferred times -> skipped
  ]
  const schedule = generateSchedule(meds)
  assert.equal(schedule.length, 2)
  assert.deepEqual(schedule.map((e) => e.scheduledTime), ['08:00', '09:00'])

  const conflicts = detectConflicts(schedule, [rule('A', 'B', 180)])
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].actualSpacing, 60)
})

// --- Repeated resolution (must not keep moving medications) ------------------

test('REPEATED resolution does not keep moving medications', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['09:00'])])
  const rules = [rule('A', 'B', 180)]

  const first = resolveConflicts(schedule, rules)
  assert.equal(findTime(first.schedule, 'B'), '11:00')

  // Running the resolver again on the already-valid schedule changes nothing
  const second = resolveConflicts(first.schedule, rules)
  assert.equal(second.resolvedConflicts.length, 0)
  assert.equal(second.unresolvedConflicts.length, 0)
  assert.equal(second.message, 'No conflicts require resolution.')
  assert.equal(findTime(second.schedule, 'B'), '11:00')
})

// --- Edge cases --------------------------------------------------------------

test('EDGE - empty schedule', () => {
  const result = resolveConflicts([], [rule('A', 'B', 180)])
  assert.equal(result.resolvedConflicts.length, 0)
  assert.equal(result.unresolvedConflicts.length, 0)
  assert.deepEqual(result.schedule, [])
})

test('EDGE - no interaction rules', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['09:00'])])
  const result = resolveConflicts(schedule, [])
  assert.equal(result.resolvedConflicts.length, 0)
  assert.equal(result.unresolvedConflicts.length, 0)
  assert.equal(findTime(result.schedule, 'B'), '09:00')
})

test('EDGE - one medication only', () => {
  const schedule = buildSchedule([med('A', ['08:00'])])
  const result = resolveConflicts(schedule, [rule('A', 'B', 180)])
  assert.equal(result.resolvedConflicts.length, 0)
  assert.equal(result.unresolvedConflicts.length, 0)
})

test('EDGE - two medications at the same time', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['08:00'])])
  const rules = [rule('A', 'B', 60)]
  const result = resolveConflicts(schedule, rules)
  // spacing 0 < 60 -> conflict; B moves forward until it is 60 min from A
  assert.equal(result.resolvedConflicts.length, 1)
  assert.equal(findTime(result.schedule, 'B'), '09:00')
})

test('EDGE - input schedule is not mutated by the resolver', () => {
  const schedule = buildSchedule([med('A', ['08:00']), med('B', ['09:00'])])
  const snapshot = JSON.stringify(schedule)
  resolveConflicts(schedule, [rule('A', 'B', 180)])
  assert.equal(JSON.stringify(schedule), snapshot)
})

test('EDGE - minutesToTime never produces invalid times like 24:00', () => {
  assert.equal(minutesToTime(1440), '23:59') // 24:00 clamps to 23:59
  assert.equal(minutesToTime(1439), '23:59')
  assert.equal(minutesToTime(-30), '00:00')
})

// --- Phase 5: schedule entry ids --------------------------------------------

test('Phase 5 - generateSchedule assigns a unique id to every entry', () => {
  const schedule = buildSchedule([
    med('A', ['08:00', '20:00']),
    med('B', ['09:00']),
  ])

  const ids = schedule.map((e) => e.id)
  assert.equal(schedule.length, 3)
  // Ids are unique (no duplicate schedule entries) and follow time order
  assert.equal(new Set(ids).size, 3)
  assert.deepEqual(ids, [1, 2, 3])
  // Every entry starts as pending (Phase 5 statuses)
  assert.ok(schedule.every((e) => e.status === 'pending'))
})

// --- Phase 6: backend medication validation ---------------------------------

test('Phase 6 - validateMedication rejects invalid medication data', () => {
  // Missing name, non-positive dose, unknown frequency
  const errors = validateMedication({
    name: '  ',
    dose: '0',
    unit: 'mg',
    frequency: 'Every hour',
    preferredTimes: ['08:00'],
  })
  assert.ok(errors.name)
  assert.ok(errors.dose)
  assert.ok(errors.frequency)

  // Valid frequency but a missing required time
  const missingTime = validateMedication({
    name: 'X',
    dose: '5',
    unit: 'mg',
    frequency: 'Once a day',
    preferredTimes: [],
  })
  assert.ok(missingTime.time0)

  // Invalid time string (24:00 is not a valid time)
  const badTime = validateMedication({
    name: 'X',
    dose: '5',
    unit: 'mg',
    frequency: 'Once a day',
    preferredTimes: ['25:00'],
  })
  assert.ok(badTime.time0)

  // Missing body entirely
  assert.ok(validateMedication(null).medication)
})

test('Phase 6 - validateMedication accepts valid medication data', () => {
  const errors = validateMedication({
    name: 'Paracetamol',
    dose: '500',
    unit: 'mg',
    frequency: 'Twice a day',
    preferredTimes: ['08:00', '20:00'],
  })
  assert.deepEqual(errors, {})
})

// --- Phase 7: authentication -------------------------------------------------

test('Phase 7 - passwords are hashed, never stored as plain text', () => {
  const hash = hashPassword('123456')
  assert.notEqual(hash, '123456')
  assert.ok(hash.startsWith('$2')) // bcrypt hash marker
  assert.equal(verifyPassword('123456', hash), true)
  assert.equal(verifyPassword('wrong-password', hash), false)
})

test('Phase 7 - session tokens are random and unique', () => {
  const tokenA = createSessionToken()
  const tokenB = createSessionToken()
  assert.ok(tokenA)
  assert.ok(tokenA.length >= 32)
  assert.notEqual(tokenA, tokenB)
})

test('Phase 7 - toPublicUser never returns the password hash', () => {
  const user = {
    id: 1,
    name: 'Dhruv',
    email: 'dhruv@example.com',
    passwordHash: hashPassword('123456'),
  }
  const publicUser = toPublicUser(user)
  assert.deepEqual(publicUser, { id: 1, name: 'Dhruv', email: 'dhruv@example.com' })
  assert.equal(publicUser.passwordHash, undefined)
  assert.equal(toPublicUser(null), null)
})

test('Phase 7 - findUserByEmail is case-insensitive', () => {
  const db = makeDb()
  db.get('users').push({ id: 1, name: 'Demo', email: 'demo@example.com' }).write()
  const user = findUserByEmail(db, 'DEMO@Example.COM')
  assert.equal(user.id, 1)
  assert.equal(findUserByEmail(db, 'nobody@example.com'), null)
})

test('Phase 7 - validateSignup enforces the signup rules', () => {
  const missing = validateSignup({})
  assert.ok(missing.name)
  assert.ok(missing.email)
  assert.ok(missing.password)

  const badEmail = validateSignup({ name: 'A', email: 'not-an-email', password: '123456' })
  assert.ok(badEmail.email)

  const shortPassword = validateSignup({ name: 'A', email: 'a@example.com', password: '123' })
  assert.ok(shortPassword.password)

  const valid = validateSignup({ name: 'A', email: 'a@example.com', password: '123456' })
  assert.deepEqual(valid, {})
})

test('Phase 7 - signup/login/logout session flow works (service level)', () => {
  const db = makeDb()

  // Signup: store a user with a hashed password
  const user = {
    id: 1,
    name: 'Dhruv',
    email: 'dhruv@example.com',
    passwordHash: hashPassword('123456'),
  }
  db.get('users').push(user).write()

  // Login with the correct password -> a session is created
  assert.equal(verifyPassword('123456', user.passwordHash), true)
  const session = { id: 1, token: createSessionToken(), userId: user.id }
  db.get('sessions').push(session).write()

  // The token identifies the user (this is what requireAuth relies on)
  assert.equal(findUserByToken(db, session.token).email, 'dhruv@example.com')
  assert.equal(findUserByToken(db, 'bogus-token'), null)

  // Logout: remove the session -> the token no longer works
  db.get('sessions').remove({ token: session.token }).write()
  assert.equal(findUserByToken(db, session.token), null)
})
