// ---------------------------------------------------------------------------
// emailService.js - Phase 8: email medication reminders.
//
// This file has NO React and NO Express code. It only knows how to turn a
// due dose into an email and hand that email to an SMTP server.
//
// Credentials are NEVER hard-coded - they come from environment variables
// (see .env.example at the project root):
//
//   EMAIL_HOST       SMTP server host (e.g. smtp.gmail.com)
//   EMAIL_PORT       SMTP port (587 default)
//   EMAIL_USER       SMTP username
//   EMAIL_PASSWORD   SMTP password / app password
//   EMAIL_FROM       "From" address shown in the email
//
// Local development / no credentials:
//   When EMAIL_HOST is not set, the email is NOT sent. Instead it is printed
//   to the server console clearly labelled as SIMULATED, so a developer can
//   verify the reminder logic without an SMTP account. This mode NEVER
//   claims that a real email was sent (sent: false, simulated: true).
//
// Every reminder is produced in two versions:
//   - HTML        a responsive, inline-CSS template (no external images or
//                 stylesheets) so it renders reliably in Gmail and webmail
//   - plain text  a fallback for email clients that do not support HTML
// Both use the real user / medication / schedule values - nothing is
// hard-coded, and the wording never makes a medical claim.
// ---------------------------------------------------------------------------

const nodemailer = require('nodemailer')

// Email server settings, read once at startup from the environment.
const EMAIL_HOST = process.env.EMAIL_HOST || ''
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587
const EMAIL_USER = process.env.EMAIL_USER || ''
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'MediSync <reminders@medisync.app>'

// Branding colors - the exact blue/white palette used by the React UI.
const BRAND_BLUE = '#1d6fb8'
const BRAND_SOFT = '#eaf2fa'
const PAGE_BG = '#f5f7fa'
const CARD_BG = '#ffffff'
const BORDER = '#e2e8f0'
const SUBTLE_BG = '#f8fafc'
const TEXT_DARK = '#1e293b'
const TEXT_BODY = '#475569'
const TEXT_MUTED = '#64748b'
const TEXT_FAINT = '#94a3b8'

// True when an SMTP server has been configured.
function isEmailConfigured() {
  return Boolean(EMAIL_HOST)
}

// Escapes user-provided text before it is inserted into the HTML email, so a
// medicine name or user name can never break the layout or inject markup.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// A readable dose label, e.g. "500 mg". Prefers the medication, falls back to
// the schedule entry.
function getDoseLabel(medication, scheduleEntry) {
  if (medication.dose) {
    return medication.dose + (medication.unit ? ' ' + medication.unit : '')
  }
  if (scheduleEntry.dose) {
    return scheduleEntry.dose + (scheduleEntry.unit ? ' ' + scheduleEntry.unit : '')
  }
  return 'as prescribed'
}

// The medicine name shown in the email - from the medication when available,
// otherwise from the schedule entry itself.
function getMedicineName(medication, scheduleEntry) {
  return medication.name || scheduleEntry.medicationName || 'Medication'
}

// Subject line: "💊 MediSync Medication Reminder — {medicine} at {time}".
// Both values are the real scheduled values - never hard-coded.
function buildReminderSubject(medication, scheduleEntry) {
  const name = getMedicineName(medication, scheduleEntry)
  const time = scheduleEntry.scheduledTime
    ? ' at ' + scheduleEntry.scheduledTime
    : ''
  return '💊 MediSync Medication Reminder — ' + name + time
}

// Plain-text version of the reminder (fallback for clients without HTML, and
// the body shown in simulated/dev console output). The wording is neutral and
// safe: it only reminds the user to follow their own schedule - it never says
// something like "this medicine is safe for you".
function buildReminderText(user, medication, scheduleEntry) {
  return (
    'Hello ' + user.name + ',\n\n' +
    "It's time for your scheduled medication.\n\n" +
    'Medicine: ' + getMedicineName(medication, scheduleEntry) + '\n' +
    'Dosage: ' + getDoseLabel(medication, scheduleEntry) + '\n' +
    'Scheduled Time: ' + scheduleEntry.scheduledTime + '\n\n' +
    'Please follow your prescribed medication schedule.\n\n' +
    '— MediSync\n' +
    'Smart Scheduling. Safer Timing.\n\n' +
    'This is an educational medication scheduling project. MediSync does not\n' +
    'provide medical advice. Please consult a qualified healthcare\n' +
    'professional for medication advice.'
  )
}

