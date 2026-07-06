import { getArtistIdForProfile } from './bookings.js'
import {
  markBookingPaidFromMilestone,
  syncBookingStatusFromContract,
} from './bookingContract.js'
import {
  notifyMilestoneFunded,
  notifyMilestoneReleased,
} from './notificationEvents.js'
import { platformFeeAmountCents, artistPayoutAmountCents } from './fees.js'
import { stripe } from './stripe.js'

export const DEFAULT_MILESTONE_TITLES = [
  { title: 'On contract execution', description: 'Initial payment upon signed agreement' },
  { title: 'First draft / proof delivery', description: 'Payment upon delivery of first draft or proof' },
  { title: 'Final approval & delivery', description: 'Final payment upon approved deliverables' },
]

/** Split total contract value into three milestone amounts (33/33/34). */
export function splitMilestoneAmounts(totalValue) {
  const total = Math.round(Number(totalValue) || 0)
  const third = Math.floor(total / 3)
  const remainder = total - third * 2
  return [third, third, remainder]
}

export function mapMilestoneToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    contractId: row.contract_id,
    sortOrder: row.sort_order,
    title: row.title,
    description: row.description ?? '',
    amount: row.amount,
    status: row.status,
    paymentId: row.payment_id ?? null,
    approvedAt: row.approved_at ?? null,
    releasedAt: row.released_at ?? null,
  }
}

export function buildDefaultMilestoneRows(contractId, totalValue) {
  const amounts = splitMilestoneAmounts(totalValue)
  return DEFAULT_MILESTONE_TITLES.map((m, i) => ({
    contract_id: contractId,
    sort_order: i,
    title: m.title,
    description: m.description,
    amount: amounts[i],
    status: 'awaiting_payment',
  }))
}

export async function ensureContractMilestones(db, contract) {
  if (!contract?.id || contract.status !== 'active') return []

  const { data: existing } = await db
    .from('contract_milestones')
    .select('id')
    .eq('contract_id', contract.id)
    .limit(1)

  if (existing?.length) {
    return listMilestonesForContract(db, contract.id)
  }

  const rows = buildDefaultMilestoneRows(contract.id, contract.total_value)
  const { data, error } = await db.from('contract_milestones').insert(rows).select()
  if (error) throw error
  return (data || []).map(mapMilestoneToClient)
}

export async function listMilestonesForContract(db, contractId) {
  const { data, error } = await db
    .from('contract_milestones')
    .select('*')
    .eq('contract_id', contractId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []).map(mapMilestoneToClient)
}

