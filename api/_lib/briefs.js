import { getArtistIdForProfile } from './bookings.js'

export function mapBriefToClient(row, extra = {}) {
  if (!row) return null
  return {
    id: row.id,
    employerId: row.employer_id,
    employerName: row.employer?.full_name ?? extra.employerName ?? 'Client',
    title: row.title,
    description: row.description ?? '',
    budgetMin: row.budget_min ?? null,
    budgetMax: row.budget_max ?? null,
    timeline: row.timeline ?? '',
    location: row.location ?? 'Remote',
    skills: Array.isArray(row.skills) ? row.skills : [],
    status: row.status,
    createdAt: row.created_at,
    applicationCount: extra.applicationCount ?? undefined,
    applied: extra.applied ?? undefined,
  }
}

export function mapApplicationToClient(row) {
  if (!row) return null
  const artist = row.artist
  return {
    id: row.id,
    briefId: row.brief_id,
    artistId: row.artist_id,
    artistName: artist?.display_name ?? 'Artist',
    artistRole: artist?.role_title ?? '',
    artistProfileId: artist?.profile_id ?? null,
    message: row.message ?? '',
    proposedRate: row.proposed_rate ?? null,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function mapBriefToDb(payload, employerId) {
  const num = (v) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return {
    employer_id: employerId,
    title: String(payload.title || '').slice(0, 200),
    description: String(payload.description || '').slice(0, 4000),
    budget_min: payload.budgetMin != null ? num(payload.budgetMin) : null,
    budget_max: payload.budgetMax != null ? num(payload.budgetMax) : null,
    timeline: payload.timeline ? String(payload.timeline).slice(0, 200) : null,
    location: payload.location ? String(payload.location).slice(0, 120) : 'Remote',
    skills: Array.isArray(payload.skills)
      ? payload.skills.map((s) => String(s).slice(0, 60)).slice(0, 20)
      : [],
  }
}

/** Open briefs for the marketplace, flagged with whether the viewing artist applied. */
export async function listOpenBriefs(db, viewerProfileId) {
  const { data: briefs, error } = await db
    .from('open_briefs')
    .select('*, employer:profiles!employer_id(full_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!briefs?.length) return []

  const artistId = await getArtistIdForProfile(db, viewerProfileId)
  let appliedSet = new Set()
  if (artistId) {
    const { data: apps } = await db
      .from('brief_applications')
      .select('brief_id')
      .eq('artist_id', artistId)
      .in('brief_id', briefs.map((b) => b.id))
    appliedSet = new Set((apps || []).map((a) => a.brief_id))
  }

  return briefs.map((b) =>
    mapBriefToClient(b, { applied: appliedSet.has(b.id) })
  )
}

/** A hirer's own briefs with applicant counts. */
export async function listMyBriefs(db, employerId) {
  const { data: briefs, error } = await db
    .from('open_briefs')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!briefs?.length) return []

  const { data: apps } = await db
    .from('brief_applications')
    .select('brief_id')
    .in('brief_id', briefs.map((b) => b.id))

  const counts = new Map()
  for (const a of apps || []) counts.set(a.brief_id, (counts.get(a.brief_id) || 0) + 1)

  return briefs.map((b) =>
    mapBriefToClient(b, { applicationCount: counts.get(b.id) || 0 })
  )
}

export async function createBrief(db, employerId, payload) {
  const row = mapBriefToDb(payload, employerId)
  if (!row.title) throw new Error('Title is required')
  const { data, error } = await db.from('open_briefs').insert(row).select('*').single()
  if (error) throw error
  return mapBriefToClient(data)
}

export async function getBriefRow(db, id) {
  const { data, error } = await db
    .from('open_briefs')
    .select('*, employer:profiles!employer_id(full_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateBrief(db, id, employerId, patch) {
  const { data: brief } = await db.from('open_briefs').select('employer_id').eq('id', id).maybeSingle()
  if (!brief) return { error: 'not_found' }
  if (brief.employer_id !== employerId) return { error: 'forbidden' }

  const update = { updated_at: new Date().toISOString() }
  if (patch.status && ['open', 'closed', 'filled'].includes(patch.status)) update.status = patch.status
  if (patch.title != null) update.title = String(patch.title).slice(0, 200)
  if (patch.description != null) update.description = String(patch.description).slice(0, 4000)
  if (patch.timeline !== undefined) update.timeline = patch.timeline ? String(patch.timeline).slice(0, 200) : null

  const { data, error } = await db.from('open_briefs').update(update).eq('id', id).select('*').single()
  if (error) throw error
  return { brief: mapBriefToClient(data) }
}

export async function applyToBrief(db, briefId, artistProfileId, payload) {
  const artistId = await getArtistIdForProfile(db, artistProfileId)
  if (!artistId) return { error: 'not_artist' }

  const brief = await getBriefRow(db, briefId)
  if (!brief) return { error: 'not_found' }
  if (brief.status !== 'open') return { error: 'closed' }

  const row = {
    brief_id: briefId,
    artist_id: artistId,
    message: String(payload.message || '').slice(0, 2000),
    proposed_rate:
      payload.proposedRate != null && Number.isFinite(Number(payload.proposedRate))
        ? Math.round(Number(payload.proposedRate))
        : null,
  }

  const { data, error } = await db
    .from('brief_applications')
    .upsert(row, { onConflict: 'brief_id,artist_id' })
    .select('*, artist:artists(id, display_name, role_title, profile_id)')
    .single()
  if (error) throw error
  return { application: mapApplicationToClient(data), brief, artistId }
}

export async function listApplicationsForBrief(db, briefId, employerId) {
  const brief = await getBriefRow(db, briefId)
  if (!brief) return { error: 'not_found' }
  if (brief.employer_id !== employerId) return { error: 'forbidden' }

  const { data, error } = await db
    .from('brief_applications')
    .select('*, artist:artists(id, display_name, role_title, profile_id)')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return { applications: (data || []).map(mapApplicationToClient), brief: mapBriefToClient(brief) }
}

export async function updateApplicationStatus(db, briefId, appId, employerId, status) {
  if (!['pending', 'shortlisted', 'accepted', 'declined'].includes(status)) {
    return { error: 'bad_status' }
  }
  const brief = await getBriefRow(db, briefId)
  if (!brief) return { error: 'not_found' }
  if (brief.employer_id !== employerId) return { error: 'forbidden' }

  const { data, error } = await db
    .from('brief_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appId)
    .eq('brief_id', briefId)
    .select('*, artist:artists(id, display_name, role_title, profile_id)')
    .single()
  if (error) throw error

  // Accepting an applicant fills the brief.
  if (status === 'accepted') {
    await db.from('open_briefs').update({ status: 'filled', updated_at: new Date().toISOString() }).eq('id', briefId)
  }

  return { application: mapApplicationToClient(data), brief }
}
