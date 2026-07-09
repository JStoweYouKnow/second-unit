import { stripe, FRONTEND_URL } from '../../../_lib/stripe.js'
import { requireAuth } from '../../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../../_lib/ratelimit.js'
import { db } from '../../../_lib/db.js'
import {
  completeMilestonePayment,
  getMilestoneWithContract,
  canPayMilestone,
  listMilestonesForContract,
  mapMilestoneToClient,
} from '../../../_lib/milestones.js'
import { createProjectCheckoutSession } from '../../../_lib/checkout.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const contractId = req.query?.id || req.query?.contractId
  const milestoneId = req.query?.milestoneId
  if (!contractId || !milestoneId) {
    return res.status(400).json({ error: 'Contract id and milestone id required' })
  }

  try {
    const { milestone, contract } = await getMilestoneWithContract(db, milestoneId)

    if (milestone.contract_id !== contractId) {
      return res.status(400).json({ error: 'Milestone does not belong to this contract' })
    }

    if (contract.employer_id !== user.id) {
      return res.status(403).json({ error: 'Only the hirer can pay milestones' })
    }

    if (contract.status !== 'active' && contract.status !== 'completed') {
      return res.status(400).json({
        error: 'Both parties must sign the agreement before milestone payments unlock',
      })
    }

    const all = await listMilestonesForContract(db, contractId)
    const clientMilestone = mapMilestoneToClient(milestone)
    if (!canPayMilestone(clientMilestone, all)) {
      return res.status(400).json({
        error: clientMilestone.status !== 'awaiting_payment'
          ? 'This milestone has already been paid'
          : 'Complete the previous milestone before paying this one',
      })
    }

    const amountDollars = Number(milestone.amount)
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      return res.status(400).json({ error: 'Milestone amount is invalid' })
    }

    if (!stripe) {
      const result = await completeMilestonePayment(db, milestoneId, { paymentIntentId: null })
      if (result.error) return res.status(400).json({ error: result.error })
      return res.json({
        url: `${FRONTEND_URL}/projects?milestone_paid=1&contract_id=${contractId}`,
        milestone: result.milestone,
      })
    }

    const { data: artist } = await db
      .from('artists')
      .select('display_name, stripe_account_id')
      .eq('id', contract.artist_id)
      .maybeSingle()

    const session = await createProjectCheckoutSession(stripe, {
      amountDollars,
      productName: `${contract.title} — ${milestone.title}`,
      productDescription: `Milestone payment held in escrow for ${artist?.display_name || 'artist'} — artist payout releases after approval`,
      successUrl: `${FRONTEND_URL}/projects?milestone_paid=1&contract_id=${contractId}`,
      cancelUrl: `${FRONTEND_URL}/projects?milestone_cancelled=1&contract_id=${contractId}`,
      metadata: { contractId, milestoneId },
      artistStripeAccountId: artist?.stripe_account_id ?? null,
    })

    if (!session?.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL' })
    }

    return res.json({ url: session.url })
  } catch (err) {
    console.error('[milestones/pay]', err?.message || err)
    return res.status(500).json({ error: err.message || 'Failed to start milestone payment' })
  }
}
