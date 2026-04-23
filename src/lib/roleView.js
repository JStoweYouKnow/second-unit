import { artists } from '../data/mockData'

export function isArtistProfile(profile) {
  return profile?.role === 'artist'
}

/**
 * Maps a signed-in artist profile to a roster row for mock bookings/contracts/payments.
 * Falls back to the first demo artist when names do not match.
 */
export function demoArtistPersona(profile) {
  if (!isArtistProfile(profile)) return null
  const byName = artists.find((a) => a.name === profile.full_name)
  return byName ?? artists[0]
}
