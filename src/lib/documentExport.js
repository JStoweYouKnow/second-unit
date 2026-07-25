/**
 * Zero-dependency contract & invoice export.
 *
 * PDF  — open a print-ready window and invoke the browser's print dialog,
 *        where the user picks "Save as PDF" (works in every browser, no libs).
 * Word — a Blob of styled HTML with the Word MIME type; .doc files that are
 *        HTML open natively in Microsoft Word / Google Docs / Pages.
 *
 * Both consume the same HTML built here, so the contract/invoice look identical
 * regardless of the chosen format.
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`
}

function fmtDate(d) {
  if (!d) return '—'
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return String(d)
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const PAGE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 48px; line-height: 1.55; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 28px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .brand { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #888; }
  .muted { color: #666; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; border-bottom: 1px solid #ddd; padding: 8px 6px; }
  td { padding: 10px 6px; border-bottom: 1px solid #f0f0f0; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 12px; margin-left: auto; width: 320px; }
  .totals .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 16px; }
  .terms { white-space: pre-wrap; font-size: 12.5px; color: #333; background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 16px; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 12px; }
  .sig .box { border: 1px solid #ddd; border-radius: 6px; padding: 16px; min-height: 90px; }
  .sig .name { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 22px; color: #111; }
  .pill { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 20px; background: #eee; color: #444; }
  .footer { margin-top: 36px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 24px; } }
`

function docShell(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body>${inner}</body></html>`
}

export function buildContractHtml(contract, { clientName } = {}) {
  const client = clientName || contract.clientName || 'Client'
  const empSig = contract.employerSignature
  const artSig = contract.artistSignature
  const inner = `
    <div class="brand">The Callsheet — Agreement</div>
    <h1>${esc(contract.title || 'Project Agreement')}</h1>
    <div class="muted">Contract ID: ${esc(contract.id)} · <span class="pill">${contract.type === 'custom' ? 'Custom' : 'Standard'} agreement</span> · Status: ${esc(contract.status || 'pending')}</div>

    <h2>Parties</h2>
    <div class="grid">
      <div><strong>Client</strong><br>${esc(client)}</div>
      <div><strong>Artist</strong><br>${esc(contract.artistName || '')}</div>
    </div>

    <h2>Term &amp; value</h2>
    <div class="grid">
      <div><strong>Period</strong><br>${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}</div>
      <div><strong>Total value</strong><br>${money(contract.value)}</div>
    </div>

    <h2>Terms &amp; conditions</h2>
    <div class="terms">${esc(contract.terms || 'Standard platform agreement.')}</div>
    ${contract.attachmentName ? `<p class="muted" style="margin-top:10px">Attached file: <strong>${esc(contract.attachmentName)}</strong> (download from the contract record in The Callsheet).</p>` : ''}

    <h2>Signatures</h2>
    <div class="sig">
      <div class="box">
        <div class="muted" style="font-size:12px">Client</div>
        ${empSig ? `<div class="name">${esc(empSig.name)}</div><div class="muted" style="font-size:12px">Signed ${fmtDate(empSig.date)} · typed e-sign${empSig.documentHash ? ` · hash ${esc(String(empSig.documentHash).slice(0, 16))}…` : ''}</div>` : '<div class="muted">Awaiting signature</div>'}
      </div>
      <div class="box">
        <div class="muted" style="font-size:12px">Artist</div>
        ${artSig ? `<div class="name">${esc(artSig.name)}</div><div class="muted" style="font-size:12px">Signed ${fmtDate(artSig.date)} · typed e-sign${artSig.documentHash ? ` · hash ${esc(String(artSig.documentHash).slice(0, 16))}…` : ''}</div>` : '<div class="muted">Awaiting signature</div>'}
      </div>
    </div>

    <div class="footer">Generated and managed through The Callsheet · thecallsheet.ai</div>
  `
  return docShell(`${contract.title || 'Contract'} — Agreement`, inner)
}

/**
 * A real invoice: the artist bills the client. Line items come from the
 * milestone schedule (falling back to a 33/33/34 split), with the platform
 * fee and paid/outstanding balance computed from live payment rows.
 */
export function buildInvoiceHtml(contract, { clientName, payments = [], platformFeePercent = 15 } = {}) {
  const client = clientName || contract.clientName || 'Client'
  const value = Number(contract.value || 0)

  let items = Array.isArray(contract.milestones) && contract.milestones.length
    ? contract.milestones.map((m, i) => ({
        title: m.title || `Milestone ${i + 1}`,
        amount: Number(m.amount || 0),
        status: m.status || 'pending',
      }))
    : null

  if (!items) {
    const third = Math.round(value / 3)
    items = [
      { title: 'On execution', amount: third, status: 'pending' },
      { title: 'First draft / proof', amount: third, status: 'pending' },
      { title: 'Final delivery', amount: value - third * 2, status: 'pending' },
    ]
  }

  const subtotal = items.reduce((s, it) => s + it.amount, 0) || value
  const paid = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  const outstanding = Math.max(subtotal - paid, 0)
  const invoiceNo = `INV-${String(contract.id).slice(0, 8).toUpperCase()}`

  const rows = items
    .map(
      (it) => `<tr>
        <td>${esc(it.title)}</td>
        <td><span class="pill">${esc(it.status)}</span></td>
        <td class="num">${money(it.amount)}</td>
      </tr>`
    )
    .join('')

  const inner = `
    <div class="row">
      <div>
        <div class="brand">The Callsheet</div>
        <h1>Invoice</h1>
        <div class="muted">${esc(invoiceNo)} · Issued ${fmtDate(new Date())}</div>
      </div>
      <div style="text-align:right">
        <div class="muted" style="font-size:12px">Project</div>
        <div><strong>${esc(contract.title || '')}</strong></div>
        <div class="muted" style="font-size:12px">${esc(String(contract.id))}</div>
      </div>
    </div>

    <div class="grid">
      <div><strong>From (Artist)</strong><br>${esc(contract.artistName || '')}</div>
      <div><strong>Bill to (Client)</strong><br>${esc(client)}</div>
    </div>

    <h2>Line items</h2>
    <table>
      <thead><tr><th>Description</th><th>Status</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="line"><span class="muted">Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="line"><span class="muted">Platform fee (${platformFeePercent}%, collected at payment)</span><span>${money(Math.round(subtotal * (platformFeePercent / 100)))}</span></div>
      <div class="line"><span class="muted">Paid to date</span><span>−${money(paid)}</span></div>
      <div class="line grand"><span>Amount due</span><span>${money(outstanding)}</span></div>
    </div>

    <p class="muted" style="margin-top:24px; font-size:12px">
      Payments are processed through The Callsheet milestone escrow. The artist's share (${100 - platformFeePercent}%) is released as each milestone is approved. This document is a financial summary, not a tax form.
    </p>

    <div class="footer">The Callsheet · thecallsheet.ai</div>
  `
  return docShell(`${invoiceNo} — Invoice`, inner)
}

/** Download styled HTML as a Word-openable .doc file. */
export function downloadWordDoc(html, filename) {
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

/** Open a print-ready window and trigger the print dialog (user saves as PDF). */
export function openPrintablePdf(html, title = 'Document') {
  const win = window.open('', '_blank', 'noopener,width=900,height=1100')
  if (!win) {
    // Popup blocked — fall back to a same-tab data document.
    const blob = new Blob([html], { type: 'text/html' })
    window.location.href = URL.createObjectURL(blob)
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.title = title
  win.document.close()
  // Give the browser a tick to lay out before printing.
  win.onload = () => setTimeout(() => win.print(), 250)
}
