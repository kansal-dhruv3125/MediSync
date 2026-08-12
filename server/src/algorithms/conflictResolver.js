// ---------------------------------------------------------------------------
// conflictResolver.js - Phase 4: automatic conflict resolution algorithm.
//
// This file has NO React and NO Express code. It is a pure algorithm that
// receives a schedule and the interaction rules, and returns:
//
//   {
//     schedule:            the updated schedule (rescheduled entries moved),
//     resolvedConflicts:   one result object per successfully moved entry,
//     unresolvedConflicts: one result object per conflict that could not be
//                          fixed (no valid slot exists in the day),
//     message:             a short status message (e.g. when there is nothing
//                          to do).
//   }
//
// THE SIMPLE RULE (documented for the viva):
//   "Keep the earlier medication fixed. Try moving the later medication."
//   No priority systems: we never decide "this medication is more important".
// ---------------------------------------------------------------------------

const { detectConflicts } = require('../services/conflictService.js')
const {
  timeToMinutes,
  minutesToTime,
  compareTimes,
} = require('../utils/timeUtils.js')

// Search step: candidates are generated every 30 minutes (e.g. 09:30, 10:00…)
const SEARCH_STEP_MINUTES = 30

// The last time of the day that is allowed (23:59). "24:00" must never appear.
const END_OF_DAY_MINUTES = 23 * 60 + 59

// Safety cap so the loop can never run forever (see resolveConflicts below).
const MAX_PASSES = 500

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------
function resolveConflicts(schedule, interactionRules) {
  // Work on a copy so the caller's schedule array is never mutated.
  const working = schedule.map((entry) => ({ ...entry }))

  // Nothing to do -> the schedule stays exactly as it is.
  if (working.length === 0 || interactionRules.length === 0) {
    return {
      schedule: working,
      resolvedConflicts: [],
      unresolvedConflicts: [],
      message: 'No conflicts require resolution.',
    }
  }

  const resolvedConflicts = []
  const unresolvedConflicts = []

  // Entries that could not be moved. They are remembered so the loop never
  // tries the same hopeless move twice (which would loop forever).
  const failedEntries = new Set()

  // Loop: detect conflicts -> move ONE entry -> re-detect conflicts.
  // Re-checking after every move is essential: moving an entry can create a
  // brand new conflict elsewhere, and the next pass will catch it.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const conflicts = detectConflicts(working, interactionRules)

    // 1. No conflicts left -> the schedule is valid. Done.
    if (conflicts.length === 0) break

    // 2. Pick the first conflict whose entry can still be moved. Conflicts
    //    whose entry already failed are skipped so we do not repeat them.
    let target = null
    for (const conflict of conflicts) {
      const { entryToMove, fixedEntry } = identifyMove(working, conflict)
      if (!entryToMove || !fixedEntry || entryToMove === fixedEntry) continue
      if (!failedEntries.has(entryToMove)) {
        target = { conflict, entryToMove }
        break
      }
    }      // 3. Every remaining conflict involves an entry that already failed.
      //    Report them all as unresolved and stop.
      if (!target) {
        for (const conflict of conflicts) {
          const { entryToMove } = identifyMove(working, conflict)
          if (
            entryToMove &&
            !unresolvedAlready(unresolvedConflicts, entryToMove, conflict)
          ) {
            unresolvedConflicts.push(
              buildConflictResult(conflict, entryToMove, null)
            )
          }
        }
        break
      }

    const { conflict, entryToMove } = target

    // 4. Search for the nearest valid candidate time (same day, forward,
    //    in 30-minute steps).
    const candidateMinutes = findNearestValidTime(
      entryToMove,
      working,
      interactionRules
    )

    // 5. No valid slot exists -> mark the entry as failed, report the
    //    conflict as unresolved and leave the medication untouched.
    if (candidateMinutes === null) {
      failedEntries.add(entryToMove)
      if (!unresolvedAlready(unresolvedConflicts, entryToMove, conflict)) {
        unresolvedConflicts.push(buildConflictResult(conflict, entryToMove, null))
      }
      continue
    }

    // 6. Move the entry. The original time is kept so the UI can explain
    //    what changed.
    const originalTime = entryToMove.scheduledTime
    entryToMove.originalTime = entryToMove.originalTime || originalTime
    entryToMove.scheduledTime = minutesToTime(candidateMinutes)
    entryToMove.rescheduled = true

    resolvedConflicts.push(
      buildConflictResult(conflict, entryToMove, entryToMove.scheduledTime)
    )

    // 7. Loop again -> conflicts are re-detected on the updated schedule.
  }

  // Always return the schedule sorted chronologically.
  working.sort((a, b) => compareTimes(a.scheduledTime, b.scheduledTime))

  const message =
    resolvedConflicts.length === 0 && unresolvedConflicts.length === 0
      ? 'No conflicts require resolution.'
      : undefined

  return { schedule: working, resolvedConflicts, unresolvedConflicts, message }
}

