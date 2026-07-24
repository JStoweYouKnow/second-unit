import { createHash } from 'crypto'
import { getArtistIdForProfile } from './bookings.js'
import {
  ensureContractMilestones,
  listMilestonesForContract,
  attachMilestonesToContracts,
} from './milestones.js'
import { notifyContractSigned } from './notificationEvents.js'
import { buildAgreementTerms } from './agreementTemplate.js'

/** SHA-256 of the agreement snapshot at sign time (terms + attachment identity + value). */
export function buildContractDocumentHash(row) {
  const payload = JSON.stringify({
    id: row.id,
    title: row.title ?? '',
    terms: row.terms ?? '',
    total_value: row.total_value ?? 0,
    attachment: row.attachment_storage_path || row.attachment_url || '',
    attachment_name: row.attachment_name || '',
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
  })
  return createHash('sha256').update(payload).digest('hex')
}

export function buildTypedSignatureRecord({
  name,
  userId,
  ip = null,
  userAgent = null,
  documentHash,
}) {
  return {
    name,
    date: new Date().toISOString(),
    ip: ip || null,
    userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
    userId: userId || null,
    documentHash,
    method: 'typed_esign',
  }
}

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
    signedByEmployerAt: row.signed_by_employer_at ?? row.employer_signature?.date ?? null,
    signedByArtistAt: row.signed_by_artist_at ?? row.artist_signature?.date ?? null,
    documentHash: row.document_hash ?? null,
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
  return /column .* does not exist|Could not find the .* column|employer_signature|artist_signature|signed_by_employer_at|signed_by_artist_at|document_hash/i.test(msg)
}

export async function signContract(db, contractId, userId, { name, ip = null, userAgent = null }) {
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

  const documentHash = buildContractDocumentHash(row)
  const signedAt = new Date().toISOString()
  const signature = buildTypedSignatureRecord({
    name: trimmedName,
    userId,
    ip,
    userAgent,
    documentHash,
  })
  // Keep date aligned with column timestamps
  signature.date = signedAt

  const patch = {
    updated_at: signedAt,
    document_hash: documentHash,
  }

  if (signingAsArtist) {
    patch.signed_by_artist = true
    patch.artist_signature = signature
    patch.signed_by_artist_at = signedAt
  } else {
    patch.signed_by_employer = true
    patch.employer_signature = signature
    patch.signed_by_employer_at = signedAt
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

  // Older DBs may lack audit / jsonb signature columns — strip and retry.
  if (updateError && isMissingColumnError(updateError)) {
    const {
      employer_signature: _es,
      artist_signature: _as,
      signed_by_employer_at: _ea,
      signed_by_artist_at: _aa,
      document_hash: _dh,
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

  const { error: auditErr } = await db.from('contract_signature_events').insert({
    contract_id: contractId,
    signer_user_id: userId,
    party: signingAsArtist ? 'artist' : 'employer',
    signature_name: trimmedName,
    signed_at: signedAt,
    ip: ip || null,
    user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
    document_hash: documentHash,
    method: 'typed_esign',
  })
  if (auditErr) {
    // Table may not exist until migration is applied — signing still succeeds.
    console.warn('[contracts] signature event log skipped:', auditErr.message)
  }

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
