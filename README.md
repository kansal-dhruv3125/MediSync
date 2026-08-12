# MediSync

## Medication Dosage & Interaction Scheduler

> Smart Scheduling. Safer Timing.

A full-stack web application (college Back End Engineering project) that helps
people manage multiple medications: store them, generate a daily schedule,
detect interactions that are too close together, and **automatically
reschedule conflicting doses** to valid time slots.

Built with React + Vite on the frontend and Express + JSON Server on the
backend, it demonstrates a complete REST API, a scheduling engine, and a
time-window conflict-resolution algorithm — kept deliberately simple so every
part can be explained. Since **Phase 7**, every user signs up and logs in, and
all medications, schedules and dashboard statistics are **personal**: each
user only ever sees their own data.

> 🔐 **Security note:** this is a college project. Passwords are hashed with
> bcryptjs and sessions use server-generated tokens, but this is **not**
> production-grade authentication and should not be treated as such.

> ⚠️ **Medical disclaimer:** This is an educational medication scheduling
> project. Demonstration interaction rules are fictional and should not be
> used for real medical decisions. Consult a qualified healthcare
> professional for medication advice.

---

## 1. Project Overview

The app manages a list of medications (name, dose, unit, frequency and
preferred times). From those medications it generates a **daily schedule**,
compares it against **interaction rules** (e.g. "Medicine A and Medicine B
must be at least 180 minutes apart"), reports any **conflicts**, and
**automatically resolves** them by moving the later medication to the nearest
valid time slot. A dashboard shows live summary numbers, and every dose can
be marked **taken** or **skipped**, with the state persisted to `db.json`.

## 2. Problem Statement

People taking multiple medications often have preferred intake times that
violate minimum-spacing requirements between certain medicines. Checking
every time against every rule by hand is error-prone. This system automates
the whole loop: it generates the schedule, detects conflicts, tries to fix
them by searching for valid nearby time slots, and only reports a conflict as
unresolved when no valid slot exists in the day.

## 3. Objectives

- Store and manage medication records (CRUD) with validation.
- Generate a daily schedule automatically from preferred times.
- Model fictional interaction rules with minimum spacing in minutes.
- Detect conflicts between schedule entries and the rules.
- Resolve conflicts automatically by moving the later medication to the
  nearest valid slot, without creating new conflicts.
- Provide a dashboard, a timeline, and taken/skipped statuses.
- Persist everything in a simple JSON database.

## 4. Features

- **Medication CRUD** — add, view, edit and delete medications
- **Medication validation** — frontend and backend checks (name, dose,
  frequency, times)
- **Daily schedule generation** — one entry per preferred time, sorted
- **Interaction rules** — fictional rules with a minimum spacing in minutes
- **Conflict detection** — compares every matching pair against the rules
- **Automatic conflict resolution** — 30-minute candidate search, nearest
  valid slot, re-check after every move
- **Resolved / unresolved conflicts** — clear reporting for both outcomes
- **Dashboard** — live summary cards (medications, doses, conflicts, resolved)
- **Schedule timeline** — status badges: ○ Pending, ✓ Taken, — Skipped,
  ↻ Rescheduled, ⚠ Conflict
- **Taken / Skipped status** — persisted via the status API
- **JSON persistence** — everything stored in `db.json`
- **Error handling** — friendly frontend messages, clean HTTP status codes,
  no stack traces exposed
- **Authentication (Phase 7)** — signup, login, logout, session restore,
  hashed passwords (bcryptjs), token-based sessions
- **User-specific data (Phase 7)** — every user sees only their own
  medications, schedule and dashboard; interaction rules stay global

## 5. Technology Stack

| Layer | Technology | Used for |
|---|---|---|
| Frontend | **React 18 + Vite + JavaScript + CSS** | UI, pages, components |
| Backend | **Node.js + Express** | REST API routes on top of JSON Server |
| Persistence | **JSON Server + `db.json`** | JSON file database with REST CRUD |
| Authentication | **bcryptjs** (password hashing) + server session tokens | signup / login / logout |
| Testing | **Node's built-in test runner (`node:test`)** + `npm run build` + browser verification | unit tests, production build |

No MongoDB, authentication, Redux or other libraries — kept simple on
purpose. The testing section reflects the tools actually used in this
project.

## 6. Architecture

```
React (browser)
   ↓  fetch()  (client/src/services/api.js) with Bearer token
Express API (server/server.js)
   ↓  Authentication (authService.js) → identifies the logged-in user
   ↓  router.db
JSON Server (json-server package)
   ↓  lowdb
db.json  (server/db.json)
```

- **React components** only render data and call functions in `api.js`; they
  never call `fetch()` directly.
- **Express routes** load data from `db.json`, call a service or the
  algorithm, and return JSON.
- **Services** hold pure business logic (schedule generation, conflict
  detection) with no Express or React code.
- **The scheduling algorithm** lives in its own file,
  `server/src/algorithms/conflictResolver.js`, completely separate from the
  Express routes.
- **JSON Server** is the persistence engine behind `db.json`; its router
  still serves the remaining standard endpoint (`/interactionRules`), while
  `/medications` and `/schedules` are handled by the custom user-scoped
  routes in `server.js` that run before it.

See `docs/ARCHITECTURE.md` for the full layered explanation and project flow.

## 7. Folder Structure

```
medication-scheduler/
│
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── components/         # Header, MedicationForm, MedicationList,
│   │   │                       # ScheduleList, ConflictList, ResolutionList
│   │   ├── pages/              # DashboardPage, MedicationsPage, SchedulePage,
│   │   │                       # LoginPage, SignupPage (Phase 7)
│   │   ├── services/
│   │   │   └── api.js          # all fetch calls + session token handling
│   │   ├── utils/
│   │   │   └── validate.js     # frontend validation rules
│   │   ├── App.jsx             # auth state, login/signup screens, tabs
│   │   ├── main.jsx            # React entry point
│   │   └── index.css           # global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── algorithms/
│   │   │   └── conflictResolver.js   # the conflict-resolution algorithm
│   │   ├── services/
│   │   │   ├── scheduleService.js    # schedule generation logic
│   │   │   ├── conflictService.js    # conflict detection logic
│   │   │   └── authService.js        # hashing, tokens, lookups (Phase 7)
│   │   └── utils/
│   │       ├── timeUtils.js          # HH:mm helpers
│   │       ├── validate.js           # backend medication validation
│   │       └── dbUtils.js            # nextId helper
│   ├── test/
│   │   └── conflictResolver.test.js  # node:test suite (22 tests)
│   ├── server.js               # Express + JSON Server entry point
│   └── db.json                 # the JSON database
│
├── docs/
│   ├── ALGORITHM.md            # conflict-resolution algorithm explained
│   ├── API.md                  # every API endpoint documented
│   ├── ARCHITECTURE.md         # layers, responsibilities, project flow
│   ├── TESTING.md              # tests actually run + results
│   └── GIT_GUIDE.md            # recommended phase-based commits
│
├── .gitignore
├── package.json                # root scripts (server, client, test)
└── README.md
```

## 8. How the System Works

```
User signs up / logs in (POST /api/auth/signup | login)
   ↓  session token stored on the client (localStorage)
Every API call sends: Authorization: Bearer <token>
   ↓  backend identifies the user from the token
Medication (stored in db.json, owned by the user)
   ↓  POST /api/schedule/generate
Schedule Generation (scheduleService.js)
   ↓  one entry per preferred time, sorted
Conflict Detection (conflictService.js + GET /api/schedule/conflicts)
   ↓  each matching pair vs. minimum spacing rule
Conflict Resolution (conflictResolver.js + POST /api/schedule/resolve)
   ↓  keep earlier fixed → search 30-min slots → validate → move
Final Schedule (saved back to db.json)
   ↓  visible in the timeline; doses can be marked taken/skipped
Dashboard (GET /api/dashboard) shows live counts
```

### How authentication works

1. `POST /api/auth/signup` creates an account — the password is hashed with
   bcryptjs and never stored or returned as plain text.
2. `POST /api/auth/login` verifies the credentials and creates a session (a
   random token saved in `db.json`); the frontend keeps **only the token**
   in `localStorage`.
3. Every later request sends `Authorization: Bearer <token>`.
4. The backend's `requireAuth` middleware resolves the token to a user and
   filters every medication, schedule and dashboard query by that user's id —
   a logged-in user can only ever see their own data.

### How conflicts are detected

`conflictService.js` compares every pair of schedule entries that matches an
interaction rule (e.g. "Medicine A and Medicine B must be 180 minutes
apart"). When the actual spacing is smaller than the required spacing it
returns a conflict with the required/actual spacing, a severity
(`low` / `medium` / `high`) and a readable message. The frontend shows these
as ⚠ conflict cards and the dashboard counts them live.

## 9. Conflict Resolution Algorithm

For every detected conflict the algorithm follows one simple rule:

> **Keep the earlier medication fixed. Move the later medication.**

1. Convert every `HH:mm` time to minutes since midnight.
2. Search forward from the later medication's current time in 30-minute
   steps (e.g. `09:30`, `10:00`, `10:30`, …) until `23:59`.
3. Test each candidate against **every** interaction rule that mentions the
   medication being moved. A candidate is rejected if it would create any
   new conflict.
4. Take the **first valid candidate** — the nearest valid slot.
5. Move the entry (keeping its `originalTime`), then **re-check the whole
   schedule** and repeat until no conflicts remain.
6. If no valid slot exists in the day, the conflict is reported as
   **unresolved** and the medication is left untouched.

Full explanation, worked examples and time complexity:
`docs/ALGORITHM.md`.

## 10. Installation

> Requires Node.js 18+ and npm.

```bash
cd medication-scheduler
npm install                 # Express + JSON Server (root)
npm install --prefix client # React + Vite (client)
```

Or run both installs at once:

```bash
npm run install:all
```

## 11. Running the Application

Two terminals, from the project root:

**Terminal 1 — backend (Express + JSON Server on port 3001):**

```bash
npm run server
```

**Terminal 2 — frontend (Vite dev server):**

```bash
npm run client
```

Open **http://localhost:5173** in the browser. The frontend uses relative
API URLs; the Vite dev server proxies `/api` and `/medications` to the
backend on **http://localhost:3001** (see `client/vite.config.js`).

### Production / single-server mode

One Node process serves the built React app and the API together:

```bash
npm run build            # build the React app into client/dist
npm start                # node server/server.js — serves the app + the API
```

Open **http://localhost:3001**. The server reads the `PORT` environment
variable when set (defaults to 3001).

## 12. API Endpoints

All endpoints are documented in detail in `docs/API.md`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create an account (hashed password) |
| POST | `/api/auth/login` | Log in, returns a session token |
| POST | `/api/auth/logout` | Invalidate the session |
| GET | `/api/auth/me` | Restore the session after a refresh |
| GET | `/medications` | List the **user's** medications (auth required) |
| POST | `/medications` | Create a medication for the user (auth required) |
| GET | `/medications/:id` | Get one of the user's medications (auth required) |
| PUT | `/medications/:id` | Replace a medication (auth required, validated) |
| DELETE | `/medications/:id` | Delete one of the user's medications (auth required) |
| GET | `/api/schedule` | Get the user's current schedule (auth required) |
| POST | `/api/schedule/generate` | Rebuild the user's schedule (auth required) |
| PATCH | `/api/schedule/:id/status` | Set a dose's status (auth required) |
| GET | `/api/interaction-rules` | List the **global** interaction rules |
| GET | `/api/schedule/conflicts` | Detect conflicts in the user's schedule (auth required) |
| POST | `/api/schedule/resolve` | Run automatic conflict resolution (auth required) |
| GET | `/api/dashboard` | The user's live statistics (auth required) |

Most endpoints return `401 { "error": "Please log in to continue." }` when no
valid session token is sent. See `docs/API.md` for the full details.

## 13. Testing

```bash
npm test
```

Runs the zero-dependency suite (`node --test`) covering schedule generation,
sorting, unique ids, conflict detection, conflict resolution (all spec test
cases), unresolved conflicts, idempotency, edge cases and backend
validation.

```bash
npm run build
```

Builds the production frontend bundle into `client/dist` (equivalent to
`npm run build --prefix client`; must complete without errors).

The full list of tests actually run and their results (unit, API-level,
browser end-to-end) is in `docs/TESTING.md`.

## 14. Example Demo

1. The seed data already contains:

   - **Medicine A → 08:00**
   - **Medicine B → 09:00**
   - Rule: **minimum spacing 180 minutes**

2. Open the **Daily Schedule** tab and click **Generate Today's Schedule**
   — both doses appear at their preferred times.
3. Click **Check for Conflicts** — a conflict is reported (actual spacing
   `60 min < 180 min`).
4. Click **Resolve Conflicts** — the resolver keeps Medicine A at 08:00 and
   searches candidates for Medicine B (`09:30`, `10:00`, `10:30`, `11:00`).
   The first valid slot is **11:00** (exactly 180 minutes from 08:00).
5. The timeline now shows Medicine B at **11:00** with the note
   **"↻ Rescheduled from 09:00"** and a green **Conflict Resolved** card
   (Original 09:00 → New 11:00).
6. Mark the paracetamol dose **Taken** and refresh — the status persists.

## 15. Limitations

- **JSON Server + `db.json`** is lightweight project persistence, not a
  production database — see the deployment note below.
- **Interaction rules are demonstration/test data**, not medical facts.
- The project **does not provide medical advice** and is not a replacement
  for professional medical guidance.
- Conflict resolution only searches forward within the same day and never
  backtracks a previously-failed move (by design — see `docs/ALGORITHM.md`).
- If `db.json` is missing or invalid when the server starts, the server will
  not start; the frontend shows friendly messages when the API is
  unreachable at runtime.
- **Authentication limitation:** sessions are server-generated tokens stored
  in `db.json` and passwords are bcrypt-hashed, but this is a college-level
  authentication layer (no email verification, no password reset, no rate
  limiting, no production security guarantees).

## 16. Future Scope

Ideas that were intentionally **not** implemented (future work only):

- Real medical interaction database
- Authentication / caregiver accounts
- MongoDB instead of JSON Server
- Notifications / reminders
- Mobile application

## 17. Deployment Notes

The project runs as a **traditional Node/Express service** and can be hosted
on any server that can run Node.js (e.g. a VPS or a Node platform):

```bash
npm install                     # root dependencies (Express + JSON Server)
npm run build                   # install client deps + build the React app
node server/server.js           # serves the React app and the API (one service)
```

**Important limitation:** the database is a single JSON file (`db.json`)
held in memory by JSON Server and written back on every change. A serverless
or ephemeral filesystem (e.g. many PaaS/FaaS environments) may lose or reset
that file, so this architecture is best suited to a persistent disk, a
demonstration environment, or a college evaluation server. No deployment has
been performed or claimed beyond local verification.

---

**Phases 1–6:** medication management ✓ · schedule generation ✓ · conflict
detection ✓ · automatic conflict resolution ✓ · dashboard & statuses ✓ ·
documentation & polish ✓

**Phase 7:** authentication ✓ — signup, login, logout, session restore and
user-specific medications / schedules / dashboard statistics.
