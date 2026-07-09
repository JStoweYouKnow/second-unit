export function isArtistProfile(profile) {
  return profile?.role === 'artist'
}

export function hasArtistRecord(artist) {
  return !!artist?.id
}

/**
 * Maps a signed-in artist profile to a roster row for bookings/contracts/payments.
 * Always uses `artists.id` (never `profiles.id`) — bookings/contracts store artist_id.
 * Returns null until the artist row is loaded so callers don't filter against the wrong id.
 */
export function demoArtistPersona(profile, artistRecord = null) {
  if (!isArtistProfile(profile)) return null
  if (!artistRecord?.id) return null

  const name = artistRecord.displayName || profile.full_name || 'Artist'
  const avatar = name.split(' ').map((n) => n[0]).join('').slice(0, 2)

  return {
    id: artistRecord.id,
    name,
    role: artistRecord.roleTitle || 'AI Visual Artist',
    avatar,
    rating: artistRecord.rating != null ? parseFloat(artistRecord.rating) : undefined,
  }
}
