import { FRONTEND_URL } from './stripe.js'
import { prefAllowsEmail } from './notifications.js'

const FROM = process.env.EMAIL_FROM || 'The Callsheet <notifications@thecallsheet.ai>'

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  category = 'system',
  prefs = null,
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !to) return { skipped: true, reason: !apiKey ? 'no_api_key' : 'no_recipient' }

  if (prefs && !prefAllowsEmail(prefs, category)) {
    return { skipped: true, reason: 'prefs_disabled' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
      return { error: err }
    }

    return { sent: true }
  } catch (err) {
    console.error('[email] send failed:', err.message)
    return { error: err.message }
  }
}

export function emailLayout({ title, body, ctaLabel, ctaUrl }) {
  const url = ctaUrl || FRONTEND_URL
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; background: #0a0a0a; color: #f0ede8; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: #111; border: 1px solid rgba(201,168,76,0.25); border-radius: 12px; padding: 28px;">
    <div style="font-size: 11px; letter-spacing: 3px; color: #c9a84c; text-transform: uppercase; margin-bottom: 12px;">The Callsheet</div>
    <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
    <p style="line-height: 1.6; color: #ccc; margin: 0 0 24px;">${body}</p>
    ${
      ctaLabel
        ? `<a href="${url}" style="display: inline-block; background: #c9a84c; color: #0a0a0a; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">${ctaLabel}</a>`
        : ''
    }
  </div>
</body>
</html>`
}

export async function emailProfile(db, profileId) {
  if (!db || !profileId) return null
  const { data } = await db
    .from('profiles')
    .select('email, full_name, notification_prefs')
    .eq('id', profileId)
    .maybeSingle()
  return data
}
