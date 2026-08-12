# Phase 4 — Automatic Conflict Resolution Algorithm

**File:** `server/src/algorithms/conflictResolver.js`

This document explains the algorithm **exactly as implemented**, in simple
language suitable for a viva. It receives a schedule and the interaction
rules, and returns an updated schedule plus resolved/unresolved conflict
reports.

---

## Input

The algorithm receives:

1. **medication schedule** — a list of entries. Each entry has a medication
   name and a `scheduledTime` (an `HH:mm` string, e.g. `"09:00"`).
2. **interaction rules** — a list of rules. Each rule has `medicationA`,
   `medicationB` and `minimumSpacingMinutes` (e.g. 180).

> **Phase 7 note:** the algorithm itself knows nothing about users. The
> Express route passes it the **logged-in user's** schedule and the global
> interaction rules — authentication only decides whose data flows in, so
> the algorithm behaves exactly as it did before Phase 7.

The output is `{ schedule, resolvedConflicts, unresolvedConflicts, message }`.
The algorithm is a **pure function**: it never talks to Express, the database
or the UI. The API route (`POST /api/schedule/resolve`) only loads the data,
calls the algorithm and saves the result.

---

## Step 1 — Convert HH:mm to minutes

Every time string is converted to *minutes since midnight* with
`timeToMinutes()` (from `server/src/utils/timeUtils.js`):

```
"08:00" → 480
"09:00" → 540
"11:00" → 660
```

Spacing becomes plain arithmetic: `540 − 480 = 60` minutes. The reverse
helper `minutesToTime()` is used when writing a new time back (it clamps so
an invalid time like `24:00` can never be produced).

## Step 2 — Detect conflicting pairs

The algorithm reuses Phase 3's `detectConflicts()`. For every rule it finds
all entries of `medicationA` and all entries of `medicationB`, and for every
pair it computes the actual spacing. If the actual spacing is smaller than
`minimumSpacingMinutes`, the pair is a conflict.

## Step 3 — Keep the earlier medication fixed

For each conflict, the two times are compared. **The earlier medication
stays fixed; the later medication is the one that may move.** This simple
rule is applied to every conflict — no priority systems, no importance
scores.

## Step 4 — Generate nearby candidate times

Candidates are generated **forward** from the later medication's current
time in **30-minute steps** (constant `SEARCH_STEP_MINUTES = 30`), e.g.:

```
09:30, 10:00, 10:30, 11:00, 11:30, …
```

The search stays within the same day and stops at `23:59`
(`END_OF_DAY_MINUTES = 23 * 60 + 59`). Times are never allowed past the end
of the day, so `24:00` can never appear.

## Step 5 — Check every candidate against all relevant rules

Each candidate is tested by `isValidCandidateTime()`. A candidate is valid
only if, at that time, the moving medication satisfies **every** rule that
mentions it — checked against **every** entry of the other medication. If a
candidate would create a new conflict with any other medication, it is
**rejected**. This guarantee is what stops the algorithm from solving one
conflict by creating another.

## Step 6 — Choose the nearest valid candidate

The search walks the candidates in order and returns the **first** valid
one. This is a greedy choice: the nearest (earliest) valid slot wins.

## Step 7 — Update the schedule

The entry is moved: `scheduledTime` becomes the new time, `originalTime`
keeps the old requested time (so the UI can explain what changed), and the
entry is flagged `rescheduled: true`.

## Step 8 — Re-check the entire schedule

The loop goes back to Step 2 and detects conflicts **again on the updated
schedule**. It never assumes the schedule is valid just because the original
conflict disappeared — a moved medication can participate in a different
conflict. The loop continues until no conflicts remain, or until every
remaining conflict involves an entry that already failed to move.

## Step 9 — If no valid candidate exists, mark the conflict unresolved

When the day runs out without a valid candidate, the conflict is added to
`unresolvedConflicts` (with `newTime: null`, `resolved: false`), the entry is
remembered as "failed" so it is never retried, and the medication is **left
exactly where it was**. The algorithm never forces a solution.

---

## Example

| Medication | Preferred time |
|---|---|
| Medicine A | 08:00 |
| Medicine B | 09:00 |

Rule: A and B must be **180 minutes** apart.

1. Convert: `08:00 = 480`, `09:00 = 540` → actual spacing `60 < 180` →
   **conflict detected** (Step 2).
2. Keep A (08:00) fixed; try moving B (Step 3).
3. Candidate search for B in 30-minute steps (Steps 4–6):

   ```
   09:30 → 90 min from A  → too close, rejected
   10:00 → 120 min from A → too close, rejected
   10:30 → 150 min from A → too close, rejected
   11:00 → 180 min from A → valid ✅ (first valid candidate)
   ```

4. Result: `Medicine A → 08:00`, `Medicine B → 11:00` (Step 7). The
   re-check (Step 8) finds no further conflicts.

### A candidate that must be rejected

| Medication | Time |
|---|---|
| Medicine A | 08:00 |
| Medicine B | 09:00 |
| Medicine C | 12:00 |

Rules: A–B needs 180 min, B–C needs 120 min.

For B, `11:00` is valid against A (180 min) but only 60 min from C, so it is
**rejected** (Step 5). The search continues until `14:00` — exactly 120 min
from C and 360 min from A — which is the first valid slot.

---

## Time complexity (of this implementation)

Let:

- `N` = number of schedule entries,
- `R` = number of interaction rules,
- `C` = number of candidate times per move — at most 48 in a day with a
  30-minute step (from `00:30` to `23:59`).

Per pass through the loop:

- **Conflict detection** (Step 2) reuses Phase 3: for every rule it checks
  every pair of matching entries, worst case **O(R · N²)**.
- **Candidate search** (Steps 4–6) tests at most `C` candidates, each
  checked against all rules and their entries, worst case **O(C · R · N)**.

Every successful move pushes the entry's time strictly forward and the day
is finite, so the loop always terminates (`MAX_PASSES = 500` is a safety
cap). With at most O(N) moves:

- **Total worst case: O(N · (R · N² + C · R · N)) = O(R · N³)**, with `C`
  treated as the small constant 48.

In practice the schedule is one day with a handful of medications (`N`
typically < 10), so the algorithm runs instantly. This is an honest, simple
bound — no claim of better-than-O(R·N³) is made.

---

## Known simplifications (documented behaviour)

- **Rules between the same medication** (e.g. two doses of one drug): the
  pair is reported as unresolved rather than moved, because "keep the
  earlier fixed" cannot pick a distinct fixed entry. The seeded demo data
  never uses such rules.
- **Duplicate entries at the exact same time**: the generator never creates
  these (regenerating clears the schedule first), so the algorithm simply
  handles them one at a time.
- **No backtracking:** once an entry has no valid slot it is marked failed
  and never retried. This guarantees termination; with a small daily
  schedule it is never noticeable.

## Why repeated clicks do not keep moving medications

The algorithm only moves an entry when a conflict is detected at its current
time. If the schedule is already valid, conflict detection returns nothing,
both conflict lists are empty, and the message is
**"No conflicts require resolution."** — every entry stays exactly where it
is, including previously rescheduled ones.

---

## Medical disclaimer

This is an educational medication scheduling project. Demonstration
interaction rules are fictional and should not be used for real medical
decisions. Consult a qualified healthcare professional for medication advice.