// HTML version of the reminder. Everything is inline CSS (no <style> blocks,
// no external images, no external stylesheets) so Gmail and webmail render it
// reliably. Dynamic values are escaped via escapeHtml.
function buildReminderHtml(user, medication, scheduleEntry) {
  const name = escapeHtml(getMedicineName(medication, scheduleEntry))
  const dose = escapeHtml(getDoseLabel(medication, scheduleEntry))
  const time = escapeHtml(scheduleEntry.scheduledTime || '')
  const userName = escapeHtml(user.name)

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<title>MediSync Medication Reminder</title>\n' +
    '</head>\n' +
    '<body style="margin:0; padding:0; background-color:' + PAGE_BG + ';">\n' +
    '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:' + PAGE_BG + '; padding:24px 12px;">\n' +
    '    <tr><td align="center">\n' +
    '      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="max-width:520px; width:100%;">\n' +
    // Border + radius live on the <td>, because Gmail ignores border-radius
    // on <table> elements but renders it correctly on cells
    '        <tr><td style="background-color:' + CARD_BG + '; border:1px solid ' + BORDER + '; ' +
    'border-radius:12px;">\n' +
    '          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">\n' +

    // --- Header: pill icon + MediSync branding -----------------------------
    '        <tr><td style="background-color:' + BRAND_BLUE + '; ' +
    'border-radius:11px 11px 0 0; padding:24px 28px; text-align:center;">\n' +
    '          <div style="font-size:30px; line-height:1;">💊</div>\n' +
    '          <div style="font-size:20px; font-weight:bold; color:#ffffff; ' +
    'margin-top:8px;">MediSync</div>\n' +
    '          <div style="font-size:12px; color:' + BRAND_SOFT + '; ' +
    'margin-top:2px;">Medication Dosage &amp; Interaction Scheduler</div>\n' +
    '        </td></tr>\n' +

    // --- Greeting -----------------------------------------------------------
    '        <tr><td style="padding:28px 28px 4px;">\n' +
    '          <div style="font-size:18px; font-weight:bold; color:' + TEXT_DARK + '; ' +
    'margin-bottom:6px;">Medication Reminder</div>\n' +
    '          <div style="font-size:14px; color:' + TEXT_BODY + '; line-height:1.6;">\n' +
    '            Hello <b>' + userName + '</b>,<br />\n' +
    "            It's time for your scheduled medication.\n" +
    '          </div>\n' +
    '        </td></tr>\n' +

    // --- Medication card ----------------------------------------------------
    '        <tr><td style="padding:16px 28px;">\n' +
    '          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:' + SUBTLE_BG + '; border:1px solid ' + BORDER + '; ' +
    'border-radius:8px;">\n' +
    '            <tr><td style="padding:14px 18px;">\n' +
    '              <div style="font-size:15px; font-weight:bold; color:' + TEXT_DARK + '; ' +
    'padding-bottom:6px;">' + name + '</div>\n' +
    '              <div style="font-size:13px; color:' + TEXT_BODY + '; ' +
    'padding-bottom:4px;"><b>Dosage:</b> ' + dose + '</div>\n' +
    '              <div style="font-size:13px; color:' + TEXT_BODY + ';">' +
    '<b>Scheduled Time:</b> ' + time + '</div>\n' +
    '            </td></tr>\n' +
    '          </table>\n' +
    '        </td></tr>\n' +

    // --- Reminder note -------------------------------------------------------
    '        <tr><td style="padding:4px 28px 0;">\n' +
    '          <div style="font-size:13px; color:' + TEXT_DARK + '; line-height:1.6;">\n' +
    '            Please follow your prescribed medication schedule.\n' +
    '          </div>\n' +
    '        </td></tr>\n' +

    // --- Branding footer -----------------------------------------------------
    '        <tr><td style="padding:22px 28px 4px; text-align:center;">\n' +
    '          <div style="font-size:13px; font-weight:bold; color:' + BRAND_BLUE + ';">' +
    'MediSync</div>\n' +
    '          <div style="font-size:12px; color:' + TEXT_MUTED + '; margin-top:2px;">' +
    'Smart Scheduling. Safer Timing.</div>\n' +
    '        </td></tr>\n' +

    // --- Educational disclaimer ----------------------------------------------
    '        <tr><td style="padding:12px 28px 24px;">\n' +
    '          <div style="font-size:11px; color:' + TEXT_FAINT + '; line-height:1.6; ' +
    'text-align:center; border-top:1px solid #f1f5f9; padding-top:14px;">\n' +
    '            This is an educational medication scheduling project. MediSync does not\n' +
    '            provide medical advice. Please consult a qualified healthcare\n' +
    '            professional for medication advice.\n' +
    '          </div>\n' +
    '        </td></tr>\n' +

    '          </table>\n' +
    '        </td></tr>\n' +
    '      </table>\n' +
    '    </td></tr>\n' +
    '  </table>\n' +
    '</body>\n' +
    '</html>\n'
  )
}

// Prints the exact email to the console (used when no SMTP server is
// configured). Clearly labelled as simulated - never a fake "email sent".
function logSimulatedEmail(user, subject, text) {
  console.log(
    '[MediSync][reminder] EMAIL NOT CONFIGURED - simulated reminder ' +
      '(no real email was sent)'
  )
  console.log('[MediSync][reminder] To: ' + user.email)
  console.log('[MediSync][reminder] Subject: ' + subject)
  console.log(
    '[MediSync][reminder] Body (plain text; an HTML version is also generated):\n' +
      text
  )
}

// Sends one medication reminder email (HTML + plain-text fallback). Always
// resolves - it NEVER throws, so a failing SMTP server can never crash the
// application. Returns:
//   { sent: true }                  a real email was handed to the SMTP server
//   { sent: false, simulated: true } no SMTP configured; printed to console
//   { sent: false, error }          the SMTP send failed (logged server-side)
async function sendMedicationReminder(user, medication, scheduleEntry) {
  const subject = buildReminderSubject(medication, scheduleEntry)
  const text = buildReminderText(user, medication, scheduleEntry)
  const html = buildReminderHtml(user, medication, scheduleEntry)

  if (!isEmailConfigured()) {
    logSimulatedEmail(user, subject, text)
    return { sent: false, simulated: true }
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    // Port 465 is implicit TLS; 587/25 use STARTTLS (nodemailer handles it)
    secure: EMAIL_PORT === 465,
    auth: EMAIL_USER ? { user: EMAIL_USER, pass: EMAIL_PASSWORD } : undefined,
  })

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: user.email,
      subject,
      text,
      html,
    })
    return { sent: true }
  } catch (error) {
    // Log the failure server-side, but never expose credentials or the error
    // to the frontend - and never let it break the request that triggered it.
    console.error('[MediSync][reminder] Email sending failed: ' + error.message)
    return { sent: false, error: error.message }
  }
}

module.exports = {
  sendMedicationReminder,
  buildReminderSubject,
  buildReminderText,
  buildReminderHtml,
  getDoseLabel,
  isEmailConfigured,
}
