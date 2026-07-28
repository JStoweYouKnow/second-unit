/**
 * Stripe webhook idempotency ledger.
 *
 * Two things make duplicate delivery routine rather than exceptional:
 *   1. A Checkout session emits BOTH `checkout.session.completed` and
 *      `payment_intent.succeeded`, carrying the same booking/milestone metadata.
 *   2. Stripe retries any non-2xx response.
 *
 * Claiming is an INSERT on a primary key, so concurrent deliveries are settled by
 * the database rather than by a read-then-write race in application code.
 */

/** Postgres unique-violation, surfaced through PostgREST. */
function isDuplicateKey(error) {
  return (
    error?.code === '23505' ||
    /duplicate key|already exists|unique constraint/i.test(error?.message || '')
  )
}

/**
 * Try to claim an event for processing.
 * @returns {Promise<{ claimed: boolean }>} claimed=false means another delivery has it.
 */
export async function claimStripeEvent(db, event) {
  if (!db || !event?.id) return { claimed: true } // No ledger available — fall back to processing.

  const { error } = await db.from('stripe_webhook_events').insert({
    id: event.id,
    type: event.type,
    processed_at: new Date().toISOString(),
  })

  if (!error) return { claimed: true }
  if (isDuplicateKey(error)) return { claimed: false }

  // Ledger table missing (migration not yet run) must not block live payments —
  // process the event and let the write-side guards handle idempotency.
  console.warn('[stripeEvents] Could not claim event, processing anyway:', error.message)
  return { claimed: true }
}

/**
 * Release a claim so a Stripe retry can pick the event up again.
 * Only called when processing failed and we are returning a non-2xx.
 */
export async function releaseStripeEvent(db, eventId) {
  if (!db || !eventId) return
  const { error } = await db.from('stripe_webhook_events').delete().eq('id', eventId)
  if (error) {
    console.error('[stripeEvents] Failed to release event claim:', error.message)
  }
}
