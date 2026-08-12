// ---------------------------------------------------------------------------
// authService.js - Phase 7: authentication logic (hashing, tokens, lookups).
//
// This file has NO React and NO Express code. It works against the same
// lowdb instance used everywhere else, so it is easy to unit-test with an
// in-memory database.
//
// Approach (simple and viva-friendly):
//   - passwords are hashed with bcryptjs (never stored as plain text)
//   - a login creates a random session token stored in the "sessions"
//     collection; the client keeps only that token
//   - a token is looked up server-side to identify the logged-in user
// ---------------------------------------------------------------------------

const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Hashes a plain-text password (bcrypt includes its own salt).
function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10)
}

// True when the plain password matches the stored hash.
function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compareSync(plainPassword, passwordHash)
}

// Generates a random session token (crypto, not guessable).
function createSessionToken() {
  return crypto.randomBytes(24).toString('hex')
}

// A user object WITHOUT the password hash - safe to send to the client.
function toPublicUser(user) {
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email }
}

// Looks up a user by email (case-insensitive). Returns null when missing.
function findUserByEmail(db, email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null
  return (
    db
      .get('users')
      .find((user) => String(user.email).toLowerCase() === normalized)
      .value() || null
  )
}

function findUserById(db, id) {
  return db.get('users').find({ id }).value() || null
}

// Looks up a user by a session token. Returns null when the token is
// missing, unknown or expired - the caller treats that as "not logged in".
function findUserByToken(db, token) {
  if (!token) return null
  const session = db.get('sessions').find({ token }).value()
  if (!session) return null
  return findUserById(db, session.userId)
}

// Validates a signup payload. Returns an object of error messages;
// an empty object means the data is valid.
function validateSignup(data) {
  const { name, email, password } = data || {}
  const errors = {}

  if (!name || !String(name).trim()) {
    errors.name = 'Full name is required.'
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    errors.email = 'Email is required.'
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  } else if (String(password).length < 6) {
    errors.password = 'Password must contain at least 6 characters.'
  }

  return errors
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  toPublicUser,
  findUserByEmail,
  findUserById,
  findUserByToken,
  validateSignup,
}