export async function attachMilestonesToContracts(db, contracts) {
  if (!contracts?.length) return contracts
  const ids = contracts.map((c) => c.id)
  const { data, error } = await db
    .from('contract_milestones')
    .select('*')
    .in('contract_id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw error
  const byContract = new Map()
  for (const row of data || []) {
    const client = mapMilestoneToClient(row)
    if (!byContract.has(row.contract_id)) byContract.set(row.contract_id, [])
    byContract.get(row.contract_id).push(client)
  }

  return contracts.map((c) => ({
    ...c,
    milestones: byContract.get(c.id) || [],
  }))
}

export function canPayMilestone(milestone, allMilestones) {
  if (milestone.status !== 'awaiting_payment') return false
  if (milestone.sortOrder === 0) return true
  const previous = allMilestones.find((m) => m.sortOrder === milestone.sortOrder - 1)
  return previous?.status === 'released'
}

export async function getMilestoneWithContract(db, milestoneId) {
  const { data: milestone, error } = await db
    .from('contract_milestones')
    .select('*')
    .eq('id', milestoneId)
    .single()

  if (error) throw error

  const { data: contract, error: contractError } = await db
    .from('contracts')
    .select('*')
    .eq('id', milestone.contract_id)
    .single()

  if (contractError) throw contractError
  return { milestone, contract }
}

export async function userCanAccessMilestoneContract(db, userId, contract) {
  if (!contract) return false
  if (contract.employer_id === userId) return true
  const artistId = await getArtistIdForProfile(db, userId)
  return artistId != null && contract.artist_id === artistId
}

export async function completeMilestonePayment(db, milestoneId, { paymentIntentId = null } = {}) {
  const { milestone, contract } = await getMilestoneWithContract(db, milestoneId)

  if (milestone.status !== 'awaiting_payment') {
    return { milestone, payment: null, alreadyPaid: true }
  }

  const all = await listMilestonesForContract(db, contract.id)
  const clientMilestone = mapMilestoneToClient(milestone)
  if (!canPayMilestone(clientMilestone, all)) {
    return { error: 'Previous milestone must be released before paying this one' }
  }

  const { data: artist } = await db
    .from('artists')
    .select('stripe_account_id, display_name')
    .eq('id', contract.artist_id)
    .maybeSingle()

  const amountCents = Math.round(Number(milestone.amount) * 100)
  const description = `${contract.title} · ${milestone.title}`

  const { data: existingPayment } = await db
    .from('payments')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('status', 'paid')
    .maybeSingle()

  if (existingPayment) {
    return { milestone: { ...clientMilestone, status: 'funded' }, payment: existingPayment, alreadyPaid: true }
  }

  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      contract_id: contract.id,
      milestone_id: milestoneId,
      employer_id: contract.employer_id,
      artist_id: contract.artist_id,
      amount: amountCents,
      description,
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
      artist_stripe_account_id: artist?.stripe_account_id ?? null,
      platform_fee_amount: platformFeeAmountCents(amountCents),
      artist_payout_amount: artistPayoutAmountCents(amountCents),
      payout_status: 'pending',
    })
    .select()
    .single()

  if (paymentError) return { error: paymentError.message }

  const { data: updatedMilestone, error: milestoneError } = await db
    .from('contract_milestones')
    .update({
      status: 'funded',
      payment_id: payment.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', milestoneId)
    .select()
    .single()

  if (milestoneError) return { error: milestoneError.message }

  await markBookingPaidFromMilestone(db, contract.id)

  const { data: artistRow } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', contract.artist_id)
    .maybeSingle()

  await notifyMilestoneFunded(db, {
    contract,
    milestone: updatedMilestone,
    artistProfileId: artistRow?.profile_id ?? null,
  })

  return {
    milestone: mapMilestoneToClient(updatedMilestone),
    payment,
    alreadyPaid: false,
  }
}

export async function releaseMilestonePayout(db, milestoneId, userId) {
  const { milestone, contract } = await getMilestoneWithContract(db, milestoneId)

  if (contract.employer_id !== userId) {
    throw new Error('Only the hirer can approve milestone release')
  }

  if (milestone.status !== 'funded') {
    throw new Error('Milestone must be funded before it can be approved for release')
  }

  const { data: payment, error: paymentError } = await db
    .from('payments')
    .select('*')
    .eq('milestone_id', milestoneId)
    .eq('status', 'paid')
    .eq('payout_status', 'pending')
    .maybeSingle()

  if (paymentError) throw paymentError
  if (!payment) throw new Error('No pending payout found for this milestone')

  if (stripe && payment.artist_stripe_account_id) {
    const account = await stripe.accounts.retrieve(payment.artist_stripe_account_id).catch(() => null)
    if (!account?.payouts_enabled) {
      throw new Error('Artist has not completed Stripe onboarding and cannot receive payouts yet')
    }

    const transfer = await stripe.transfers.create({
      amount: payment.artist_payout_amount,
      currency: 'usd',
      destination: payment.artist_stripe_account_id,
      transfer_group: String(milestoneId),
      metadata: { milestoneId, contractId: contract.id },
    })

    await db
      .from('payments')
      .update({ payout_status: 'paid', transfer_id: transfer.id })
      .eq('id', payment.id)
  } else {
    await db.from('payments').update({ payout_status: 'paid' }).eq('id', payment.id)
  }

  const now = new Date().toISOString()
  const { data: updatedMilestone, error: updateError } = await db
    .from('contract_milestones')
    .update({
      status: 'released',
      approved_at: now,
      approved_by: userId,
      released_at: now,
      updated_at: now,
    })
    .eq('id', milestoneId)
    .select()
    .single()

  if (updateError) throw updateError

  const remaining = await listMilestonesForContract(db, contract.id)
  if (remaining.every((m) => m.status === 'released')) {
    await db
      .from('contracts')
      .update({ status: 'completed', updated_at: now })
      .eq('id', contract.id)
    await syncBookingStatusFromContract(db, contract.id)
  }

  const { data: artistRow } = await db
    .from('artists')
    .select('profile_id')
    .eq('id', contract.artist_id)
    .maybeSingle()

  await notifyMilestoneReleased(db, {
    contract,
    milestone: updatedMilestone,
    artistProfileId: artistRow?.profile_id ?? null,
  })

  return mapMilestoneToClient(updatedMilestone)
}
