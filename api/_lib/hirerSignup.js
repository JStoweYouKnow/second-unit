/**
 * Create a hirer (employer) account without Supabase confirmation email SMTP.
 * Uses service-role admin.createUser with email_confirm: true.
 */

async function findProfileIdByEmail(db, email) {
  const { data } = await db
    .from('profiles')
    .select('id, email, role')
    .ilike('email', email)
    .maybeSingle()
  return data || null
}

export async function signupHirer(db, { email, password, fullName }) {
  if (!db) throw new Error('Database not configured')

  const trimmedEmail = String(email || '').trim().toLowerCase()
  const trimmedPassword = String(password || '')
  const name = String(fullName || '').trim()

  if (!trimmedEmail || !trimmedEmail.includes('@')) throw new Error('Valid email is required')
  if (trimmedPassword.length < 8) throw new Error('Password must be at least 8 characters')
  if (!name) throw new Error('Full name is required')

  if (!db.auth?.admin) {
    throw new Error('Server auth admin is not available — set SUPABASE_SERVICE_ROLE_KEY')
  }

  const existing = await findProfileIdByEmail(db, trimmedEmail)
  if (existing?.id) {
    throw new Error('An account with this email already exists. Sign in instead.')
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: trimmedEmail,
    password: trimmedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: 'employer',
    },
  })

  if (createErr) {
    if (/already|registered|exists/i.test(createErr.message || '')) {
      throw new Error('An account with this email already exists. Sign in instead.')
    }
    throw new Error(createErr.message || 'Could not create account')
  }

  const profileId = created?.user?.id
  if (!profileId) throw new Error('Could not create account')

  // Ensure profile row (trigger may lag or have failed previously)
  const { data: profileRow } = await db
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (!profileRow) {
    const { error: profileErr } = await db.from('profiles').upsert({
      id: profileId,
      email: trimmedEmail,
      full_name: name,
      role: 'employer',
      updated_at: new Date().toISOString(),
    })
    if (profileErr) throw new Error(profileErr.message || 'Could not create profile')
  } else {
    await db
      .from('profiles')
      .update({
        full_name: name,
        role: 'employer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
  }

  return {
    profileId,
    email: trimmedEmail,
    role: 'employer',
  }
}
