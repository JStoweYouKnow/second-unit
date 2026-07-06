import { getArtistIdForProfile } from './bookings.js'
import {
  ensureContractMilestones,
  listMilestonesForContract,
  attachMilestonesToContracts,
} from './milestones.js'
import { notifyContractSigned } from './notificationEvents.js'

function mapStatusToClient(status) {
  return status
}

export function mapContractToClient(row) {
  if (!row) return null
  const artistName = row.artist?.display_name ?? row.artist_name ?? 'Artist'

  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName,
    clientName: row.client_name ?? '',
    type: row.contract_type || 'standard',
    status: mapStatusToClient(row.status),
    value: row.total_value ?? 0,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : '',
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : '',
    terms: row.terms ?? '',
    attachmentUrl: row.attachment_url ?? null,
    attachmentStoragePath: row.attachment_storage_path ?? null,
    attachmentName: row.attachment_name ?? null,
    attachmentMime: row.attachment_mime ?? null,
    hasAttachment: !!(row.attachment_storage_path || row.attachment_url),
    signedByEmployer: !!row.signed_by_employer,
    signedByArtist: !!row.signed_by_artist,
    employerSignature: row.employer_signature ?? null,
    artistSignature: row.artist_signature ?? null,
    bookingId: row.booking_id ?? null,
    milestones: row.milestones ?? [],
    milestoneAmounts: row.milestone_amounts ?? null,
    createdAt: row.created_at,
  }
}

export function mapContractToDb(payload, employerId) {
  return {
    employer_id: employerId,
    artist_id: payload.artistId,
    title: payload.title,
    contract_type: payload.type === 'custom' ? 'custom' : 'standard',
    status: 'pending',
    total_value: Math.round(Number(payload.value) || 0),
    start_date: payload.startDate || null,
    end_date: payload.endDate || null,
    terms: payload.terms || null,
    client_name: payload.clientName || null,
    attachment_url: payload.attachmentUrl || null,
    attachment_name: payload.attachmentName || null,
    attachment_mime: payload.attachmentMime || null,
    signed_by_employer: false,
    signed_by_artist: false,
    milestone_amounts: Array.isArray(payload.milestoneAmounts) && payload.milestoneAmounts.length === 3
      ? payload.milestoneAmounts.map((n) => Math.round(Number(n) || 0))
      : null,
  }
}

export async function listContractsForUser(db, userId) {
  const artistId = await getArtistIdForProfile(db, userId)

  let query = db
    .from('contracts')
    .select(`
      *,
      artist:artists(display_name)
    `)
    .order('created_at', { ascending: false })

  if (artistId) {
    query = query.or(`employer_id.eq.${userId},artist_id.eq.${artistId}`)
  } else {
    query = query.eq('employer_id', userId)
  }

  const { data, error } = await query
  if (error) throw error
  const mapped = (data || []).map(mapContractToClient)
  return attachMilestonesToContracts(db, mapped)
}

export async function userCanAccessContract(db, userId, row) {
  if (!row) return false
  if (row.employer_id === userId) return true
  const artistId = await getArtistIdForProfile(db, userId)
  return artistId != null && row.artist_id === artistId
}

export async function signContract(db, contractId, userId, { name, ip = null }) {
  const { data: row, error } = await db
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (error) throw error
  const canAccess = await userCanAccessContract(db, userId, row)
  if (!canAccess) throw new Error('Forbidden')

  const artistId = await getArtistIdForProfile(db, userId)
  const isArtist = artistId != null && row.artist_id === artistId
  const signature = { name: name.trim(), date: new Date().toISOString(), ip }

  const patch = {
    updated_at: new Date().toISOString(),
  }

  if (isArtist) {
    patch.signed_by_artist = true
    patch.artist_signature = signature
  } else {
    patch.signed_by_employer = true
    patch.employer_signature = signature
  }

  const signedByEmployer = isArtist ? row.signed_by_employer : true
  const signedByArtist = isArtist ? true : row.signed_by_artist
  if (signedByEmployer && signedByArtist) {
    patch.status = 'active'
  }

  const { data: updated, error: updateError } = await db
    .from('contracts')
    .update(patch)
    .eq('id', contractId)
    .select(`
      *,
      artist:artists(display_name)
    `)
    .single()

  if (updateError) throw updateError

  const { data: artistRow } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', row.artist_id)
    .maybeSingle()

  const otherPartyId = isArtist ? row.employer_id : artistRow?.profile_id
  await notifyContractSigned(db, {
    contract: updated,
    signedByUserId: userId,
    otherPartyId,
    bothSigned: signedByEmployer && signedByArtist,
  })

  if (signedByEmployer && signedByArtist) {
    await ensureContractMilestones(db, updated)
  }

  const milestones = await listMilestonesForContract(db, contractId)
  return { ...mapContractToClient(updated), milestones }
}

export async function updateContractAttachment(
  db,
  contractId,
  userId,
  { attachmentStoragePath, attachmentName, attachmentMime = null }
) {
  const { data: row, error } = await db
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (error) throw error
  if (row.employer_id !== userId) throw new Error('Forbidden')

  const { data: updated, error: updateError } = await db
    .from('contracts')
    .update({
      attachment_storage_path: attachmentStoragePath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
      attachment_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select(`
      *,
      artist:artists(display_name)
    `)
    .single()

  if (updateError) throw updateError
  const milestones = await listMilestonesForContract(db, contractId)
  return { ...mapContractToClient(updated), milestones }
}
