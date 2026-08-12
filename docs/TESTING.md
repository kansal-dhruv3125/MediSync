# Testing

This document records the tests **actually performed** on this project and
their results. Everything below was run during the final verification; no
unrun test is claimed as passing.

## How to run the tests

```bash
npm test                      # unit tests (Node's built-in runner)
npm run build --prefix client # production frontend build
```

The unit tests live in `server/test/` (`conflictResolver.test.js` and
`reminderService.test.js`) and use only Node's built-in `node:test` module —
no test framework is installed.

## 0. Test count history

- Phase 1–6: **16 tests** → all pass
- Phase 7 added 6 authentication tests → **22 tests, all pass** (`npm test`)
- Phase 8 added 8 reminder tests → **30 tests, all pass** (`npm test`)

## 1c. Email reminder tests (Phase 8)

The reminder tests replace the real email sender with a fake one (injected
into `checkDueReminders`), so no SMTP server is needed and no real email is
ever sent. They live in `server/test/reminderService.test.js`.

| # | Test | Result |
|---|---|---|
| 23 | Reminder goes to the OWNER of the dose (user isolation) | ✅ pass |
| 24 | Reminder contains the right medication, dosage and scheduled time | ✅ pass |
| 25 | An already-notified dose is NOT reminded twice | ✅ pass |
| 26 | Taken, skipped and future doses are not reminded | ✅ pass |
| 27 | A failing email never breaks the other reminders | ✅ pass |
| 28 | A user can never receive another user's reminder | ✅ pass |
| 29 | A sent dose is marked and never reminded after a refresh | ✅ pass |
| 30 | Simulated mode (no SMTP) sends nothing and does not mark the dose | ✅ pass |

Live verification additionally confirmed (single server, log mode):

- Server starts and runs normally with **no** `EMAIL_*` variables set
- A due dose (past scheduled time, pending) triggers the check → the exact
  email is printed to the server console labelled **SIMULATED**
- The same dose is not re-emailed on the next check (in real mode it is
  marked `notificationSent: true`)
- Conflict detection / resolution, statuses and the dashboard all keep
  working while the reminder engine runs

## 1b. Authentication tests (Phase 7)

| # | Test | Result |
|---|---|---|
| 17 | Passwords are hashed (bcrypt), never stored as plain text | ✅ pass |
| 18 | Session tokens are random and unique | ✅ pass |
| 19 | `toPublicUser` never returns the password hash | ✅ pass |
| 20 | `findUserByEmail` is case-insensitive | ✅ pass |
| 21 | `validateSignup` enforces name/email/password rules | ✅ pass |
| 22 | Signup → login → logout session flow (service level) | ✅ pass |

Live API verification (server + curl) additionally confirmed:

- Signup with valid data → `201` with the public user
- Signup with duplicate email (case-insensitive) → `400` "Email is already registered."
- Signup with a short password → `400`
- Login with correct credentials → `200` + session token
- Login with wrong password → `401` "Invalid email or password."
- `GET /api/auth/me` with a valid token → the user; without a token → `401`
- **User isolation (the critical test):**
  - User A registers and adds "Medicine A"
  - User B registers — "Medicine A" is **not visible**
  - User B adds "Medicine B" — User A still sees only "Medicine A"
  - User A PUT/DELETE on User B's medication → `404` (cannot modify other
    users' data)
- `GET /users`, `GET /sessions`, `GET /schedules` (raw collections) → `404`
- Logout invalidates the token → `me` and `/medications` return `401`

Browser end-to-end (10/10 steps, 0 console errors):

1. App opens on Login, not the dashboard ✅
2. Wrong password → "Invalid email or password." ✅
3. Demo login → "Welcome, Demo User" + correct stat cards ✅
4. Medications tab lists the demo user's 3 medications ✅
5. Generate → Check → Resolve (B moved to 11:00) ✅
6. Page reload → still logged in (token persistence) ✅
7. Logout → back to Login, protected tabs gone ✅
8. Signup empty submit → field validation messages ✅
9. Valid signup → "Account created successfully. Please log in." ✅
10. New user logs in → "Welcome, Test User", 0 medications, empty state ✅

## 1. Unit tests (Phases 1–6) — `npm test` → **16/16 pass, 0 fail**

