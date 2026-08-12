// ---------------------------------------------------------------------------
// server.js - starts JSON Server with the custom API routes (Phases 1-8).
//
// JSON Server is built on top of Express, so we can start it programmatically
// and add our own routes BEFORE the JSON Server router. Since Phase 7 every
// protected route first identifies the logged-in user from the session token
// in the Authorization header, then reads/writes ONLY that user's data.
//
//   POST /api/auth/signup             -> create an account (hashed password)
//   POST /api/auth/login              -> login, returns a session token
//   POST /api/auth/logout             -> invalidate the session token
//   GET  /api/auth/me                 -> who am I? (restores a session)
//   GET  /api/schedule                -> the current user's schedule
//   POST /api/schedule/generate       -> rebuild the user's schedule
//   GET  /api/interaction-rules       -> global interaction rules
//   GET  /api/schedule/conflicts      -> check the user's schedule
//   POST /api/schedule/resolve        -> resolve the user's conflicts
//   PATCH /api/schedule/:id/status    -> update a user's entry status
//   GET  /api/dashboard               -> the user's live statistics
//   GET/POST/PUT/PATCH/DELETE /medications -> the user's medications only
//
// Phase 8 (email reminders): a background check runs on a timer and emails
// the logged-in user when one of their doses is due. The check never blocks
// or breaks any request - failures are logged and skipped. Email settings
// come from EMAIL_* environment variables; when EMAIL_HOST is not set, the
// reminder is only printed to the console (simulated mode).
// ---------------------------------------------------------------------------

// Loads EMAIL_* (and any other) variables from a local .env file, if present.
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const express = require('express')
const jsonServer = require('json-server')
const { generateSchedule } = require('./src/services/scheduleService.js')
const { detectConflicts } = require('./src/services/conflictService.js')
const { resolveConflicts } = require('./src/algorithms/conflictResolver.js')
const { validateMedication } = require('./src/utils/validate.js')
const { nextId } = require('./src/utils/dbUtils.js')
const { checkDueReminders } = require('./src/services/reminderService.js')
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  toPublicUser,
  findUserByEmail,
  findUserByToken,
  validateSignup,
} = require('./src/services/authService.js')

const app = express()

// --- Deployment configuration ----------------------------------------------
// PORT comes from the hosting platform; 3001 is only the local fallback.
const PORT = process.env.PORT || 3001

// The database file. A deployment can point DB_PATH at its persistent volume.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json')

// Serve the React production build (client/dist) from this same Express
// server when it exists. In development only the API runs (the Vite dev
// server on :5173 proxies /api and /medications here - see vite.config.js).
const distDir = path.join(__dirname, '..', 'client', 'dist')
const hasFrontendBuild = fs.existsSync(path.join(distDir, 'index.html'))

const router = jsonServer.router(DB_PATH)
const middlewares = jsonServer.defaults(
  hasFrontendBuild ? { static: distDir } : {}
)

// Default middlewares (CORS, logging, static home page, etc.)
app.use(middlewares)

// Parse JSON request bodies for the custom routes below
app.use(express.json())

// ---------------------------------------------------------------------------
// Authentication helpers
// ---------------------------------------------------------------------------

// Reads the "Authorization: Bearer <token>" header, or "" when absent.
function extractToken(req) {
  const header = req.headers.authorization || ''
  return header.replace(/^Bearer\s+/i, '').trim()
}

// Rejects the request with 401 unless a valid session token is present.
// On success, req.user is set to the logged-in user (id, name, email).
function requireAuth(req, res, next) {
  const user = findUserByToken(router.db, extractToken(req))
  if (!user) {
    return res.status(401).json({ error: 'Please log in to continue.' })
  }
  req.user = user
  next()
}

// ---------------------------------------------------------------------------
// Authentication routes (Phase 7)
// ---------------------------------------------------------------------------

