// ---------------------------------------------------------------------------
// emailService.js - Phase 8: Brevo API medication reminders
//
// Sends MediSync medication reminders using Brevo's HTTPS API.
// No SMTP connection is required, which makes this suitable for Render.
//
// Required environment variables:
//   BREVO_API_KEY
//   EMAIL_FROM
//   EMAIL_FROM_NAME (optional)
//
// IMPORTANT:
//   - Never hard-code the Brevo API key.
//   - EMAIL_FROM must be a verified sender in Brevo.
// ---------------------------------------------------------------------------

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'medisync.reminder@gmail.com'

const EMAIL_FROM_NAME =
  process.env.EMAIL_FROM_NAME || 'MediSync'

// ---------------------------------------------------------------------------
// Branding colors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function isEmailConfigured() {
  return Boolean(BREVO_API_KEY && EMAIL_FROM)
}

// ---------------------------------------------------------------------------
// Escape HTML
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Dose helper
// ---------------------------------------------------------------------------

function getDoseLabel(medication, scheduleEntry) {
  if (medication.dose) {
    return (
      medication.dose +
      (medication.unit ? ' ' + medication.unit : '')
    )
  }

  if (scheduleEntry.dose) {
    return (
      scheduleEntry.dose +
      (scheduleEntry.unit ? ' ' + scheduleEntry.unit : '')
    )
  }

  return 'as prescribed'
}

// ---------------------------------------------------------------------------
// Medicine name helper
// ---------------------------------------------------------------------------

function getMedicineName(medication, scheduleEntry) {
  return (
    medication.name ||
    scheduleEntry.medicationName ||
    'Medication'
  )
}

// ---------------------------------------------------------------------------
// Email subject
// ---------------------------------------------------------------------------

function buildReminderSubject(medication, scheduleEntry) {
  const name = getMedicineName(medication, scheduleEntry)

  const time = scheduleEntry.scheduledTime
    ? ' at ' + scheduleEntry.scheduledTime
    : ''

  return '💊 MediSync Medication Reminder — ' + name + time
}

// ---------------------------------------------------------------------------
// Plain-text email
// ---------------------------------------------------------------------------

function buildReminderText(user, medication, scheduleEntry) {
  return (
    'Hello ' +
    user.name +
    ',\n\n' +
    "It's time for your scheduled medication.\n\n" +
    'Medicine: ' +
    getMedicineName(medication, scheduleEntry) +
    '\n' +
    'Dosage: ' +
    getDoseLabel(medication, scheduleEntry) +
    '\n' +
    'Scheduled Time: ' +
    scheduleEntry.scheduledTime +
    '\n\n' +
    'Please follow your prescribed medication schedule.\n\n' +
    '— MediSync\n' +
    'Smart Scheduling. Safer Timing.\n\n' +
    'This is an educational medication scheduling project. MediSync does not\n' +
    'provide medical advice. Please consult a qualified healthcare\n' +
    'professional for medication advice.'
  )
}

// ---------------------------------------------------------------------------
// HTML email
// ---------------------------------------------------------------------------

