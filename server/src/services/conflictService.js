// ---------------------------------------------------------------------------
// conflictService.js - interaction conflict detection business logic.
// This file has NO React and NO Express code: it only compares a schedule
// against interaction rules, so it is easy to test in isolation.
// ---------------------------------------------------------------------------

const { calculateSpacing, compareTimes } = require('../utils/timeUtils.js')

// Checks a generated schedule against the interaction rules and returns a
// list of conflicts.
//
// How it works, in simple terms:
//   1. For each interaction rule (e.g. "Medicine A" and "Medicine B" must be
//      at least 180 minutes apart), find every schedule entry that belongs to
//      medicationA and every entry that belongs to medicationB.
//   2. For each such pair, measure the actual spacing between their times.
//   3. If the actual spacing is SMALLER than the required minimum spacing,
//      the pair is a conflict and gets added to the result.
//
// No medications are moved or rescheduled here - Phase 3 only reports.
function detectConflicts(schedule, interactionRules) {
  const conflicts = []

  for (const rule of interactionRules) {
    const entriesA = schedule.filter((e) => e.medicationName === rule.medicationA)
    const entriesB = schedule.filter((e) => e.medicationName === rule.medicationB)

    for (const entryA of entriesA) {
      for (const entryB of entriesB) {
        // A rule never applies a medication to itself
        if (entryA === entryB) continue

        // How far apart are these two doses in minutes? (always positive)
        const actualSpacing = calculateSpacing(entryA.scheduledTime, entryB.scheduledTime)

        // Conflict = the doses are too close together
        if (actualSpacing < rule.minimumSpacingMinutes) {
          conflicts.push({
            medicationA: entryA.medicationName,
            timeA: entryA.scheduledTime,
            medicationB: entryB.medicationName,
            timeB: entryB.scheduledTime,
            requiredSpacing: rule.minimumSpacingMinutes,
            actualSpacing,
            severity: rule.severity,
            message: rule.message,
            resolved: false,
          })
        }
      }
    }
  }

  // Show the most urgent conflicts first: earliest timeA, then earliest timeB
  conflicts.sort(
    (a, b) => compareTimes(a.timeA, b.timeA) || compareTimes(a.timeB, b.timeB)
  )

  return conflicts
}

module.exports = { detectConflicts }
