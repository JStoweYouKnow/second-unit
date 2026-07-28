/** Shared confidentiality helpers for briefs, messages, and project references. */

export const BRIEF_VISIBILITY = {
  PUBLIC: 'public',
  NDA_GATED: 'nda_gated',
  INVITE_ONLY: 'invite_only',
}

export const REDACTED_BRIEF_DESCRIPTION =
  'Full brief details are confidential. Review and accept the NDA to view the complete description.'

export function contractFullySigned(row) {
  return Boolean(row?.signed_by_employer && row?.signed_by_artist)
}

export async function hasSignedContractBetween(db, employerId, artistId) {
  if (!db || !employerId || !artistId) return false
  const { data, error } = await db
    .from('contracts')
    .select('id')
    .eq('employer_id', employerId)
    .eq('artist_id', artistId)
    .eq('signed_by_employer', true)
    .eq('signed_by_artist', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

export async function getBriefNdaAcceptance(db, briefId, artistProfileId) {
  const { data: artist } = await db
    .from('artists')
    .select('id')
    .eq('profile_id', artistProfileId)
    .maybeSingle()
  if (!artist?.id) return null

  const { data, error } = await db
    .from('brief_nda_acceptances')
    .select('accepted_at')
    .eq('brief_id', briefId)
    .eq('artist_id', artist.id)
    .maybeSingle()
  if (error) throw error
  return data?.accepted_at ?? null
}

export async function recordBriefNdaAcceptance(db, briefId, artistProfileId) {
  const { data: artist } = await db
    .from('artists')
    .select('id')
    .eq('profile_id', artistProfileId)
    .maybeSingle()
  if (!artist?.id) return { error: 'not_artist' }

  const now = new Date().toISOString()
  const { data, error } = await db
    .from('brief_nda_acceptances')
    .upsert(
      { brief_id: briefId, artist_id: artist.id, accepted_at: now },
      { onConflict: 'brief_id,artist_id' },
    )
    .select('accepted_at')
    .single()
  if (error) throw error
  return { acceptedAt: data.accepted_at }
}

export function canViewFullBrief({ brief, viewerProfileId, isAdmin, ndaAcceptedAt, hasApplication: _hasApplication }) {
  if (!brief) return false
  if (isAdmin) return true
  if (brief.employer_id === viewerProfileId) return true
  if (brief.visibility === BRIEF_VISIBILITY.PUBLIC) return true
  if (brief.visibility === BRIEF_VISIBILITY.INVITE_ONLY) return true
  if (brief.visibility === BRIEF_VISIBILITY.NDA_GATED) {
    if (brief.nda_storage_path) return Boolean(ndaAcceptedAt)
    return true
  }
  return true
}

export function redactBriefForViewer(brief, { canViewFull, ndaAcceptedAt }) {
  if (!brief || canViewFull) {
    return {
      ...brief,
      descriptionRedacted: false,
      ndaAcceptedAt: ndaAcceptedAt ?? null,
      canDownloadNda: Boolean(brief?.nda_storage_path),
    }
  }
  return {
    ...brief,
    description: REDACTED_BRIEF_DESCRIPTION,
    descriptionRedacted: true,
    ndaAcceptedAt: ndaAcceptedAt ?? null,
    canDownloadNda: Boolean(brief?.nda_storage_path),
  }
}