function buildReminderHtml(user, medication, scheduleEntry) {
  const name = escapeHtml(
    getMedicineName(medication, scheduleEntry)
  )

  const dose = escapeHtml(
    getDoseLabel(medication, scheduleEntry)
  )

  const time = escapeHtml(
    scheduleEntry.scheduledTime || ''
  )

  const userName = escapeHtml(user.name)

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<title>MediSync Medication Reminder</title>\n' +
    '</head>\n' +

    '<body style="margin:0; padding:0; background-color:' +
    PAGE_BG +
    ';">\n' +

    '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:' +
    PAGE_BG +
    '; padding:24px 12px;">\n' +

    '    <tr><td align="center">\n' +

    '      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="max-width:520px; width:100%;">\n' +

    '        <tr><td style="background-color:' +
    CARD_BG +
    '; border:1px solid ' +
    BORDER +
    '; border-radius:12px;">\n' +

    '          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">\n' +

    // Header
    '        <tr><td style="background-color:' +
    BRAND_BLUE +
    '; border-radius:11px 11px 0 0; padding:24px 28px; text-align:center;">\n' +

    '          <div style="font-size:30px; line-height:1;">💊</div>\n' +

    '          <div style="font-size:20px; font-weight:bold; color:#ffffff; margin-top:8px;">' +
    'MediSync</div>\n' +

    '          <div style="font-size:12px; color:' +
    BRAND_SOFT +
    '; margin-top:2px;">' +
    'Medication Dosage &amp; Interaction Scheduler</div>\n' +

    '        </td></tr>\n' +

    // Greeting
    '        <tr><td style="padding:28px 28px 4px;">\n' +

    '          <div style="font-size:18px; font-weight:bold; color:' +
    TEXT_DARK +
    '; margin-bottom:6px;">' +
    'Medication Reminder</div>\n' +

    '          <div style="font-size:14px; color:' +
    TEXT_BODY +
    '; line-height:1.6;">\n' +

    '            Hello <b>' +
    userName +
    '</b>,<br />\n' +

    "            It's time for your scheduled medication.\n" +

    '          </div>\n' +

    '        </td></tr>\n' +

    // Medication card
    '        <tr><td style="padding:16px 28px;">\n' +

    '          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:' +
    SUBTLE_BG +
    '; border:1px solid ' +
    BORDER +
    '; border-radius:8px;">\n' +

    '            <tr><td style="padding:14px 18px;">\n' +

    '              <div style="font-size:15px; font-weight:bold; color:' +
    TEXT_DARK +
    '; padding-bottom:6px;">' +
    name +
    '</div>\n' +

    '              <div style="font-size:13px; color:' +
    TEXT_BODY +
    '; padding-bottom:4px;"><b>Dosage:</b> ' +
    dose +
    '</div>\n' +

    '              <div style="font-size:13px; color:' +
    TEXT_BODY +
    ';">' +
    '<b>Scheduled Time:</b> ' +
    time +
    '</div>\n' +

    '            </td></tr>\n' +

    '          </table>\n' +

    '        </td></tr>\n' +

    // Reminder
    '        <tr><td style="padding:4px 28px 0;">\n' +

    '          <div style="font-size:13px; color:' +
    TEXT_DARK +
    '; line-height:1.6;">\n' +

    '            Please follow your prescribed medication schedule.\n' +

    '          </div>\n' +

    '        </td></tr>\n' +

    // Footer
    '        <tr><td style="padding:22px 28px 4px; text-align:center;">\n' +

    '          <div style="font-size:13px; font-weight:bold; color:' +
    BRAND_BLUE +
    ';">MediSync</div>\n' +

    '          <div style="font-size:12px; color:' +
    TEXT_MUTED +
    '; margin-top:2px;">' +
    'Smart Scheduling. Safer Timing.</div>\n' +

    '        </td></tr>\n' +

    // Disclaimer
    '        <tr><td style="padding:12px 28px 24px;">\n' +

    '          <div style="font-size:11px; color:' +
    TEXT_FAINT +
    '; line-height:1.6; text-align:center; border-top:1px solid #f1f5f9; padding-top:14px;">\n' +

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

// ---------------------------------------------------------------------------
// Simulated email
// ---------------------------------------------------------------------------

function logSimulatedEmail(user, subject, text) {
  console.log(
    '[MediSync][reminder] EMAIL NOT CONFIGURED - simulated reminder ' +
      '(no real email was sent)'
  )

  console.log(
    '[MediSync][reminder] To: ' + user.email
  )

  console.log(
    '[MediSync][reminder] Subject: ' + subject
  )

  console.log(
    '[MediSync][reminder] Body (plain text; an HTML version is also generated):\n' +
      text
  )
}

// ---------------------------------------------------------------------------
// Send email through Brevo HTTPS API
// ---------------------------------------------------------------------------

async function sendViaBrevoApi({
  user,
  subject,
  text,
  html
}) {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',

    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY
    },

    body: JSON.stringify({
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM
      },

      to: [
        {
          email: user.email,
          name: user.name
        }
      ],

      subject,

      htmlContent: html,

      textContent: text,

      tags: ['medisync', 'medication-reminder']
    })
  })

  const responseText = await response.text()

  let responseData = null

  try {
    responseData = responseText
      ? JSON.parse(responseText)
      : null
  } catch {
    responseData = null
  }

  if (!response.ok) {
    const detail =
      responseData?.message ||
      responseData?.code ||
      responseText ||
      `HTTP ${response.status}`

    throw new Error(
      `Brevo API ${response.status}: ${detail}`
    )
  }

  return responseData
}

// ---------------------------------------------------------------------------
// Send medication reminder
// ---------------------------------------------------------------------------

async function sendMedicationReminder(
  user,
  medication,
  scheduleEntry
) {
  const subject = buildReminderSubject(
    medication,
    scheduleEntry
  )

  const text = buildReminderText(
    user,
    medication,
    scheduleEntry
  )

  const html = buildReminderHtml(
    user,
    medication,
    scheduleEntry
  )

  // No Brevo API configuration
  if (!isEmailConfigured()) {
    logSimulatedEmail(
      user,
      subject,
      text
    )

    return {
      sent: false,
      simulated: true
    }
  }

  try {
    const result = await sendViaBrevoApi({
      user,
      subject,
      text,
      html
    })

    console.log(
      '[MediSync][reminder] Email sent successfully to ' +
        user.email +
        ' via Brevo API' +
        (result?.messageId
          ? ' | messageId: ' + result.messageId
          : '')
    )

    return {
      sent: true,
      messageId: result?.messageId
    }
  } catch (error) {
    console.error(
      '[MediSync][reminder] Email sending failed: ' +
        error.message
    )

    return {
      sent: false,
      error: error.message
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendMedicationReminder,
  buildReminderSubject,
  buildReminderText,
  buildReminderHtml,
  getDoseLabel,
  isEmailConfigured
}