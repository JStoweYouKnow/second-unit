import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STANDARD_AGREEMENT_TEMPLATE,
  buildAgreementTerms,
  appendMilestoneDeliverables,
} from '../src/lib/agreementTemplate.js'

test('buildAgreementTerms with attachment only uses standard template plus attachment note', () => {
  const terms = buildAgreementTerms({
    hasAttachment: true,
    attachmentName: 'MSA.pdf',
  })
  assert.match(terms, /^INDEPENDENT CONTRACTOR AGREEMENT/)
  assert.match(terms, /MSA\.pdf/)
  assert.match(terms, /incorporates the attached file by reference/)
})

test('buildAgreementTerms appends attachment note to custom text', () => {
  const terms = buildAgreementTerms({
    importedTerms: 'Custom scope section.',
    hasAttachment: true,
    attachmentName: 'SOW.docx',
  })
  assert.match(terms, /^Custom scope section\./)
  assert.match(terms, /SOW\.docx/)
})

test('appendMilestoneDeliverables adds deliverable blocks', () => {
  const base = STANDARD_AGREEMENT_TEMPLATE
  const terms = appendMilestoneDeliverables(
    base,
    ['Kickoff brief', '', 'Final delivery package'],
    [3300, 3300, 3400]
  )
  assert.match(terms, /EXPECTED DELIVERABLES BY MILESTONE/)
  assert.match(terms, /On contract execution — \$3,300/)
  assert.match(terms, /Kickoff brief/)
  assert.match(terms, /Final approval & delivery — \$3,400/)
  assert.doesNotMatch(terms, /First draft/)
})

test('appendMilestoneDeliverables is no-op when all empty', () => {
  const base = 'Base terms'
  assert.equal(appendMilestoneDeliverables(base, ['', '', '']), base)
})
