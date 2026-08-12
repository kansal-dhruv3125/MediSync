# Architecture

A simple layered architecture, kept deliberately viva-friendly: each layer
only talks to the layer below it.

```
React (browser)
   ↓  fetch() via client/src/services/api.js (Bearer token header)
API layer (client/src/services/api.js)
   ↓  HTTP + JSON
Express backend (server/server.js — routes)
   ↓  Authentication (authService.js) identifies the logged-in user
   ↓  router.db / services
Services (scheduleService.js, conflictService.js, authService.js,
          reminderService.js, emailService.js)
   ↓
Algorithms (algorithms/conflictResolver.js)
   ↓  reads/writes
JSON Server (json-server package)
   ↓  lowdb
db.json (server/db.json) — users, sessions, medications, rules, schedules
```

---

## Responsibilities of each layer

### React components (`client/src/components`, `client/src/pages`)

- Render data and capture user actions only.
- Never call `fetch()` directly — everything goes through `api.js`.
- Show loading, empty and error states.

### API services (`client/src/services/api.js`)

- The **only** place `fetch()` is used in the frontend.
- One function per endpoint: `getMedications`, `addMedication`,
  `updateMedication`, `deleteMedication`, `generateSchedule`, `getSchedule`,
  `getScheduleConflicts`, `resolveScheduleConflicts`, `updateScheduleStatus`,
  `getDashboardStats`.

### Express routes (`server/server.js`)

- Entry point that starts JSON Server programmatically and adds the custom
  routes **before** the JSON Server router.
- Each route loads data from `db.json`, calls a service or the algorithm,
  and sends back JSON with a proper HTTP status code.
- The `requireAuth` middleware resolves the session token to a user
  (`req.user`); protected routes filter every read/write by `userId`.
- Validates medication bodies and ends with a generic JSON error handler
  (no stack traces leaked).

### Services (`server/src/services`)

- `scheduleService.js` — turns medications into a sorted daily schedule
  (one entry per preferred time, unique ids).
- `conflictService.js` — compares a schedule against the interaction rules
  and returns the conflicts (Phase 3).
- `authService.js` — password hashing (bcryptjs), session-token creation and
  user lookups, signup validation (Phase 7).
- `reminderService.js` — Phase 8: scans schedule entries for due doses and
  sends each owner a reminder (duplicate protection via `notificationSent`).
- `emailService.js` — Phase 8: builds the reminder email and hands it to an
  SMTP server (nodemailer). Falls back to a clearly-labelled simulated
  console mode when `EMAIL_*` variables are not set; never throws.
- Pure logic: no Express, no React — easy to unit-test.

### Algorithm (`server/src/algorithms/conflictResolver.js`)

- The Phase 4 conflict-resolution algorithm, fully separate from the routes.
- Receives a schedule + rules, returns the updated schedule and
  resolved/unresolved conflicts. See `docs/ALGORITHM.md`.

### Utilities (`server/src/utils`)

- `timeUtils.js` — `HH:mm` helpers: `parseTime` / `timeToMinutes`,
  `minutesToTime` (clamped, so `24:00` never appears), `calculateSpacing`,
  `compareTimes`, `isValidTime`.
- `validate.js` — backend medication validation (mirrors the frontend
  rules in `client/src/utils/validate.js`).

### JSON Server (`json-server` package) + `db.json`

- The persistence engine behind `db.json`: reads it into memory at startup
  and writes every change back to the file automatically.
- Its router still serves the remaining standard endpoint
  (`/interactionRules`); `/medications` and `/schedules` are handled by the
  custom user-scoped routes in `server.js` that run before it.

---

## Complete project flow

```
USER SIGNS UP / LOGS IN (POST /api/auth/signup | /api/auth/login)
        ↓  password hashed with bcryptjs; a session token is created
        ↓  the client stores ONLY the token (localStorage)
        ↓  every later request sends: Authorization: Bearer <token>
        ↓  the backend resolves the token to the user (requireAuth)
        ↓
USER ADDS MEDICATION
        ↓  POST /medications (validated by frontend + backend, userId attached
        ↓  from the session — the user can never choose another user's id)
Medication API
        ↓  JSON Server writes the record
JSON Server → db.json
        ↓
GENERATE SCHEDULE (POST /api/schedule/generate)
        ↓  scheduleService: one entry per preferred time, sorted, unique ids
Create Daily Schedule Entries
        ↓
CHECK INTERACTION RULES (GET /api/schedule/conflicts)
        ↓  conflictService: every matching pair vs minimum spacing
Detect Conflict
        ↓
RESOLVE CONFLICT (POST /api/schedule/resolve)
        ↓  conflictResolver: keep earlier fixed, search 30-min slots,
        ↓  validate every candidate, move to the nearest valid slot
Save Updated Schedule → db.json
        ↓
DASHBOARD (GET /api/dashboard) shows live counts
        ↓
USER MARKS DOSE TAKEN/SKIPPED (PATCH /api/schedule/:id/status)
        ↓  persisted to db.json — survives a refresh

PHASE 8 — EMAIL REMINDERS (runs in the background, no user action needed):
        ↓  reminder engine in server.js fires every 60 s
        ↓  reminderService checks: pending + not yet notified + time reached
        ↓  emailService sends to the dose owner's registered email
        ↓  entry marked notificationSent: true (never reminded twice)
```

## Why this layering helps the viva

- The algorithm is a **pure function** — you can explain and test it without
  the server.
- The frontend never touches the database — one API layer to point at.
- Every layer has one job, so "where does X happen?" always has a short
  answer.
- Authentication only decides **whose** data flows into the existing
  scheduling system; the conflict-detection and resolution logic is
  completely unchanged since Phase 4.

## User data isolation (Phase 7)

- Medication CRUD, schedule generation, conflict checking, resolution,
  statuses and dashboard statistics are all filtered by the logged-in
  user's id on the **backend** — the frontend cannot show or modify another
  user's data even if asked to.
- Interaction rules are **global**: they are not duplicated per user and are
  shared by every user's scheduling engine.
- The internal `users` (password hashes), `sessions` (tokens) and raw
  `schedules` collections are blocked from direct API access (`404`).