// ---------------------------------------------------------------------------
// Which medication moves?
// The earlier medication stays fixed; the later medication is the one that
// is moved. Returns the two schedule entries involved in the conflict.
// ---------------------------------------------------------------------------
function identifyMove(schedule, conflict) {
  const entryA = findEntry(schedule, conflict.medicationA, conflict.timeA)
  const entryB = findEntry(schedule, conflict.medicationB, conflict.timeB)

  // Equal times: medicationA is arbitrarily treated as "earlier".
  if (compareTimes(conflict.timeA, conflict.timeB) <= 0) {
    return { fixedEntry: entryA, entryToMove: entryB }
  }
  return { fixedEntry: entryB, entryToMove: entryA }
}

// Finds a schedule entry by medication name and time (first match).
function findEntry(schedule, medicationName, scheduledTime) {
  return schedule.find(
    (entry) =>
      entry.medicationName === medicationName &&
      entry.scheduledTime === scheduledTime
  )
}

// ---------------------------------------------------------------------------
// Candidate time search.
// Starts just after the entry's current time and walks forward in 30-minute
// steps to the end of the day (23:59). The first valid candidate wins.
// Returns minutes-since-midnight, or null when the day has no valid slot.
// ---------------------------------------------------------------------------
function findNearestValidTime(entryToMove, schedule, interactionRules) {
  const startMinutes = timeToMinutes(entryToMove.scheduledTime)

  for (
    let minutes = startMinutes + SEARCH_STEP_MINUTES;
    minutes <= END_OF_DAY_MINUTES;
    minutes += SEARCH_STEP_MINUTES
  ) {
    const candidate = minutesToTime(minutes)
    if (isValidCandidateTime(entryToMove, candidate, schedule, interactionRules)) {
      return minutes
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Valid candidate check.
// A candidate time is valid only if it satisfies EVERY interaction rule that
// mentions the moving medication. Each rule is checked against every entry
// of the other medication, so moving one entry can never create a new
// conflict somewhere else.
// ---------------------------------------------------------------------------
function isValidCandidateTime(entryToMove, candidateTime, schedule, interactionRules) {
  const candidateMinutes = timeToMinutes(candidateTime)

  for (const rule of interactionRules) {
    // The moving medication appears as medicationA in this rule
    if (rule.medicationA === entryToMove.medicationName) {
      for (const other of schedule) {
        if (other.medicationName !== rule.medicationB) continue
        if (other === entryToMove) continue
        const spacing = Math.abs(candidateMinutes - timeToMinutes(other.scheduledTime))
        if (spacing < rule.minimumSpacingMinutes) return false
      }
    }

    // The moving medication appears as medicationB in this rule
    if (rule.medicationB === entryToMove.medicationName) {
      for (const other of schedule) {
        if (other.medicationName !== rule.medicationA) continue
        if (other === entryToMove) continue
        const spacing = Math.abs(candidateMinutes - timeToMinutes(other.scheduledTime))
        if (spacing < rule.minimumSpacingMinutes) return false
      }
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Conflict result object (resolved AND unresolved use the same shape).
// medicationB is always the medication that was (or should have been) moved,
// so the frontend can render both cases with one simple template.
// ---------------------------------------------------------------------------
function buildConflictResult(conflict, entryToMove, newTime) {
  const movedMedication = entryToMove.medicationName
  // The other medication in the pair is the one that stays fixed
  const fixedMedication =
    movedMedication === conflict.medicationA
      ? conflict.medicationB
      : conflict.medicationA

  // The time the moved entry had when the conflict was detected. For a
  // resolved move, entryToMove.originalTime was already set to this value.
  const movedConflictTime =
    conflict.medicationB === movedMedication ? conflict.timeB : conflict.timeA
  const originalTime = entryToMove.originalTime || movedConflictTime

  return {
    medicationA: fixedMedication,
    medicationB: movedMedication,
    originalTime,
    newTime, // null when unresolved
    requiredSpacing: conflict.requiredSpacing,
    actualSpacing: conflict.actualSpacing,
    severity: conflict.severity,
    resolved: newTime !== null,
    message: newTime
      ? `${movedMedication} was moved from ${originalTime} to ${newTime}.`
      : 'No valid time slot was found.',
  }
}

// True when the same conflict (same moved entry, same original time) was
// already reported as unresolved, so it is never reported twice.
function unresolvedAlready(unresolvedConflicts, entryToMove, conflict) {
  const movedMedication = entryToMove.medicationName
  const movedConflictTime =
    conflict.medicationB === movedMedication ? conflict.timeB : conflict.timeA
  return unresolvedConflicts.some(
    (u) => u.medicationB === movedMedication && u.originalTime === movedConflictTime
  )
}

module.exports = { resolveConflicts }
