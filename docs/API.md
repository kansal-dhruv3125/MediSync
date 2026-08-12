# API Documentation

Base URL (development): **http://localhost:3001** — in development the Vite
dev server proxies the frontend's `/api` and `/medications` calls here. In
production the API is served from the **same origin** as the frontend, so
the client uses relative URLs (see `README.md` § Running the Application).

Every endpoint below actually exists in the code (`server/server.js` plus the
JSON Server router). All responses are JSON.

Conventions:

- `400 Bad Request` → invalid input
- `401 Unauthorized` → missing or invalid session token
- `404 Not Found` → resource does not exist (or belongs to another user)
- `500 Internal Server Error` → unexpected failure (generic message, no
  stack trace)

## Authentication (Phase 7)

Since Phase 7, protected endpoints require a session token. Send it as an
`Authorization` header:

```
Authorization: Bearer <token>
```

The token comes from `POST /api/auth/login`. Without a valid token, protected
endpoints return `401 { "error": "Please log in to continue." }`. Medication
and schedule data is always filtered to the logged-in user; a user can never
read or modify another user's data.

---

## Authentication endpoints

### `POST /api/auth/signup`

Create an account. Passwords are hashed with bcryptjs — the plain password is
never stored or returned.

**Request body:**

```json
{ "name": "Dhruv", "email": "dhruv@example.com", "password": "123456" }
```

**Response 201:**

```json
{ "user": { "id": 1, "name": "Dhruv", "email": "dhruv@example.com" } }
```

**Errors:**

- `400` `{ "error": "Email is already registered." }` (duplicate email)
- `400` `{ "error": "Full name is required." }` / `"Enter a valid email
  address."` / `"Password must contain at least 6 characters."`

### `POST /api/auth/login`

Verify credentials and start a session.

**Request body:**

```json
{ "email": "dhruv@example.com", "password": "123456" }
```

**Response 200:**

```json
{
  "user": { "id": 1, "name": "Dhruv", "email": "dhruv@example.com" },
  "token": "5f4dcc3b5aa765d61d8327deb882cf99..."
}
```

**Errors:**

- `400` `{ "error": "Email and password are required." }`
- `401` `{ "error": "Invalid email or password." }` (same message for an
  unknown email and a wrong password, so no accounts can be enumerated)

### `POST /api/auth/logout`

Invalidate the current session token (from the Authorization header).

**Response 200:** `{ "message": "Logged out successfully." }`

### `GET /api/auth/me`

Return the logged-in user — used by the frontend to restore a session after
a page refresh.

**Response 200:** `{ "user": { "id": 1, "name": "Dhruv", "email": "..." } }`

**Errors:** `401` `{ "error": "Session expired. Please log in again." }`

---

---

## Medication CRUD (user-scoped since Phase 7)

> All medication endpoints require `Authorization: Bearer <token>` and only
> ever return or modify the **logged-in user's** medications.

### `GET /medications`

List the logged-in user's medications.

**Response 200:**

```json
[
  {
    "id": 1,
    "name": "paracetamol",
    "dose": "600",
    "unit": "mg",
    "frequency": "Once a day",
    "preferredTimes": ["12:00"]
  }
]
```

**Errors:** none.

### `POST /medications`

Create a medication. The body is validated by the backend (`server/src/utils/validate.js`): a non-empty name, a dose greater than 0, a known frequency and the required number of valid `HH:mm` times.

**Request body:**

```json
{
  "name": "Paracetamol",
  "dose": "500",
  "unit": "mg",
  "frequency": "Twice a day",
  "preferredTimes": ["08:00", "20:00"]
}
```

**Response 201** — the created medication with its generated `id`.

**Errors:**

- `400` `{ "error": "Medication name is required." }` (or dose / frequency /
  time error) when the data is invalid.
- `401` when no valid session token is sent.

### `GET /medications/:id`

Get one medication.

**Response 200** — the medication.

**Errors:** `404` when the id does not exist.

### `PUT /medications/:id`

Replace a medication. The same validation as `POST` applies.

**Request body:** the full medication object (all fields).

**Response 200** — the replaced medication.

**Errors:** `400` for invalid data; `404` for an unknown id.

### `DELETE /medications/:id`

Delete a medication.

**Response 200** — `{}` on success.

**Errors:** `404` for an unknown id.

---

## Schedule endpoints (user-scoped since Phase 7)

> All schedule endpoints require `Authorization: Bearer <token>` and operate
> on the **logged-in user's** schedule. Interaction rules stay global.

### `GET /api/schedule`

Return the current daily schedule.

**Response 200:**

```json
{
  "schedule": [
    {
      "id": 1,
      "medicationId": 2,
      "medicationName": "Medicine A",
      "dose": "10",
      "unit": "mg",
      "scheduledTime": "08:00",
      "status": "pending"
    }
  ]
}
```

**Errors:** none (an empty schedule returns `{ "schedule": [] }`).

### `POST /api/schedule/generate`

