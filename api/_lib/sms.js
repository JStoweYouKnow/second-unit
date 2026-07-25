import { prefAllowsSms } from './notifications.js'

const TWILIO_API = 'https://api.twilio.com/2010-04-01'

export function normalizePhone(raw) {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits.length >= 10 ? `+${digits}` : null
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function formatSmsBody({ title, body, link }) {
  const parts = [title]
  if (body) parts.push(body)
  if (link) parts.push(link)
  let text = parts.join('\n')
  if (text.length > 300) text = `${text.slice(0, 297)}…`
  return text
}

export function smsDispatch(profile, { title, body, link, category }) {
  if (!profile?.phone) return null
  return {
    to: profile.phone,
    body: formatSmsBody({ title, body, link }),
    category,
    prefs: profile.notification_prefs,
  }
}

export async function sendTransactionalSms({
  to,
  body,
  category = 'system',
  prefs = null,
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    return { skipped: true, reason: 'no_twilio_config' }
  }
  if (!to) return { skipped: true, reason: 'no_recipient' }

  if (prefs && !prefAllowsSms(prefs, category)) {
    return { skipped: true, reason: 'prefs_disabled' }
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const res = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[sms] Twilio error:', err)
      return { error: err }
    }

    return { sent: true }
  } catch (err) {
    console.error('[sms] send failed:', err.message)
    return { error: err.message }
  }
}