// POST /api/auth/signup - create a new account.
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}

  const errors = validateSignup({ name, email, password })
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: Object.values(errors)[0], errors })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (findUserByEmail(router.db, normalizedEmail)) {
    return res.status(400).json({ error: 'Email is already registered.' })
  }

  const user = {
    id: nextId(router.db, 'users'),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
  }
  router.db.get('users').push(user).write()

  res.status(201).json({ user: toPublicUser(user) })
})

// POST /api/auth/login - verify credentials and start a session.
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const user = findUserByEmail(router.db, email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Same message for a missing user and a wrong password - no information leak
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  const session = {
    id: nextId(router.db, 'sessions'),
    token: createSessionToken(),
    userId: user.id,
    createdAt: new Date().toISOString(),
  }
  router.db.get('sessions').push(session).write()

  res.json({ user: toPublicUser(user), token: session.token })
})

// POST /api/auth/logout - invalidate the current session token.
app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req)
  if (token) {
    router.db.get('sessions').remove({ token }).write()
  }
  res.json({ message: 'Logged out successfully.' })
})

// GET /api/auth/me - return the logged-in user (used to restore a session
// after a page refresh). 401 when the token is missing or no longer valid.
app.get('/api/auth/me', (req, res) => {
  const user = findUserByToken(router.db, extractToken(req))
  if (!user) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
  res.json({ user: toPublicUser(user) })
})

// ---------------------------------------------------------------------------
// Schedule routes (Phase 2-5) - now scoped to the logged-in user
// ---------------------------------------------------------------------------

// GET /api/schedule - the current user's schedule.
app.get('/api/schedule', requireAuth, (req, res) => {
  const schedule =
    router.db.get('schedules').filter({ userId: req.user.id }).value() || []
  res.json({ schedule })
})

// POST /api/schedule/generate - rebuild the user's schedule from THEIR
// medications. Only the user's old entries are replaced, so other users'
// schedules are never touched.
app.post('/api/schedule/generate', requireAuth, (req, res) => {
  const medications =
    router.db.get('medications').filter({ userId: req.user.id }).value() || []

  // TEST 5: nothing to schedule
  if (medications.length === 0) {
    return res.status(400).json({
      error: 'There are no medications to schedule. Add a medication first.',
    })
  }

  const entries = generateSchedule(medications)

  // Every medication was missing valid preferred times
  if (entries.length === 0) {
    return res.status(400).json({
      error: 'No medications have preferred times, so nothing could be scheduled.',
    })
  }

  // Give every entry a globally unique id (ids are shared across users),
  // then replace only this user's previous entries.
  const startId = nextId(router.db, 'schedules')
  const userEntries = entries.map((entry, index) => ({
    ...entry,
    id: startId + index,
    userId: req.user.id,
  }))

  router.db.get('schedules').remove((e) => e.userId === req.user.id).write()
  router.db.get('schedules').push(...userEntries).write()

  res.json({ schedule: userEntries })
})

// GET /api/interaction-rules - retrieve the GLOBAL interaction rules.
app.get('/api/interaction-rules', (req, res) => {
  const rules = router.db.get('interactionRules').value() || []
  res.json({ interactionRules: rules })
})

// GET /api/schedule/conflicts - check the user's schedule against the rules.
app.get('/api/schedule/conflicts', requireAuth, (req, res) => {
  const schedule =
    router.db.get('schedules').filter({ userId: req.user.id }).value() || []
  const rules = router.db.get('interactionRules').value() || []
  res.json({ conflicts: detectConflicts(schedule, rules) })
})

// POST /api/schedule/resolve - Phase 4: resolve the user's conflicts.
// The algorithm itself is untouched; it just receives the user's schedule.
app.post('/api/schedule/resolve', requireAuth, (req, res) => {
  const schedule =
    router.db.get('schedules').filter({ userId: req.user.id }).value() || []
  const rules = router.db.get('interactionRules').value() || []

  // Nothing to resolve
  if (schedule.length === 0) {
    return res.status(400).json({
      error: 'The schedule is empty. Generate a schedule first.',
    })
  }

  const result = resolveConflicts(schedule, rules)

  // Persist only this user's updated entries (other users are untouched)
  const userEntries = result.schedule.map((entry) => ({
    ...entry,
    userId: req.user.id,
  }))
  router.db.get('schedules').remove((e) => e.userId === req.user.id).write()
  router.db.get('schedules').push(...userEntries).write()

  res.json(result)
})

