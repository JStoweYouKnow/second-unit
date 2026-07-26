import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Packer } from 'docx'
import { getInvoiceLineItems } from '../src/lib/documentExport.js'
import { buildContractDocx, buildInvoiceDocx, buildReceiptDocx } from '../src/lib/documentExportDocx.js'

const sampleContract = {
  id: 'abc123def456',
  title: 'Test Project',
  artistName: 'Artist Name',
  value: 3000,
  startDate: '2026-01-01',
  endDate: '2026-03-01',
  terms: 'Sample terms.\nSecond line.',
  status: 'active',
  type: 'standard',
}

describe('documentExport docx', () => {
  it('getInvoiceLineItems falls back to default milestones', () => {
    const items = getInvoiceLineItems({ value: 3000 })
    assert.equal(items.length, 3)
    assert.equal(items.reduce((sum, item) => sum + item.amount, 0), 3000)
  })

  it('buildContractDocx produces a valid docx zip archive', async () => {
    const doc = buildContractDocx(sampleContract, { clientName: 'Client Co' })
    const buffer = await Packer.toBuffer(doc)
    assert.ok(buffer.length > 2000)
    assert.equal(buffer[0], 0x50)
    assert.equal(buffer[1], 0x4b)
  })

  it('buildInvoiceDocx produces a valid docx zip archive', async () => {
    const doc = buildInvoiceDocx(sampleContract, {
      clientName: 'Client Co',
      payments: [{ status: 'paid', amount: 1000 }],
      platformFeePercent: 15,
    })
    const buffer = await Packer.toBuffer(doc)
    assert.ok(buffer.length > 2000)
    assert.equal(buffer[0], 0x50)
    assert.equal(buffer[1], 0x4b)
  })

  it('buildReceiptDocx produces a valid docx zip archive', async () => {
    const doc = buildReceiptDocx(
      { id: 'pay_1', amount: 500, date: '2026-02-01', status: 'paid', artistName: 'Artist', description: 'Milestone 1' },
      { isArtist: true, viewerName: 'Artist Name', platformFeePercent: 15, platformFee: 75, displayAmount: 425 }
    )
    const buffer = await Packer.toBuffer(doc)
    assert.ok(buffer.length > 1500)
    assert.equal(buffer[0], 0x50)
    assert.equal(buffer[1], 0x4b)
  })
})
