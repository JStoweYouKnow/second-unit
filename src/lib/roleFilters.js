/** Max length for a single role filter chip label. */
const MAX_ROLE_TAG_LEN = 48

/** Above this length, comma-separated titles are treated as a headline — only the first segment filters. */
const LONG_ROLE_LEN = 64

/**
 * Turn a stored role_title into discrete filter tags (short titles only).
 * Long comma-separated headlines collapse to the first segment; oversized segments are dropped.
 */
export function roleFilterTags(role) {
  if (!role || typeof role !== 'string') return []
  const trimmed = role.trim()
  if (!trimmed) return []

  if (trimmed.length > LONG_ROLE_LEN && trimmed.includes(',')) {
    const first = trimmed.split(',')[0].trim()
    return first && first.length <= MAX_ROLE_TAG_LEN ? [first] : []
  }

  const parts = trimmed.includes(',')
    ? trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    : [trimmed]

  return parts.filter((p) => p.length <= MAX_ROLE_TAG_LEN)
}

export function collectRoleFilterOptions(artists) {
  const set = new Set()
  for (const artist of artists) {
    for (const tag of roleFilterTags(artist.role)) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function artistMatchesRoleFilter(artistRole, selectedRoles) {
  if (!selectedRoles?.size) return true
  const tags = roleFilterTags(artistRole)
  if (tags.length === 0) return selectedRoles.has(artistRole?.trim())
  return tags.some((tag) => selectedRoles.has(tag))
}

/** One-line label for artist pickers — display name only (role titles are often long headlines). */
export function artistSelectLabel(artist) {
  return artist?.name?.trim() || 'Artist'
}