// PATCH /api/schedule/:id/status - Phase 5: update one of the user's entries.
app.patch('/api/schedule/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const { status } = req.body || {}

  const allowedStatuses = ['pending', 'taken', 'skipped']
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Status must be one of: pending, taken, skipped.',
    })
  }

  const entry = router.db
    .get('schedules')
    .find({ id, userId: req.user.id })
    .value()
  if (!entry) {
    return res.status(404).json({ error: 'Schedule entry not found.' })
  }

  router.db.get('schedules').find({ id }).assign({ status }).write()
  res.json({ ...entry, status })
})

// GET /api/dashboard - Phase 5: the user's live statistics.
app.get('/api/dashboard', requireAuth, (req, res) => {
  const medications =
    router.db.get('medications').filter({ userId: req.user.id }).value() || []
  const schedule =
    router.db.get('schedules').filter({ userId: req.user.id }).value() || []
  const rules = router.db.get('interactionRules').value() || []

  const stats = {
    totalMedications: medications.length,
    todayDoses: schedule.length,
    pending: schedule.filter((e) => e.status === 'pending').length,
    taken: schedule.filter((e) => e.status === 'taken').length,
    skipped: schedule.filter((e) => e.status === 'skipped').length,
    // Current conflicts (Phase 3 detection)
    conflicts: detectConflicts(schedule, rules).length,
    // Entries moved by the Phase 4 resolver (one per resolved conflict)
    resolved: schedule.filter((e) => e.rescheduled).length,
  }
  res.json(stats)
})

// ---------------------------------------------------------------------------
// Medication routes (Phase 1) - now scoped to the logged-in user.
// These run BEFORE the JSON Server router, so the built-in /medications
// routes are shadowed and can never leak another user's medications.
// ---------------------------------------------------------------------------

// Phase 6: validate medication bodies (POST and PUT carry a body).
app.use('/medications', (req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    const errors = validateMedication(req.body)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: Object.values(errors)[0] })
    }
  }
  next()
})

// GET /medications - only the logged-in user's medications.
app.get('/medications', requireAuth, (req, res) => {
  const medications =
    router.db.get('medications').filter({ userId: req.user.id }).value() || []
  res.json(medications)
})

// GET /medications/:id - only if it belongs to the logged-in user.
app.get('/medications/:id', requireAuth, (req, res) => {
  const medication = router.db
    .get('medications')
    .find({ id: Number(req.params.id), userId: req.user.id })
    .value()
  if (!medication) {
    return res.status(404).json({ error: 'Medication not found.' })
  }
  res.json(medication)
})

// POST /medications - the id and userId ALWAYS come from the server. The
// request body is spread FIRST, so a client can never forge id/userId and
// claim someone else's data (the spec explicitly forbids this).
app.post('/medications', requireAuth, (req, res) => {
  const medication = {
    ...req.body,
    id: nextId(router.db, 'medications'),
    userId: req.user.id,
  }
  router.db.get('medications').push(medication).write()
  res.status(201).json(medication)
})

// PUT /medications/:id - replace one of the user's own medications.
app.put('/medications/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const existing = router.db
    .get('medications')
    .find({ id, userId: req.user.id })
    .value()
  if (!existing) {
    return res.status(404).json({ error: 'Medication not found.' })
  }
  const updated = { ...existing, ...req.body, id, userId: req.user.id }
  router.db.get('medications').find({ id }).assign(updated).write()
  res.json(updated)
})

// PATCH /medications/:id - partial update of one of the user's medications.
// The merged result is validated so the stored data stays clean.
app.patch('/medications/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const existing = router.db
    .get('medications')
    .find({ id, userId: req.user.id })
    .value()
  if (!existing) {
    return res.status(404).json({ error: 'Medication not found.' })
  }
  const updated = { ...existing, ...req.body, id, userId: req.user.id }
  const errors = validateMedication(updated)
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: Object.values(errors)[0] })
  }
  router.db.get('medications').find({ id }).assign(updated).write()
  res.json(updated)
})

