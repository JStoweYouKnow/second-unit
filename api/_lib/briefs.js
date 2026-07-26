import { getArtistIdForProfile } from './bookings.js'
import {
  BRIEF_VISIBILITY,
  REDACTED_BRIEF_DESCRIPTION,
  canViewFullBrief,
  getBriefNdaAcceptance,
  redactBriefForViewer,
} from './confidentiality.js'

export { BRIEF_VISIBILITY, REDACTED_BRIEF_DESCRIPTION }

export function mapBriefToClient(row, extra = {}) {
  if (!row) return null
  return {
    id: row.id,
    employerId: row.employer_id,
    employerName: row.employer?.full_name ?? extra.employerName ?? 'Client',
    title: row.title,
    description: row.description ?? '',
    budget: row.budget_min ?? row.budget_max ?? null,
    budgetMin: row.budget_min ?? null,
    budgetMax: row.budget_max ?? null,
    ndaStoragePath: row.nda_storage_path ?? null,
    ndaName: row.nda_name ?? null,
    ndaMime: row.nda_mime ?? null,
    visibility: row.visibility ?? BRIEF_VISIBILITY.PUBLIC,
    descriptionRedacted: extra.descriptionRedacted ?? false,
    ndaAcceptedAt: extra.ndaAcceptedAt ?? null,
    canDownloadNda: extra.canDownloadNda ?? Boolean(row.nda_storage_path),
    timeline: row.timeline ?? '',
    location: row.location ?? 'Remote',
    skills: Array.isArray(row.skills) ? row.skills : [],
    status: row.status,
    createdAt: row.created_at,
    applicationCount: extra.applicationCount ?? undefined,
    applied: extra.applied ?? undefined,
    applicationStatus: extra.applicationStatus ?? undefined,
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
    ndaAcceptedAt: row.nda_accepted_at ?? null,
    createdAt: row.created_at,
  }
}

export async function getBriefForViewer(db, briefId, viewerProfileId) {
  const brief = await getBriefRow(db, briefId)
  if (!brief) return null
  const myApplication = await getArtistApplicationOnBrief(db, briefId, viewerProfileId)
  return shapeBriefForViewer(db, brief, viewerProfileId, {
    hasApplication: Boolean(myApplication),
    applied: Boolean(myApplication),
    applicationStatus: myApplication?.status,
  })
}

export function mapBriefToDb(payload, employerId) {
  const num = (v) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const budget =
    payload.budget != null
      ? num(payload.budget)
      : payload.budgetMin != null || payload.budgetMax != null
        ? num(payload.budgetMin ?? payload.budgetMax)
        : null
  return {
    employer_id: employerId,
    title: String(payload.title || '').slice(0, 200),
    description: String(payload.description || '').slice(0, 4000),
    budget_min: budget,
    budget_max: budget,
    timeline: payload.timeline ? String(payload.timeline).slice(0, 200) : null,
    location: payload.location ? String(payload.location).slice(0, 120) : 'Remote',
    skills: Array.isArray(payload.skills)
      ? payload.skills.map((s) => String(s).slice(0, 60)).slice(0, 20)
      : [],
    visibility:
      payload.visibility && Object.values(BRIEF_VISIBILITY).includes(payload.visibility)
        ? payload.visibility
        : BRIEF_VISIBILITY.PUBLIC,
  }
}

async function isAdminProfile(db, profileId) {
  const { data } = await db.from('profiles').select('role').eq('id', profileId).maybeSingle()
  return data?.role === 'admin'
}

async function shapeBriefForViewer(db, brief, viewerProfileId, extra = {}) {
  const admin = await isAdminProfile(db, viewerProfileId)
  const ndaAcceptedAt = await getBriefNdaAcceptance(db, brief.id, viewerProfileId)
  const canViewFull = canViewFullBrief({
    brief,
    viewerProfileId,
    isAdmin: admin,
    ndaAcceptedAt,
    hasApplication: extra.hasApplication ?? false,
  })
  const shaped = redactBriefForViewer(brief, { canViewFull, ndaAcceptedAt })
  return mapBriefToClient(shaped, {
    descriptionRedacted: shaped.descriptionRedacted,
    ndaAcceptedAt: shaped.ndaAcceptedAt,
    canDownloadNda:
      Boolean(brief.nda_storage_path) &&
      (admin ||
        brief.employer_id === viewerProfileId ||
        Boolean(ndaAcceptedAt) ||
        extra.hasApplication ||
        (brief.visibility === BRIEF_VISIBILITY.NDA_GATED && brief.status === 'open') ||
        (brief.visibility === BRIEF_VISIBILITY.PUBLIC && brief.status === 'open')),
    ...extra,
  })
}

