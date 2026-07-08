import { getArtistIdForProfile } from './bookings.js'
import {
  ensureContractMilestones,
  listMilestonesForContract,
  attachMilestonesToContracts,
} from './milestones.js'
import { notifyContractSigned } from './notificationEvents.js'
import { buildAgreementTerms } from './agreementTemplate.js'

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
  const hasAttachment = !!(payload.attachmentUrl || payload.attachmentName || payload.attachmentStoragePath)
  return {
    employer_id: employerId,
    artist_id: payload.artistId,
    title: payload.title,
    contract_type: payload.type === 'custom' ? 'custom' : 'standard',
    status: 'pending',
    total_value: Math.round(Number(payload.value) || 0),
    start_date: payload.startDate || null,
    end_date: payload.endDate || null,
    terms: buildAgreementTerms({
      importedTerms: payload.terms,
      hasAttachment,
    }),
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

function isMissingColumnError(err) {
  const msg = err?.message || ''
  return /column .* does not exist|Could not find the .* column|employer_signature|artist_signature/i.test(msg)
}

export async function signContract(db, contractId, userId, { name, ip = null }) {
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) throw new Error('Signature name is required')

  const { data: row, error } = await db
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (error) throw error
  const canAccess = await userCanAccessContract(db, userId, row)
  if (!canAccess) throw new Error('Forbidden')

  const artistId = await getArtistIdForProfile(db, userId)
  const isArtistParty = artistId != null && row.artist_id === artistId
  const isEmployerParty = row.employer_id === userId

  // Prefer the employer role when the same user somehow matches both (edge case).
  if (!isArtistParty && !isEmployerParty) throw new Error('Forbidden')
  const signingAsArtist = isArtistParty && !isEmployerParty

  if (signingAsArtist && row.signed_by_artist) {
    const milestones = await listMilestonesForContract(db, contractId)
    return { ...mapContractToClient(row), milestones }
  }
  if (!signingAsArtist && row.signed_by_employer) {
    const milestones = await listMilestonesForContract(db, contractId)
    return { ...mapContractToClient(row), milestones }
  }

  const signature = { name: trimmedName, date: new Date().toISOString(), ip }

  const patch = {
    updated_at: new Date().toISOString(),
  }

  if (signingAsArtist) {
    patch.signed_by_artist = true
    patch.artist_signature = signature
  } else {
    patch.signed_by_employer = true
    patch.employer_signature = signature
  }

  const signedByEmployer = signingAsArtist ? !!row.signed_by_employer : true
  const signedByArtist = signingAsArtist ? true : !!row.signed_by_artist
  if (signedByEmployer && signedByArtist) {
    patch.status = 'active'
  }

  let { data: updated, error: updateError } = await db
    .from('contracts')
    .update(patch)
    .eq('id', contractId)
    .select(`
      *,
      artist:artists(display_name)
    `)
    .single()

  // Older DBs may lack employer_signature / artist_signature jsonb columns.
  if (updateError && isMissingColumnError(updateError)) {
    const {
      employer_signature: _es,
      artist_signature: _as,
      ...legacyPatch
    } = patch
    ;({ data: updated, error: updateError } = await db
      .from('contracts')
      .update(legacyPatch)
      .eq('id', contractId)
      .select(`
        *,
        artist:artists(display_name)
      `)
      .single())
  }

  if (updateError) throw updateError

  const { data: artistRow } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', row.artist_id)
    .maybeSingle()

  const otherPartyId = signingAsArtist ? row.employer_id : artistRow?.profile_id
  try {
    await notifyContractSigned(db, {
      contract: updated,
      signedByUserId: userId,
      otherPartyId,
      bothSigned: signedByEmployer && signedByArtist,
    })
  } catch (notifyErr) {
    console.error('[contracts] notify after sign failed:', notifyErr?.message || notifyErr)
  }

  if (signedByEmployer && signedByArtist) {
    try {
      await ensureContractMilestones(db, updated)
    } catch (milestoneErr) {
      console.error('[contracts] ensure milestones after sign failed:', milestoneErr?.message || milestoneErr)
    }
  }

  const milestones = await listMilestonesForContract(db, contractId)
  const mapped = { ...mapContractToClient(updated), milestones }
  // If jsonb signature columns are missing, still return the signature we just recorded.
  if (signingAsArtist) {
    mapped.signedByArtist = true
    mapped.artistSignature = mapped.artistSignature || signature
  } else {
    mapped.signedByEmployer = true
    mapped.employerSignature = mapped.employerSignature || signature
  }
  return mapped
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
