import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canPayMilestone, milestoneStatusLabel } from '../src/lib/milestones.js'
import { splitMilestoneAmounts } from '../api/_lib/milestones.js'

test('splitMilestoneAmounts defaults to 33/33/34', () => {
  assert.deepEqual(splitMilestoneAmounts(100), [33, 33, 34])
  assert.deepEqual(splitMilestoneAmounts(10), [3, 3, 4])
})

test('canPayMilestone enforces sequential release', () => {
  const milestones = [
    { id: 'a', sortOrder: 0, status: 'awaiting_payment' },
    { id: 'b', sortOrder: 1, status: 'awaiting_payment' },
  ]
  assert.equal(canPayMilestone(milestones[0], milestones), true)
  assert.equal(canPayMilestone(milestones[1], milestones), false)

  milestones[0].status = 'released'
  assert.equal(canPayMilestone(milestones[1], milestones), true)
})

test('milestoneStatusLabel shows release requested', () => {
  assert.equal(milestoneStatusLabel('funded'), 'Funded — pending approval')
  assert.equal(
    milestoneStatusLabel('funded', { releaseRequested: true }),
    'Release requested',
  )
})