/** Open briefs for the marketplace, flagged with whether the viewing artist applied. */
export async function listOpenBriefs(db, viewerProfileId) {
  const { data: briefs, error } = await db
    .from('open_briefs')
    .select('*, employer:profiles!employer_id(full_name)')
    .eq('status', 'open')
    .in('visibility', [BRIEF_VISIBILITY.PUBLIC, BRIEF_VISIBILITY.NDA_GATED])
    .order('created_at', { ascending: false })
  if (error) throw error

  const artistId = await getArtistIdForProfile(db, viewerProfileId)
  const appStatusByBriefId = new Map()
  if (artistId) {
    const { data: apps } = await db
      .from('brief_applications')
      .select('brief_id, status')
      .eq('artist_id', artistId)
    for (const app of apps || []) appStatusByBriefId.set(app.brief_id, app.status)
  }

  const openById = new Map((briefs || []).map((b) => [b.id, b]))
  const missingIds = [...appStatusByBriefId.keys()].filter((id) => !openById.has(id))
  if (missingIds.length) {
    const { data: appliedBriefs, error: appliedErr } = await db
      .from('open_briefs')
      .select('*, employer:profiles!employer_id(full_name)')
      .in('id', missingIds)
    if (appliedErr) throw appliedErr
    for (const b of appliedBriefs || []) openById.set(b.id, b)
  }

  return Promise.all(
    [...openById.values()]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(async (b) => {
        const client = await shapeBriefForViewer(db, b, viewerProfileId, {
          hasApplication: appStatusByBriefId.has(b.id),
          applied: appStatusByBriefId.has(b.id),
          applicationStatus: appStatusByBriefId.get(b.id),
        })
        return client
      }),
  )
}

export async function getArtistApplicationOnBrief(db, briefId, artistProfileId) {
  const artistId = await getArtistIdForProfile(db, artistProfileId)
  if (!artistId) return null
  const { data, error } = await db
    .from('brief_applications')
    .select('id, status, message, proposed_rate, nda_accepted_at, created_at')
    .eq('brief_id', briefId)
    .eq('artist_id', artistId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    status: data.status,
    message: data.message ?? '',
    proposedRate: data.proposed_rate ?? null,
    ndaAcceptedAt: data.nda_accepted_at ?? null,
    createdAt: data.created_at,
  }
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
  if (patch.ndaStoragePath !== undefined) {
    update.nda_storage_path = patch.ndaStoragePath
      ? String(patch.ndaStoragePath).slice(0, 500)
      : null
  }
  if (patch.ndaName !== undefined) {
    update.nda_name = patch.ndaName ? String(patch.ndaName).slice(0, 255) : null
  }
  if (patch.ndaMime !== undefined) {
    update.nda_mime = patch.ndaMime ? String(patch.ndaMime).slice(0, 120) : null
  }
  if (patch.visibility && Object.values(BRIEF_VISIBILITY).includes(patch.visibility)) {
    update.visibility = patch.visibility
  }

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

  if (brief.nda_storage_path) {
    if (!payload.ndaAccepted) return { error: 'nda_required' }
    if (brief.visibility === BRIEF_VISIBILITY.NDA_GATED) {
      const accepted = await getBriefNdaAcceptance(db, briefId, artistProfileId)
      if (!accepted) return { error: 'nda_required' }
    }
  }

  const row = {
    brief_id: briefId,
    artist_id: artistId,
    message: String(payload.message || '').slice(0, 2000),
    proposed_rate:
      payload.proposedRate != null && Number.isFinite(Number(payload.proposedRate))
        ? Math.round(Number(payload.proposedRate))
        : null,
    nda_accepted_at: payload.ndaAccepted ? new Date().toISOString() : null,
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
