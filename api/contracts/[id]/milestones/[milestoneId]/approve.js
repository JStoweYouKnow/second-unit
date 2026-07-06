import { requireAuth } from '../../../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../../../_lib/ratelimit.js'
import { db } from '../../../../_lib/db.js'
import {
  releaseMilestonePayout,
  getMilestoneWithContract,
} from '../../../../_lib/milestones.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id: contractId, milestoneId } = req.query
  if (!contractId || !milestoneId) {
    return res.status(400).json({ error: 'Contract id and milestone id required' })
  }

  try {
    const { milestone } = await getMilestoneWithContract(db, milestoneId)
    if (milestone.contract_id !== contractId) {
      return res.status(400).json({ error: 'Milestone does not belong to this contract' })
    }

    const released = await releaseMilestonePayout(db, milestoneId, user.id)
    return res.json(released)
  } catch (err) {
    const status =
      err.message === 'Only the hirer can approve milestone release' ||
      err.message === 'Forbidden'
        ? 403
        : 400
    return res.status(status).json({ error: err.message })
  }
}
