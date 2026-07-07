/** Map DB booking row → client shape used by Bookings.jsx */
export function mapBookingToClient(row) {
  if (!row) return null
  const time =
    typeof row.start_time === 'string'
      ? row.start_time.slice(0, 5)
      : row.start_time ?? '09:00'

  return {
    id: row.id,
    artistId: row.artist_id,
    artistName: row.artist_name ?? '',
    employerId: row.employer_id,
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
    time,
    duration: Number(row.duration_hours) || 1,
    durationUnit: row.duration_unit || 'hours',
    type: row.booking_type,
    agreedTotal: row.agreed_total ?? row.rate ?? 0,
    status: row.status,
    notes: row.notes ?? '',
    contractId: row.contract_id ?? row.contract?.id ?? null,
    contract: row.contract
      ? {
          id: row.contract.id,
          title: row.contract.title,
          status: row.contract.status,
          signedByEmployer: !!row.contract.signed_by_employer,
          signedByArtist: !!row.contract.signed_by_artist,
        }
      : null,
    createdAt: row.created_at,
  }
}

/** Map validated API payload → DB insert/update row */
export function mapBookingToDb(validated, employerId) {
  const durationHours =
    validated.durationUnit === 'project' ? 1 : Number(validated.duration) || 1
  const agreedTotal = Math.round(Number(validated.agreedTotal))

  return {
    employer_id: employerId,
    artist_id: validated.artistId,
    artist_name: validated.artistName,
    date: validated.date,
    start_time: validated.time || '09:00',
    duration_hours: durationHours,
    duration_unit: validated.durationUnit || 'hours',
    booking_type: validated.type,
    rate: Math.max(Math.round(agreedTotal / Math.max(durationHours, 1)), 1),
    agreed_total: agreedTotal,
    status: 'pending',
    notes: validated.notes || null,
  }
}

export async function getArtistIdForProfile(db, profileId) {
  if (!db || !profileId) return null
  const { data } = await db
    .from('artists')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data?.id ?? null
}

export async function listBookingsForUser(db, userId) {
  const artistId = await getArtistIdForProfile(db, userId)

  let query = db
    .from('bookings')
    .select(`
      *,
      contract:contracts!contract_id(
        id,
        title,
        status,
        signed_by_employer,
        signed_by_artist
      )
    `)
    .order('created_at', { ascending: false })

  if (artistId) {
    query = query.or(`employer_id.eq.${userId},artist_id.eq.${artistId}`)
  } else {
    query = query.eq('employer_id', userId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapBookingToClient)
}

export async function userCanAccessBooking(db, userId, bookingRow) {
  if (!bookingRow) return false
  if (bookingRow.employer_id === userId) return true
  const artistId = await getArtistIdForProfile(db, userId)
  return artistId != null && bookingRow.artist_id === artistId
}
