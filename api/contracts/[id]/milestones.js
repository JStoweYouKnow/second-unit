import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import {
  listMilestonesForContract,
  userCanAccessMilestoneContract,
  ensureContractMilestones,
} from '../../_lib/milestones.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id: contractId } = req.query
  if (!contractId) return res.status(400).json({ error: 'Contract id required' })

  if (req.method === 'GET') {
    try {
      const { data: contract, error } = await db
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single()

      if (error) return res.status(404).json({ error: 'Contract not found' })
      const allowed = await userCanAccessMilestoneContract(db, user.id, contract)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })

      if (contract.status === 'active' || contract.status === 'completed') {
        await ensureContractMilestones(db, contract)
      }

      const milestones = await listMilestonesForContract(db, contractId)
      return res.json(milestones)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