// DELETE /medications/:id - only the user's own medication.
app.delete('/medications/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const existing = router.db
    .get('medications')
    .find({ id, userId: req.user.id })
    .value()
  if (!existing) {
    return res.status(404).json({ error: 'Medication not found.' })
  }
  router.db.get('medications').remove({ id }).write()
  res.json({})
})

// ---------------------------------------------------------------------------
// JSON Server router
// ---------------------------------------------------------------------------

// Internal collections must never be exposed by the JSON Server router:
// /users contains password hashes and /sessions contains login tokens.
app.use(['/users', '/sessions', '/schedules'], (req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// SPA fallback (only when the production build exists): any GET that is not
// an API call and not a JSON Server resource gets the React app's
// index.html, so directly visiting or refreshing a frontend route works.
// API paths are explicitly skipped so /api/*, /interactionRules and
// /medications keep behaving exactly as before.
if (hasFrontendBuild) {
  app.use((req, res, next) => {
    const isApiRequest =
      req.path.startsWith('/api') ||
      req.path.startsWith('/interactionRules') ||
      req.path.startsWith('/medications')
    if (req.method === 'GET' && !isApiRequest) {
      return res.sendFile(path.join(distDir, 'index.html'))
    }
    next()
  })
}

// The JSON Server router handles the remaining standard resource endpoints
// (/interactionRules) and writes to db.json.
app.use(router)

// Phase 6: final JSON error handler - the client never sees a stack trace.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  console.error('Server error:', err.message)
  const message =
    status >= 500
      ? 'An unexpected error occurred. Please try again.'
      : 'Invalid request.'
  res.status(status).json({ error: message })
})

// ---------------------------------------------------------------------------
// Phase 8: email reminder engine
// ---------------------------------------------------------------------------

// How often the due-dose check runs. Overridable for demos/tests (e.g. 3000
// ms); the default of 60 seconds keeps the server quiet in normal use.
const REMINDER_CHECK_INTERVAL_MS =
  Number(process.env.REMINDER_CHECK_INTERVAL_MS) || 60000

// One check immediately at startup, then every interval. Email problems can
// never crash the server: every failure is caught here and in emailService.
// A re-entrancy guard skips a tick if the previous check is still running
// (e.g. a slow SMTP server), so two checks can never overlap and double-send
// a reminder for the same dose.
let reminderCheckRunning = false
async function runReminderCheck() {
  if (reminderCheckRunning) return
  reminderCheckRunning = true
  try {
    const result = await checkDueReminders(router.db)
    if (result.due > 0) {
      console.log('[MediSync][reminder] Check done:', JSON.stringify(result))
    }
  } catch (error) {
    console.error('[MediSync][reminder] Check failed: ' + error.message)
  } finally {
    reminderCheckRunning = false
  }
}

runReminderCheck()
setInterval(runReminderCheck, REMINDER_CHECK_INTERVAL_MS)

app.listen(PORT, () => {
  console.log('MediSync running on http://localhost:' + PORT)
  console.log('  Email reminders: ' +
    (process.env.EMAIL_HOST ? 'ENABLED via ' + process.env.EMAIL_HOST : 'simulated (set EMAIL_HOST to enable)'))
  console.log('  POST /api/auth/signup')
  console.log('  POST /api/auth/login')
  console.log('  POST /api/auth/logout')
  console.log('  GET  /api/auth/me')
  console.log('  GET  /api/schedule')
  console.log('  POST /api/schedule/generate')
  console.log('  GET  /api/interaction-rules')
  console.log('  GET  /api/schedule/conflicts')
  console.log('  POST /api/schedule/resolve')
  console.log('  PATCH /api/schedule/:id/status')
  console.log('  GET  /api/dashboard')
  console.log('  GET/POST/PUT/PATCH/DELETE /medications (user-scoped)')
})
