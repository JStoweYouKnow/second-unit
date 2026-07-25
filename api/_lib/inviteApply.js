import { validateInviteToken } from './validateInvite.js'

function parseCommaList(value) {
  if (Array.isArray(value)) {
    return value.map((s) => String(s || '').trim()).filter(Boolean)
  }
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Normalize form videoLinks (objects, URL strings, or comma string) for DB. */
function videoReelsFromForm(value) {
  let items = []
  if (Array.isArray(value)) items = value
  else if (typeof value === 'string') items = parseCommaList(value)

  const reels = items
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim()
        return url ? { url, title: '' } : null
      }
      if (item && typeof item === 'object') {
        const url = String(item.url || '').trim()
        if (!url) return null
        return { url, title: String(item.title || '').trim() }
      }
      return null
    })
    .filter(Boolean)

  return {
    video_reels: reels,
    video_links: reels.map((r) => r.url),
  }
}

function formToPayload(form, profileId, email) {
  // Match artist_applications columns (hourly_rate only — day/project rates live on artists).
  const videoPayload = videoReelsFromForm(form.videoLinks)
  return {
    profile_id: profileId,
    email,
    full_name: String(form.fullName || '').trim(),
    role_title: String(form.roleTitle || '').trim() || 'Artist',
    bio: String(form.bio || '').trim() || null,
    location: String(form.location || '').trim() || null,
    hourly_rate: form.hourlyRate ? parseInt(form.hourlyRate, 10) || 0 : 0,
    skills: parseCommaList(form.skills),
    brands: parseCommaList(form.brands),
    website: String(form.website || '').trim() || null,
    twitter: String(form.twitter || '').trim() || null,
    instagram: String(form.instagram || '').trim() || null,
    linkedin: String(form.linkedin || '').trim() || null,
    video_links: videoPayload.video_links,
    video_reels: videoPayload.video_reels,
    status: 'pending',
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }
}

async function findProfileIdByEmail(db, email) {
  const { data } = await db
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle()
  return data?.id || null
}

/**
 * Private-invite apply: create/confirm the account without relying on Supabase
 * confirmation email (SMTP often fails), insert the application, consume invite.
 */
export async function applyWithArtistInvite(db, {
  inviteToken,
  email,
  password,
  form,
}) {
  if (!db) throw new Error('Database not configured')

  const trimmedEmail = String(email || '').trim().toLowerCase()
  const trimmedPassword = String(password || '')
  const token = String(inviteToken || '').trim()

  if (!token) throw new Error('Invite token is required')
  if (!trimmedEmail || !trimmedEmail.includes('@')) throw new Error('Valid email is required')
  if (trimmedPassword.length < 8) throw new Error('Password must be at least 8 characters')
  if (!String(form?.fullName || '').trim()) throw new Error('Full name is required')

  const invite = await validateInviteToken(db, token)
  if (!invite?.valid) {
    const reason = invite?.reason || 'invalid'
    if (reason === 'used') throw new Error('This invite link has already been used')
    if (reason === 'expired') throw new Error('This invite link has expired')
    throw new Error(invite?.errorMessage || 'Invalid invite link')
  }

  if (invite.email && String(invite.email).toLowerCase() !== trimmedEmail) {
    throw new Error('This invite is reserved for a different email address')
  }

  if (!db.auth?.admin) {
    throw new Error('Server auth admin is not available — set SUPABASE_SERVICE_ROLE_KEY')
  }

  let profileId = await findProfileIdByEmail(db, trimmedEmail)
  let createdUser = false

  if (profileId) {
    const { error: updateErr } = await db.auth.admin.updateUserById(profileId, {
      password: trimmedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: String(form.fullName).trim(),
        role: 'employer',
      },
    })
    if (updateErr) {
      console.warn('[inviteApply] updateUserById:', updateErr.message)
    }
  } else {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: trimmedEmail,
      password: trimmedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: String(form.fullName).trim(),
        role: 'employer',
      },
    })

    if (createErr) {
      // Race / already exists in auth but profile missing
      if (/already|registered|exists/i.test(createErr.message || '')) {
        profileId = await findProfileIdByEmail(db, trimmedEmail)
        if (!profileId) {
          throw new Error(
            'An account with this email already exists. Sign in, then reopen your invite link to finish applying.'
          )
        }
        await db.auth.admin.updateUserById(profileId, {
          password: trimmedPassword,
          email_confirm: true,
        })
      } else {
        throw new Error(createErr.message || 'Could not create account')
      }
    } else {
      profileId = created.user.id
      createdUser = true
    }
  }

  // Ensure profile row exists (trigger may lag or have failed previously)
  const { data: profileRow } = await db
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (!profileRow) {
    const { error: profileErr } = await db.from('profiles').upsert({
      id: profileId,
      email: trimmedEmail,
      full_name: String(form.fullName).trim(),
      role: 'employer',
      updated_at: new Date().toISOString(),
    })
    if (profileErr) throw new Error(profileErr.message || 'Could not create profile')
  }

  const { data: existingApp } = await db
    .from('artist_applications')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  const payload = formToPayload(form, profileId, trimmedEmail)
  let application

  if (existingApp) {
    if (existingApp.status === 'approved') {
      throw new Error('This account already has an approved artist application')
    }
    const { data, error } = await db
      .from('artist_applications')
      .update(payload)
      .eq('id', existingApp.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    application = data
  } else {
    const { data, error } = await db
      .from('artist_applications')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    application = data
  }

  const { error: consumeError } = await db.rpc('consume_artist_invite', {
    p_token: token,
    p_profile_id: profileId,
    p_application_id: application.id,
    p_email: trimmedEmail,
  })

  if (consumeError) {
    // Application is saved — surface invite consume failure but don't lose the app
    console.error('[inviteApply] consume_artist_invite:', consumeError.message)
  }

  return {
    applicationId: application.id,
    profileId,
    email: trimmedEmail,
    createdUser,
    inviteConsumed: !consumeError,
    status: application.status,
  }
}
