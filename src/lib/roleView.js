export function isArtistProfile(profile) {
  return profile?.role === 'artist'
}

export function hasArtistRecord(artist) {
  return !!artist?.id
}

/**
 * Maps a signed-in artist profile to a roster row for bookings/contracts/payments.
 */
export function demoArtistPersona(profile, artistRecord = null) {
  if (!isArtistProfile(profile)) return null

  const name = artistRecord?.displayName || profile.full_name || 'Artist'
  const avatar = name.split(' ').map((n) => n[0]).join('').slice(0, 2)

  if (artistRecord?.id) {
    return {
      id: artistRecord.id,
      name,
      role: artistRecord.roleTitle || 'AI Visual Artist',
      avatar,
      rating: artistRecord.rating != null ? parseFloat(artistRecord.rating) : undefined,
    }
  }

  return {
    id: profile.id,
    name,
    role: 'AI Visual Artist',
    avatar,
  }
}
