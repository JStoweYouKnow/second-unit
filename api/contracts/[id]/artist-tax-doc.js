import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'

const TAX_BUCKET = 'employer-tax-docs'

/**
 * Let the hirer download the assigned artist's W-9 for a contract they own.
 * The artist uploads their W-9 to their private tax vault; only the counterparty
 * employer on the contract can pull a short-lived signed URL here (service role).
 */
export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query

  const { data: contract, error: contractError } = await db
    .from('contracts')
    .select('id, employer_id, artist_id, status')
    .eq('id', id)
    .maybeSingle()

  if (contractError) return res.status(500).json({ error: contractError.message })
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  if (contract.employer_id !== user.id) {
    return res.status(403).json({ error: 'Only the client on this contract can view the artist W-9' })
  }

  const { data: artist } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', contract.artist_id)
    .maybeSingle()

  if (!artist?.profile_id) {
    return res.status(404).json({ error: 'Artist profile not found' })
  }

  const { data: docs, error: docError } = await db
    .from('tax_documents')
    .select('id, file_name, storage_path, created_at')
    .eq('owner_id', artist.profile_id)
    .eq('doc_type', 'w9')
    .order('created_at', { ascending: false })
    .limit(1)

  if (docError) return res.status(500).json({ error: docError.message })
  const doc = docs?.[0]
  if (!doc) {
    return res.status(404).json({ error: 'The artist has not uploaded a W-9 yet' })
  }

  const { data: signed, error: signError } = await db.storage
    .from(TAX_BUCKET)
    .createSignedUrl(doc.storage_path, 300)

  if (signError) return res.status(500).json({ error: signError.message })

  return res.json({ url: signed?.signedUrl ?? null, fileName: doc.file_name })
}
