/**
 * True .docx export using the docx library (OOXML / ZIP).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { getInvoiceLineItems, triggerDownload } from './documentExport.js'

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`
}

function fmtDate(d) {
  if (!d) return '—'
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return String(d)
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'F0F0F0' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'F0F0F0' },
}

function text(value, opts = {}) {
  return new TextRun({ text: String(value ?? ''), size: 24, ...opts })
}

function muted(value) {
  return text(value, { color: '666666' })
}

function brandLine(value) {
  return new Paragraph({
    children: [text(value, { size: 20, color: '888888', allCaps: true })],
    spacing: { after: 120 },
  })
}

function titleLine(value) {
  return new Paragraph({
    children: [text(value, { bold: true, size: 48 })],
    spacing: { after: 80 },
  })
}

function sectionHeading(value) {
  return new Paragraph({
    children: [text(value, { bold: true, size: 22, color: '666666', allCaps: true })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E5E5' } },
    spacing: { before: 360, after: 160 },
  })
}

function bodyParagraph(value, opts = {}) {
  return new Paragraph({
    children: [text(value, opts)],
    spacing: { after: 80 },
  })
}

function footerParagraph(value) {
  return new Paragraph({
    children: [text(value, { size: 20, color: '999999' })],
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'EEEEEE' } },
    spacing: { before: 480, after: 0 },
  })
}

function preformattedParagraphs(value) {
  const lines = String(value || '').split('\n')
  if (!lines.length) return [bodyParagraph('')]
  return lines.map((line) => bodyParagraph(line || ' '))
}

function labelValueCell(label, value) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    children: [
      new Paragraph({ children: [text(label, { bold: true })] }),
      new Paragraph({ children: [text(value)] }),
    ],
  })
}

function twoColumnGrid(pairs) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: pairs.map(({ label, value }) => labelValueCell(label, value)),
      }),
    ],
  })
}

function signatureCell(role, sig) {
  const children = [
    new Paragraph({ children: [muted(role)] }),
  ]
  if (sig) {
    children.push(
      new Paragraph({
        children: [text(sig.name, { bold: true, italics: true, size: 44 })],
        spacing: { before: 120, after: 80 },
      }),
      new Paragraph({
        children: [
          muted(
            `Signed ${fmtDate(sig.date)} · typed e-sign${
              sig.documentHash ? ` · hash ${String(sig.documentHash).slice(0, 16)}…` : ''
            }`
          ),
        ],
      })
    )
  } else {
    children.push(new Paragraph({ children: [muted('Awaiting signature')] }))
  }

  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' },
      left: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' },
      right: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' },
    },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children,
  })
}

function totalsLine(label, value, { bold = false, grand = false } = {}) {
  return new Paragraph({
    children: [
      muted(label),
      text(`    ${value}`, { bold: bold || grand, size: grand ? 32 : 24 }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { after: grand ? 160 : 60 },
    border: grand ? { top: { style: BorderStyle.SINGLE, size: 8, color: '1A1A1A' } } : undefined,
  })
}

function invoiceTable(items) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders: TABLE_BORDERS,
        children: [new Paragraph({ children: [text('Description', { bold: true, size: 20, color: '888888' })] })],
      }),
      new TableCell({
        borders: TABLE_BORDERS,
        children: [new Paragraph({ children: [text('Status', { bold: true, size: 20, color: '888888' })] })],
      }),
      new TableCell({
        borders: TABLE_BORDERS,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [text('Amount', { bold: true, size: 20, color: '888888' })],
          }),
        ],
      }),
    ],
  })

  const rows = items.map(
    (item) =>
      new TableRow({
        children: [
          new TableCell({
            borders: TABLE_BORDERS,
            children: [new Paragraph({ children: [text(item.title)] })],
          }),
          new TableCell({
            borders: TABLE_BORDERS,
            children: [new Paragraph({ children: [text(item.status)] })],
          }),
          new TableCell({
            borders: TABLE_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [text(money(item.amount))],
              }),
            ],
          }),
        ],
      })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  })
}

function wrapDocument(title, children) {
  return new Document({
    title,
    creator: 'The Callsheet',
    description: title,
    sections: [{ children }],
  })
}

export function buildContractDocx(contract, { clientName } = {}) {
  const client = clientName || contract.clientName || 'Client'
  const agreementType = contract.type === 'custom' ? 'Custom' : 'Standard'
  const children = [
    brandLine('The Callsheet — Agreement'),
    titleLine(contract.title || 'Project Agreement'),
    new Paragraph({
      children: [
        muted(`Contract ID: ${contract.id} · `),
        text(`${agreementType} agreement`, { size: 20, color: '444444' }),
        muted(` · Status: ${contract.status || 'pending'}`),
      ],
      spacing: { after: 200 },
    }),
    sectionHeading('Parties'),
    twoColumnGrid([
      { label: 'Client', value: client },
      { label: 'Artist', value: contract.artistName || '' },
    ]),
    sectionHeading('Term & value'),
    twoColumnGrid([
      { label: 'Period', value: `${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}` },
      { label: 'Total value', value: money(contract.value) },
    ]),
    sectionHeading('Terms & conditions'),
    ...preformattedParagraphs(contract.terms || 'Standard platform agreement.'),
  ]

  if (contract.attachmentName) {
    children.push(
      new Paragraph({
        children: [
          muted('Attached file: '),
          text(contract.attachmentName, { bold: true }),
          muted(' (download from the contract record in The Callsheet).'),
        ],
        spacing: { before: 160, after: 160 },
      })
    )
  }

  children.push(
    sectionHeading('Signatures'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            signatureCell('Client', contract.employerSignature),
            signatureCell('Artist', contract.artistSignature),
          ],
        }),
      ],
    }),
    footerParagraph('Generated and managed through The Callsheet · thecallsheet.ai')
  )

  return wrapDocument(`${contract.title || 'Contract'} — Agreement`, children)
}

export function buildInvoiceDocx(contract, { clientName, payments = [], platformFeePercent = 15 } = {}) {
  const client = clientName || contract.clientName || 'Client'
  const items = getInvoiceLineItems(contract)
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0) || Number(contract.value || 0)
  const paid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const outstanding = Math.max(subtotal - paid, 0)
  const invoiceNo = `INV-${String(contract.id).slice(0, 8).toUpperCase()}`

  const children = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: NO_BORDERS,
              children: [
                brandLine('The Callsheet'),
                titleLine('Invoice'),
                new Paragraph({ children: [muted(`${invoiceNo} · Issued ${fmtDate(new Date())}`)] }),
              ],
            }),
            new TableCell({
              borders: NO_BORDERS,
              children: [
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [muted('Project')] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(contract.title || '', { bold: true })] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [muted(String(contract.id))] }),
              ],
            }),
          ],
        }),
      ],
    }),
    sectionHeading('Parties'),
    twoColumnGrid([
      { label: 'From (Artist)', value: contract.artistName || '' },
      { label: 'Bill to (Client)', value: client },
    ]),
    sectionHeading('Line items'),
    invoiceTable(items),
    totalsLine('Subtotal', money(subtotal)),
    totalsLine(`Platform fee (${platformFeePercent}%, collected at payment)`, money(Math.round(subtotal * (platformFeePercent / 100)))),
    totalsLine('Paid to date', `−${money(paid)}`),
    totalsLine('Amount due', money(outstanding), { grand: true }),
    new Paragraph({
      children: [
        muted(
          `Payments are processed through The Callsheet milestone escrow. The artist's share (${100 - platformFeePercent}%) is released as each milestone is approved. This document is a financial summary, not a tax form.`
        ),
      ],
      spacing: { before: 240, after: 120 },
    }),
    footerParagraph('The Callsheet · thecallsheet.ai'),
  ]

  return wrapDocument(`${invoiceNo} — Invoice`, children)
}

export function buildReceiptDocx(payment, {
  isArtist = false,
  viewerName = '',
  platformFeePercent = 15,
  platformFee = 0,
  artistPayout = 0,
  displayAmount = 0,
  method = 'Stripe',
} = {}) {
  const children = [
    brandLine('The Callsheet'),
    titleLine('Receipt'),
    new Paragraph({
      children: [
        muted(`Receipt ${payment.id} · ${fmtDate(payment.date)} · `),
        text(String(payment.status || ''), { size: 20, color: '444444' }),
      ],
      spacing: { after: 200 },
    }),
    sectionHeading('Parties'),
    twoColumnGrid([
      { label: isArtist ? 'Payee' : 'Billed to', value: viewerName || (isArtist ? 'Artist' : 'Client') },
      { label: isArtist ? 'From' : 'Artist', value: payment.artistName || '' },
    ]),
    sectionHeading(payment.description || 'Engagement'),
  ]

  if (isArtist) {
    children.push(
      totalsLine('Client payment for your work', money(payment.amount)),
      totalsLine(`Platform fee (${platformFeePercent}%)`, `−${money(platformFee)}`),
      totalsLine('Paid to you', money(displayAmount), { grand: true })
    )
  } else {
    children.push(
      totalsLine('Subtotal', money(payment.amount)),
      totalsLine(`Platform fee (${platformFeePercent}%, retained)`, money(platformFee)),
      totalsLine('Artist payout', money(artistPayout)),
      totalsLine('Total charged', money(payment.amount), { grand: true })
    )
  }

  children.push(
    new Paragraph({
      children: [muted(`Method: ${method} · Processed securely by Stripe. This is a financial record, not a tax form.`)],
      spacing: { before: 200, after: 120 },
    }),
    footerParagraph('The Callsheet · thecallsheet.ai')
  )

  return wrapDocument(`Receipt ${payment.id}`, children)
}

export async function downloadDocx(doc, filename) {
  const blob = await Packer.toBlob(doc)
  const name = filename.endsWith('.docx') ? filename : `${filename}.docx`
  triggerDownload(blob, name)
}

export async function downloadContractDocx(contract, filename, options = {}) {
  await downloadDocx(buildContractDocx(contract, options), filename)
}

export async function downloadInvoiceDocx(contract, filename, options = {}) {
  await downloadDocx(buildInvoiceDocx(contract, options), filename)
}

export async function downloadReceiptDocx(payment, filename, options = {}) {
  await downloadDocx(buildReceiptDocx(payment, options), filename)
}
