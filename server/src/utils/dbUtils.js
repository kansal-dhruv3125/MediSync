// ---------------------------------------------------------------------------
// dbUtils.js - small helpers for working with the lowdb database.
// ---------------------------------------------------------------------------

// Returns the next free numeric id for a collection, based on the highest
// existing id. Used for users, sessions, medications and schedule entries.
function nextId(db, collectionName) {
  const entries = db.get(collectionName).value() || []
  const max = entries.reduce((highest, entry) => {
    return entry.id && entry.id > highest ? entry.id : highest
  }, 0)
  return max + 1
}

module.exports = { nextId }
