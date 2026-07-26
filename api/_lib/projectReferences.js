export function mapReferenceToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    contractId: row.contract_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    name: row.name,
    mime: row.mime ?? null,
    createdAt: row.created_at,
  }
}

export async function listProjectReferences(db, contractId, userId) {
  const { data: contract, error: contractErr } = await db
    .from('contracts')
    .select('id, employer_id, artist_id, signed_by_employer, signed_by_artist')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) throw contractErr
  if (!contract) return { error: 'not_found' }

  const { data: artist } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', contract.artist_id)
    .maybeSingle()

  const isEmployer = contract.employer_id === userId
  const isArtist = artist?.profile_id === userId
  if (!isEmployer && !isArtist) return { error: 'forbidden' }

  const { data, error } = await db
    .from('project_references')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const fullySigned = contract.signed_by_employer && contract.signed_by_artist
  return {
    references: (data || []).map(mapReferenceToClient),
    canUpload: isEmployer,
    canDownload: isEmployer || fullySigned,
    fullySigned,
  }
}

export async function addProjectReference(db, contractId, userId, payload) {
  const { data: contract, error: contractErr } = await db
    .from('contracts')
    .select('employer_id')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) throw contractErr
  if (!contract) return { error: 'not_found' }
  if (contract.employer_id !== userId) return { error: 'forbidden' }

  const storagePath = String(payload.storagePath || '').slice(0, 500)
  const name = String(payload.name || 'reference').slice(0, 255)
  if (!storagePath || !name) return { error: 'invalid' }

  const { data, error } = await db
    .from('project_references')
    .insert({
      contract_id: contractId,
      uploaded_by: userId,
      storage_path: storagePath,
      name,
      mime: payload.mime ? String(payload.mime).slice(0, 120) : null,
    })
    .select('*')
    .single()
  if (error) throw error
  return { reference: mapReferenceToClient(data) }
}

export async function deleteProjectReference(db, contractId, referenceId, userId) {
  const { data: contract, error: contractErr } = await db
    .from('contracts')
    .select('employer_id')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) throw contractErr
  if (!contract) return { error: 'not_found' }
  if (contract.employer_id !== userId) return { error: 'forbidden' }

  const { data: ref } = await db
    .from('project_references')
    .select('storage_path')
    .eq('id', referenceId)
    .eq('contract_id', contractId)
    .maybeSingle()
  if (!ref) return { error: 'not_found' }

  const { error } = await db
    .from('project_references')
    .delete()
    .eq('id', referenceId)
    .eq('contract_id', contractId)
  if (error) throw error

  return { storagePath: ref.storage_path }
}
