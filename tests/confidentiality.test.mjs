import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canViewFullBrief,
  redactBriefForViewer,
  contractFullySigned,
  BRIEF_VISIBILITY,
  REDACTED_BRIEF_DESCRIPTION,
} from '../api/_lib/confidentiality.js'
import { SENSITIVE_SIGNED_URL_TTL } from '../src/lib/sensitiveStorage.js'

test('contractFullySigned requires both signatures', () => {
  assert.equal(contractFullySigned({ signed_by_employer: true, signed_by_artist: true }), true)
  assert.equal(contractFullySigned({ signed_by_employer: true, signed_by_artist: false }), false)
})

test('nda_gated brief redacts until NDA accepted', () => {
  const brief = {
    id: 'b1',
    employer_id: 'hirer',
    visibility: BRIEF_VISIBILITY.NDA_GATED,
    nda_storage_path: 'brief-nda/b1/file.pdf',
    description: 'Secret scope',
  }
  const canView = canViewFullBrief({
    brief,
    viewerProfileId: 'artist',
    isAdmin: false,
    ndaAcceptedAt: null,
    hasApplication: false,
  })
  assert.equal(canView, false)

  const redacted = redactBriefForViewer(brief, { canViewFull: canView, ndaAcceptedAt: null })
  assert.equal(redacted.descriptionRedacted, true)
  assert.equal(redacted.description, REDACTED_BRIEF_DESCRIPTION)
})

test('nda_gated brief shows full details after acceptance', () => {
  const brief = {
    id: 'b1',
    employer_id: 'hirer',
    visibility: BRIEF_VISIBILITY.NDA_GATED,
    nda_storage_path: 'brief-nda/b1/file.pdf',
    description: 'Secret scope',
  }
  const acceptedAt = '2026-07-25T00:00:00.000Z'
  const canView = canViewFullBrief({
    brief,
    viewerProfileId: 'artist',
    isAdmin: false,
    ndaAcceptedAt: acceptedAt,
    hasApplication: false,
  })
  assert.equal(canView, true)
  const shaped = redactBriefForViewer(brief, { canViewFull: canView, ndaAcceptedAt: acceptedAt })
  assert.equal(shaped.description, 'Secret scope')
  assert.equal(shaped.descriptionRedacted, false)
})

test('invite_only brief is fully visible when accessed via direct link (RLS-gated)', () => {
  const brief = {
    id: 'b2',
    employer_id: 'hirer',
    visibility: BRIEF_VISIBILITY.INVITE_ONLY,
    description: 'Private invite brief',
  }
  const canView = canViewFullBrief({
    brief,
    viewerProfileId: 'artist',
    isAdmin: false,
    ndaAcceptedAt: null,
    hasApplication: false,
  })
  assert.equal(canView, true)
})

test('sensitive signed URLs expire in 5 minutes', () => {
  assert.equal(SENSITIVE_SIGNED_URL_TTL, 300)
})
