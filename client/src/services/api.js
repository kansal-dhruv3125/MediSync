// ---------------------------------------------------------------------------
// api.js - all communication with the Express/JSON Server REST API lives here.
// Components never call fetch() directly; they use these functions.
//
// Phase 7: every protected request sends the session token in the
// Authorization header. The token is the ONLY thing stored on the client
// (localStorage) - passwords and hashes are never kept in the browser.
// ---------------------------------------------------------------------------

// The API lives on the SAME origin as the frontend, so a relative URL works
// in every environment:
//   - development: Vite (port 5173) proxies /api and /medications to the
//     Express server on port 3001 (see vite.config.js)
//   - production:  Express serves the built React app and the API together
//     from the same origin (see server/server.js)
const API_URL = ''

const TOKEN_KEY = 'medicationSchedulerToken'

// --- Session token helpers ---------------------------------------------------

let authToken = localStorage.getItem(TOKEN_KEY) || null

// Saves the token after login / removes it after logout.
export function setAuthToken(token) {
  authToken = token
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getAuthToken() {
  return authToken
}

// Common headers: JSON body plus the token when a session exists.
function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

// --- Authentication (Phase 7) ------------------------------------------------

// POST /api/auth/signup - creates an account. Returns { user }.
async function signup({ name, email, password }) {
  const response = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not create the account.')
  }
  return data.user
}

// POST /api/auth/login - verifies credentials and stores the session token.
// Returns { user, token }.
async function login({ email, password }) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not log in.')
  }
  setAuthToken(data.token)
  return data
}

// POST /api/auth/logout - invalidates the session and clears the token.
async function logout() {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    })
  } finally {
    setAuthToken(null)
  }
}

// GET /api/auth/me - returns the logged-in user (restores a session after
// a page refresh). Throws when the session is missing or no longer valid.
async function getMe() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Session expired.')
  }
  return data.user
}

// --- Medications (Phase 1, user-scoped since Phase 7) ------------------------

// GET /medications - returns the current user's medications
async function getMedications() {
  const response = await fetch(`${API_URL}/medications`, {
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not load medications.')
  }
  return data
}

// POST /medications - creates a medication for the logged-in user
async function addMedication(medication) {
  const response = await fetch(`${API_URL}/medications`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(medication),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not save the medication.')
  }
  return data
}

// PUT /medications/:id - replaces one of the user's medications
async function updateMedication(id, medication) {
  const response = await fetch(`${API_URL}/medications/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(medication),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not update the medication.')
  }
  return data
}

// DELETE /medications/:id - removes one of the user's medications
async function deleteMedication(id) {
  const response = await fetch(`${API_URL}/medications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not delete the medication.')
  }
  return data
}

// --- Schedule (Phase 2-5, user-scoped since Phase 7) --------------------------

// POST /api/schedule/generate - rebuilds the user's schedule from their
// medications. The returned schedule is already sorted and saved in db.json.
async function generateSchedule() {
  const response = await fetch(`${API_URL}/api/schedule/generate`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not generate the schedule.')
  }
  return data.schedule
}

// GET /api/schedule - returns the current user's schedule
async function getSchedule() {
  const response = await fetch(`${API_URL}/api/schedule`, {
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not load the schedule.')
  }
  return data.schedule
}

// GET /api/schedule/conflicts - checks the user's schedule against the
// interaction rules and returns the list of detected conflicts.
async function getScheduleConflicts() {
  const response = await fetch(`${API_URL}/api/schedule/conflicts`, {
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not check for conflicts.')
  }
  return data.conflicts
}

// POST /api/schedule/resolve - runs the automatic conflict-resolution
// algorithm on the user's schedule. Returns:
//   { schedule, resolvedConflicts, unresolvedConflicts, message }
async function resolveScheduleConflicts() {
  const response = await fetch(`${API_URL}/api/schedule/resolve`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not resolve conflicts.')
  }
  return data
}

// PATCH /api/schedule/:id/status - updates one schedule entry's status
// (pending | taken | skipped). The backend validates the value.
async function updateScheduleStatus(id, status) {
  const response = await fetch(`${API_URL}/api/schedule/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not update the status.')
  }
  return data
}

// GET /api/dashboard - live statistics for the logged-in user:
//   { totalMedications, todayDoses, pending, taken, skipped, conflicts, resolved }
async function getDashboardStats() {
  const response = await fetch(`${API_URL}/api/dashboard`, {
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not load the dashboard.')
  }
  return data
}

export {
  signup,
  login,
  logout,
  getMe,
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  generateSchedule,
  getSchedule,
  getScheduleConflicts,
  resolveScheduleConflicts,
  updateScheduleStatus,
  getDashboardStats,
}