| # | Test | Result |
|---|---|---|
| 1 | TEST 1 — no conflict: schedule stays unchanged | ✅ pass |
| 2 | TEST 2 — simple conflict: B moves to the nearest valid slot (09:00 → 11:00) | ✅ pass |
| 3 | TEST 3 — a candidate that creates another conflict is rejected (B → 14:00) | ✅ pass |
| 4 | TEST 4 — no valid slot: conflict stays unresolved, nothing moves | ✅ pass |
| 5 | TEST 5 — multiple conflicts resolved without creating new ones | ✅ pass |
| 6 | TEST 6 — existing functionality: schedule generation + conflict detection still work | ✅ pass |
| 7 | Repeated resolution does not keep moving medications (idempotent) | ✅ pass |
| 8 | Edge — empty schedule | ✅ pass |
| 9 | Edge — no interaction rules | ✅ pass |
| 10 | Edge — one medication only | ✅ pass |
| 11 | Edge — two medications at the same time | ✅ pass |
| 12 | Edge — input schedule is not mutated by the resolver | ✅ pass |
| 13 | Edge — `minutesToTime` never produces invalid times like 24:00 | ✅ pass |
| 14 | Phase 5 — `generateSchedule` assigns a unique id to every entry (no duplicates) | ✅ pass |
| 15 | Phase 6 — backend `validateMedication` rejects invalid data (name/dose/frequency/time) | ✅ pass |
| 16 | Phase 6 — backend `validateMedication` accepts valid data | ✅ pass |

Coverage by category:

- **Schedule generation & sorting** — tests 1, 6, 14
- **Conflict detection** — tests 1, 6
- **Conflict resolution** — tests 2, 3, 5
- **Unresolved conflicts** — test 4
- **Multiple conflicts** — tests 3, 5
- **Idempotency** — test 7
- **Status update** — validated through the API tests below (PATCH endpoint)
- **Error handling / validation** — tests 15, 16 plus the API tests below

## 2. API-level tests (live server + curl)

Performed against the running server (`npm run server`) on port 3001:

| Test | Result |
|---|---|
| Medication CRUD — POST / PUT / DELETE `/medications` | ✅ pass |
| Invalid medication POST (bad data) → HTTP 400 | ✅ pass |
| `POST /api/schedule/generate` → 3 sorted entries with unique ids | ✅ pass |
| `GET /api/schedule/conflicts` → A/B conflict, actual spacing 60 | ✅ pass |
| `POST /api/schedule/resolve` → Medicine B moved 09:00 → 11:00 | ✅ pass |
| Repeated resolve → `"No conflicts require resolution."`, B stays 11:00 | ✅ pass |
| Unresolvable scenario (22:00 / 23:00, 180-min rule) → 1 unresolved, B untouched | ✅ pass |
| `PATCH /api/schedule/:id/status` `{status:"taken"}` → entry updated | ✅ pass |
| `PATCH` `{status:"skipped"}` → entry updated | ✅ pass |
| `PATCH` invalid status → HTTP 400 | ✅ pass |
| `PATCH` unknown id → HTTP 404 | ✅ pass |
| Status persisted to `db.json` on disk | ✅ pass |
| `GET /api/dashboard` counts reflect statuses (pending/taken/skipped) | ✅ pass |
| No duplicate schedule entries after regenerating | ✅ pass |
| `db.json` restored to the seeded state after testing | ✅ pass |

## 3. Browser end-to-end test (Chrome, against the real UI)

The full viva demo flow was walked in a real browser at `http://localhost:5173`
(backend on 3001). **9/9 steps passed, 0 console errors.**

> Note: after this run, the timeline's conflict-summary rendering was
> adjusted (Phase 6 polish) and re-verified via the production build and a
> smoke test; the interactive steps above are the ones that were actually
> clicked through in a browser.

1. Dashboard default state: Total Medications 3, Today's Doses 3, Conflicts 1, Resolved 0 ✅
2. Navigate to Daily Schedule tab ✅
3. Generate Today's Schedule → Medicine A 08:00, Medicine B 09:00, paracetamol 12:00 ✅
4. Check for Conflicts → conflict card + "Conflicts detected: 1" ✅
5. Resolve Conflicts → B at 11:00, "↻ Rescheduled from 09:00", green Conflict Resolved card, summary Resolved 1 / Unresolved 0 ✅
6. Mark Taken on paracetamol → badge "✓ Taken" ✅
7. Skip on remaining pending entry → badge "— Skipped" ✅
8. Reload the page → Taken/Skipped badges persist ✅
9. Dashboard after reload → Conflicts 0, Resolved 1, Taken 1, Skipped 1 ✅

## 4. Frontend production build

```bash
npm run build --prefix client
```

Result: **success** — Vite transformed 38 modules and produced the
`client/dist` bundle without errors (verified after every phase, including
the final phase).

## 5. Note on honesty

- The unit test count reflects the suite **at the time of writing**
  (30 tests). If you modify the code, re-run `npm test` and update this
  document.
- Tests 1–13 correspond to the Phase 4 spec's TEST 1–6 plus edge cases;
  tests 14–16 were added in Phase 5 and Phase 6.