Rebuild today's schedule from the stored medications: one entry per
preferred time, sorted chronologically, each with a unique `id` and
`status: "pending"`. The previous schedule is replaced (no duplicates).

**Response 200** — `{ "schedule": [ ... ] }`.

**Errors:**

- `400` `{ "error": "There are no medications to schedule. Add a medication first." }`
- `400` `{ "error": "No medications have preferred times, so nothing could be scheduled." }`

### `PATCH /api/schedule/:id/status`

Update one schedule entry's status.

**Request body:**

```json
{ "status": "taken" }
```

Valid values: `pending`, `taken`, `skipped`.

**Response 200** — the updated entry:

```json
{
  "id": 2,
  "medicationName": "Medicine B",
  "scheduledTime": "09:00",
  "status": "taken"
}
```

**Errors:**

- `400` `{ "error": "Status must be one of: pending, taken, skipped." }`
- `404` `{ "error": "Schedule entry not found." }` (also returned when the
  entry belongs to another user)

---

## Interaction endpoints

### `GET /api/interaction-rules`

Return the stored interaction rules.

**Response 200:**

```json
{
  "interactionRules": [
    {
      "id": 1,
      "medicationA": "Medicine A",
      "medicationB": "Medicine B",
      "minimumSpacingMinutes": 180,
      "severity": "medium",
      "message": "Keep at least 3 hours between these medications."
    }
  ]
}
```

**Errors:** none.

### `GET /api/schedule/conflicts`

Check the current schedule against the rules.

**Response 200:**

```json
{
  "conflicts": [
    {
      "medicationA": "Medicine A",
      "timeA": "08:00",
      "medicationB": "Medicine B",
      "timeB": "09:00",
      "requiredSpacing": 180,
      "actualSpacing": 60,
      "severity": "medium",
      "message": "Keep at least 3 hours between these medications.",
      "resolved": false
    }
  ]
}
```

`{ "conflicts": [] }` when nothing violates a rule.

**Errors:** none.

### `POST /api/schedule/resolve`

Run the automatic conflict-resolution algorithm, save the updated schedule,
and return the result. See `docs/ALGORITHM.md` for how it works.

**Response 200:**

```json
{
  "schedule": [
    { "id": 1, "medicationName": "Medicine A", "scheduledTime": "08:00", "status": "pending" },
    { "id": 2, "medicationName": "Medicine B", "originalTime": "09:00", "scheduledTime": "11:00", "status": "pending", "rescheduled": true }
  ],
  "resolvedConflicts": [
    {
      "medicationA": "Medicine A",
      "medicationB": "Medicine B",
      "originalTime": "09:00",
      "newTime": "11:00",
      "requiredSpacing": 180,
      "actualSpacing": 60,
      "severity": "medium",
      "resolved": true,
      "message": "Medicine B was moved from 09:00 to 11:00."
    }
  ],
  "unresolvedConflicts": []
}
```

- An unresolved conflict has `newTime: null`, `resolved: false` and message
  `"No valid time slot was found."`
- When nothing needs to move, both lists are empty and `message` is
  `"No conflicts require resolution."`

**Errors:**

- `400` `{ "error": "The schedule is empty. Generate a schedule first." }`

---

## Dashboard endpoint

### `GET /api/dashboard`

Live statistics computed from the current data — nothing is hard-coded.

**Response 200:**

```json
{
  "totalMedications": 3,
  "todayDoses": 3,
  "pending": 3,
  "taken": 0,
  "skipped": 0,
  "conflicts": 1,
  "resolved": 0
}
```

Definitions:

- `totalMedications` — number of medications
- `todayDoses` — number of schedule entries
- `pending` / `taken` / `skipped` — entries per status
- `conflicts` — conflicts detected in the current schedule
- `resolved` — entries moved by the resolver (`rescheduled: true`)

**Errors:** none.

---

## Error handling summary

| Case | Status | Response |
|---|---|---|
| Invalid medication data (POST/PUT) | 400 | `{ "error": "<first validation message>" }` |
| Unknown medication id | 404 | `{ "error": "Medication not found." }` |
| Duplicate signup email | 400 | `{ "error": "Email is already registered." }` |
| Invalid login credentials | 401 | `{ "error": "Invalid email or password." }` |
| Missing/invalid session token | 401 | `{ "error": "Please log in to continue." }` |
| Invalid schedule status value | 400 | `{ "error": "Status must be one of: ..." }` |
| Unknown schedule entry id | 404 | `{ "error": "Schedule entry not found." }` |
| Generate with no medications | 400 | `{ "error": "There are no medications to schedule..." }` |
| Resolve with empty schedule | 400 | `{ "error": "The schedule is empty..." }` |
| Malformed JSON body | 400 | `{ "error": "Invalid request." }` |
| Unexpected server error | 500 | `{ "error": "An unexpected error occurred. Please try again." }` (no stack trace) |

Passwords and password hashes are never returned by any endpoint, and the
internal `users`, `sessions` and `schedules` collections are blocked from
direct access (`404`).

The frontend shows friendly messages for all of these and never renders raw
server errors or stack traces.
