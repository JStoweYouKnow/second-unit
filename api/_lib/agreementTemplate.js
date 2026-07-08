/**
 * Platform standard independent contractor agreement.
 * Used when a project is created without an imported/custom agreement file.
 */
export const STANDARD_AGREEMENT_TEMPLATE = `INDEPENDENT CONTRACTOR AGREEMENT

This Agreement ("Agreement") is entered into as of the Start Date specified below.

1. SCOPE OF WORK
The Artist agrees to provide the creative services described in this contract, including all deliverables outlined at the time of booking.

2. COMPENSATION & PAYMENT
• Payment shall be made according to the following milestone schedule:
  - 33% upon contract execution
  - 33% upon delivery of first draft/proof
  - 34% upon final approval and delivery
• All payments processed through The Callsheet's platform via Stripe.
• Late payments are subject to a 1.5% monthly interest charge.

3. INTELLECTUAL PROPERTY
• All IP rights transfer to the Client upon receipt of full payment.
• Artist retains the right to display the work in their portfolio.
• Client grants Artist permission to use work samples for promotional purposes unless otherwise specified.

4. REVISIONS
• Two (2) rounds of revisions are included in the base fee.
• Additional revision rounds billed at the Artist's standard hourly rate.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information shared during the engagement. This obligation survives termination of this Agreement.

6. CANCELLATION POLICY
• Either party may terminate with 14 days written notice.
• If Client cancels after work has begun, Client pays for all completed work.
• If Artist cancels, all payments for undelivered work shall be refunded.

7. LIABILITY
• Artist's total liability shall not exceed the total contract value.
• Neither party shall be liable for indirect, incidental, or consequential damages.

8. DISPUTE RESOLUTION
Any disputes shall first be addressed through mediation. If mediation fails, disputes shall be resolved through binding arbitration.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the state specified by the Client.

10. ENTIRE AGREEMENT
This document constitutes the entire agreement between the parties and supersedes all prior negotiations and agreements.`

/**
 * Build agreement terms for a new project.
 * Prefers an imported/custom body; otherwise uses the standard template.
 * Optional booking notes are appended under the template when no custom body exists.
 */
export function buildAgreementTerms({
  importedTerms = null,
  bookingNotes = null,
  hasAttachment = false,
} = {}) {
  const custom = typeof importedTerms === 'string' ? importedTerms.trim() : ''
  if (custom) return custom

  if (hasAttachment) {
    return `${STANDARD_AGREEMENT_TEMPLATE}\n\n---\n\n[A custom agreement file is attached to this project. Download the original file from the project record.]`
  }

  const notes = typeof bookingNotes === 'string' ? bookingNotes.trim() : ''
  if (notes) {
    return `${STANDARD_AGREEMENT_TEMPLATE}\n\n---\n\nBooking notes from hirer:\n${notes}`
  }

  return STANDARD_AGREEMENT_TEMPLATE
}
