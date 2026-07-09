import { getArtistIdForProfile } from './bookings.js'

/**
 * Ensure the signed-in admin has an artists row so View as Artist can exercise
 * Connect, bookings, and payouts without a separate artist login.
 */
export async function ensureAdminArtistPersona(db, profile) {
  if (!db || !profile?.id) {
    const err = new Error('Profile required')
    err.status = 400
    throw err
  }
  if (profile.role !== 'admin') {
    const err = new Error('Only admin accounts can provision a test artist persona')
    err.status = 403
    throw err
  }

  const existingId = await getArtistIdForProfile(db, profile.id)
  if (existingId) {
    const { data, error } = await db
      .from('artists')
      .select('*')
      .eq('id', existingId)
      .maybeSingle()
    if (error) throw error
    return { artist: data, created: false }
  }

  const displayName = profile.full_name?.trim() || profile.email || 'Admin Test Artist'
  const row = {
    profile_id: profile.id,
    display_name: `${displayName} (Test Artist)`,
    role_title: 'Admin Test Artist',
    bio: 'Auto-provisioned artist persona for testing bookings, Stripe Connect, and payouts from the admin account.',
    hourly_rate: 150,
    day_rate: 1200,
    project_flat_rate: 5000,
    location: 'Remote',
    available: true,
    rating: 5.0,
    total_projects: 0,
  }

  let { data, error } = await db.from('artists').insert(row).select('*').single()

  // Older DBs may lack day_rate / project_flat_rate.
  if (error && /day_rate|project_flat_rate|column .* does not exist|Could not find the .* column/i.test(error.message || '')) {
    const { day_rate: _d, project_flat_rate: _p, ...legacy } = row
    ;({ data, error } = await db.from('artists').insert(legacy).select('*').single())
  }

  if (error) {
    // Race: another request created the row.
    if (/duplicate|unique/i.test(error.message || '')) {
      const artistId = await getArtistIdForProfile(db, profile.id)
      const { data: again } = await db.from('artists').select('*').eq('id', artistId).maybeSingle()
      if (again) return { artist: again, created: false }
    }
    const err = new Error(error.message)
    err.status = 500
    throw err
  }

  return { artist: data, created: true }
}

export function mapArtistPersonaToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    roleTitle: row.role_title,
    bio: row.bio,
    location: row.location,
    hourlyRate: row.hourly_rate,
    dailyRate: row.day_rate ?? undefined,
    projectFlatRate: row.project_flat_rate ?? undefined,
    stripeAccountId: row.stripe_account_id ?? null,
    available: row.available,
    rating: row.rating,
    totalProjects: row.total_projects,
  }
}
