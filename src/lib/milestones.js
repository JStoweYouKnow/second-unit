export const DEFAULT_MILESTONE_TITLES = [
  { title: 'On contract execution', description: 'Initial payment upon signed agreement' },
  { title: 'First draft / proof delivery', description: 'Payment upon delivery of first draft or proof' },
  { title: 'Final approval & delivery', description: 'Final payment upon approved deliverables' },
]

export function splitMilestoneAmounts(totalValue, customAmounts = null) {
  if (Array.isArray(customAmounts) && customAmounts.length === 3) {
    const parsed = customAmounts.map((n) => Math.round(Number(n) || 0))
    const sum = parsed.reduce((a, b) => a + b, 0)
    const total = Math.round(Number(totalValue) || 0)
    if (sum === total && parsed.every((n) => n >= 0)) return parsed
  }
  const total = Math.round(Number(totalValue) || 0)
  const third = Math.floor(total / 3)
  const remainder = total - third * 2
  return [third, third, remainder]
}

export function buildDefaultMilestones(contractId, totalValue, customAmounts = null) {
  const amounts = splitMilestoneAmounts(totalValue, customAmounts)
  return DEFAULT_MILESTONE_TITLES.map((m, i) => ({
    id: `ms-${contractId}-${i}`,
    contractId,
    sortOrder: i,
    title: m.title,
    description: m.description,
    amount: amounts[i],
    status: 'awaiting_payment',
    paymentId: null,
    approvedAt: null,
    releasedAt: null,
  }))
}

export function canPayMilestone(milestone, allMilestones) {
  if (milestone.status !== 'awaiting_payment') return false
  if (milestone.sortOrder === 0) return true
  const previous = allMilestones.find((m) => m.sortOrder === milestone.sortOrder - 1)
  return previous?.status === 'released'
}

export function milestoneStatusLabel(status, { releaseRequested = false } = {}) {
  const map = {
    awaiting_payment: 'Awaiting payment',
    funded: releaseRequested ? 'Release requested' : 'Funded — pending approval',
    released: 'Released to artist',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}

export function milestoneStatusColor(status, { releaseRequested = false } = {}) {
  if (status === 'released') return 'var(--success)'
  if (status === 'funded' && releaseRequested) return 'var(--accent)'
  if (status === 'funded') return 'var(--warning)'
  if (status === 'awaiting_payment') return 'var(--text-muted)'
  return 'var(--text-secondary)'
}
