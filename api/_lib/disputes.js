import { getArtistIdForProfile } from './bookings.js'
import { executeDisputePayouts } from './disputePayouts.js'

export function mapDisputeToClient(row, evidence = []) {
  if (!row) return null
  return {
    id: row.id,
    bookingId: row.booking_id ?? null,
    contractId: row.contract_id ?? null,
    milestoneId: row.milestone_id ?? null,
    openedBy: row.opened_by,
    respondentId: row.respondent_id ?? null,
    title: row.title,
    reason: row.reason,
    description: row.description,
    status: row.status,
    outcome: row.outcome,
    resolutionNotes: row.resolution_notes ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    splitEmployerCents: row.split_employer_cents ?? null,
    splitArtistCents: row.split_artist_cents ?? null,
    payoutStatus: row.payout_status ?? null,
    payoutError: row.payout_error ?? null,
    payoutExecutedAt: row.payout_executed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: evidence.map(mapEvidenceToClient),
  }
}

export function mapEvidenceToClient(row) {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    uploadedBy: row.uploaded_by,
    note: row.note ?? '',
    fileName: row.file_name ?? null,
    storagePath: row.storage_path ?? null,
    mimeType: row.mime_type ?? null,
    createdAt: row.created_at,
  }
}

export async function isAdmin(db, userId) {
  const { data } = await db.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function userCanAccessDispute(db, userId, dispute) {
  if (!dispute) return false
  if (dispute.opened_by === userId || dispute.respondent_id === userId) return true
  return isAdmin(db, userId)
}

async function loadEvidence(db, disputeId) {
  const { data } = await db
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function listDisputesForUser(db, userId) {
  const admin = await isAdmin(db, userId)

  let query = db.from('disputes').select('*').order('created_at', { ascending: false })

  if (!admin) {
    query = query.or(`opened_by.eq.${userId},respondent_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data || []
  const results = []
  for (const row of rows) {
    const evidence = await loadEvidence(db, row.id)
    results.push(mapDisputeToClient(row, evidence))
  }
  return results
}

export async function getDisputeById(db, disputeId, userId) {
  const { data: row, error } = await db
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .maybeSingle()

  if (error) throw error
  if (!row) return null

  const allowed = await userCanAccessDispute(db, userId, row)
  if (!allowed) throw new Error('Forbidden')

  const evidence = await loadEvidence(db, disputeId)
  return mapDisputeToClient(row, evidence)
}

async function resolveRespondent(db, { bookingId, contractId, openedBy }) {
  if (contractId) {
    const { data: contract } = await db
      .from('contracts')
      .select('employer_id, artist:artists(profile_id)')
      .eq('id', contractId)
      .maybeSingle()
    if (!contract) return null
    const artistProfileId = contract.artist?.profile_id
    return openedBy === contract.employer_id ? artistProfileId : contract.employer_id
  }

  if (bookingId) {
    const { data: booking } = await db
      .from('bookings')
      .select('employer_id, artist:artists(profile_id)')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking) return null
    const artistProfileId = booking.artist?.profile_id
    return openedBy === booking.employer_id ? artistProfileId : booking.employer_id
  }

  return null
}

export async function createDispute(db, userId, payload) {
  const respondentId = await resolveRespondent(db, {
    bookingId: payload.bookingId ?? null,
    contractId: payload.contractId ?? null,
    openedBy: userId,
  })

  const { data, error } = await db
    .from('disputes')
    .insert({
      booking_id: payload.bookingId ?? null,
      contract_id: payload.contractId ?? null,
      milestone_id: payload.milestoneId ?? null,
      opened_by: userId,
      respondent_id: respondentId,
      title: payload.title,
      reason: payload.reason,
      description: payload.description,
      status: 'open',
    })
    .select()
    .single()

  if (error) throw error
  return mapDisputeToClient(data, [])
}

export async function addDisputeEvidence(db, disputeId, userId, payload) {
  const dispute = await getDisputeById(db, disputeId, userId)
  if (!dispute) throw new Error('Dispute not found')
  if (!['open', 'under_review', 'mediation'].includes(dispute.status)) {
    throw new Error('Cannot add evidence to a closed dispute')
  }

  const { data, error } = await db
    .from('dispute_evidence')
    .insert({
      dispute_id: disputeId,
      uploaded_by: userId,
      note: payload.note ?? null,
      file_name: payload.fileName ?? null,
      storage_path: payload.storagePath ?? null,
      mime_type: payload.mimeType ?? null,
    })
    .select()
    .single()

  if (error) throw error

  await db
    .from('disputes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', disputeId)

  return mapEvidenceToClient(data)
}

export async function updateDisputeStatus(db, disputeId, userId, { status }) {
  const { data: row } = await db.from('disputes').select('*').eq('id', disputeId).single()
  const allowed = await userCanAccessDispute(db, userId, row)
  if (!allowed) throw new Error('Forbidden')

  const admin = await isAdmin(db, userId)
  if (!admin && status !== 'mediation') {
    throw new Error('Only admins can change dispute status')
  }

  const { data, error } = await db
    .from('disputes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', disputeId)
    .select()
    .single()

  if (error) throw error
  const evidence = await loadEvidence(db, disputeId)
  return mapDisputeToClient(data, evidence)
}

export async function resolveDispute(db, disputeId, adminId, { outcome, resolutionNotes, splitEmployerCents, splitArtistCents }) {
  const admin = await isAdmin(db, adminId)
  if (!admin) throw new Error('Forbidden')

  const { data: existing, error: fetchError } = await db
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (fetchError) throw fetchError
  if (existing.status === 'resolved' || existing.status === 'closed') {
    throw new Error('Dispute is already resolved')
  }

  let payoutResult = { payoutStatus: 'skipped', actions: [], errors: [] }
  try {
    payoutResult = await executeDisputePayouts(db, existing, {
      outcome,
      splitEmployerCents,
      splitArtistCents,
    })
  } catch (err) {
    payoutResult = { payoutStatus: 'failed', actions: [], errors: [err.message] }
  }

  const payoutError =
    payoutResult.errors?.length > 0 ? payoutResult.errors.join('; ') : null

  const { data, error } = await db
    .from('disputes')
    .update({
      status: 'resolved',
      outcome,
      resolution_notes: resolutionNotes ?? null,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      split_employer_cents: splitEmployerCents ?? null,
      split_artist_cents: splitArtistCents ?? null,
      payout_status: payoutResult.payoutStatus,
      payout_error: payoutError,
      payout_executed_at: payoutResult.payoutStatus === 'executed' || payoutResult.payoutStatus === 'partial'
        ? new Date().toISOString()
        : null,
    })
    .eq('id', disputeId)
    .select()
    .single()

  if (error) throw error
  const evidence = await loadEvidence(db, disputeId)
  const client = mapDisputeToClient(data, evidence)
  return { ...client, payoutActions: payoutResult.actions }
}

export async function listOpenDisputesForAdmin(db) {
  const { data, error } = await db
    .from('disputes')
    .select('*')
    .in('status', ['open', 'under_review', 'mediation'])
    .order('created_at', { ascending: false })

  if (error) throw error
  const results = []
  for (const row of data || []) {
    results.push(mapDisputeToClient(row, await loadEvidence(db, row.id)))
  }
  return results
}

export { getArtistIdForProfile }
