/**
 * Edit a pending booking (client-only). Allows the hirer to fix details or
 * switch the assigned artist BEFORE anyone confirms/signs.
 *
 * Guards:
 *  - Only the employer who created the booking may edit it.
 *  - Booking must still be `pending`.
 *  - Switching the artist (or changing the fee) is refused if a linked contract
 *    has already been signed by either party.
 *  - The fee cannot be changed here once a contract exists (the contract/
 *    milestone schedule governs money) — date, type, duration, notes and the
 *    assigned artist can still change while unsigned.
 */
export async function updatePendingBooking(db, { id, userId, patch }) {
  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*, contract:contracts!contract_id(id, status, signed_by_employer, signed_by_artist)')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!booking) return { error: 'not_found' }
  if (booking.employer_id !== userId) return { error: 'forbidden' }
  if (booking.status !== 'pending') return { error: 'not_pending' }

  const contract = booking.contract || null
  const contractSigned = !!(contract && (contract.signed_by_employer || contract.signed_by_artist))

  const update = { updated_at: new Date().toISOString() }
  let contractUpdate = null

  // --- Assigned artist ---------------------------------------------------
  const switchingArtist =
    patch.artistId != null && String(patch.artistId) !== String(booking.artist_id)
  if (switchingArtist) {
    if (contractSigned) return { error: 'contract_signed' }
    const { data: artistRow, error: artistErr } = await db
      .from('artists')
      .select('id, display_name')
      .eq('id', patch.artistId)
      .maybeSingle()
    if (artistErr) throw new Error(artistErr.message)
    if (!artistRow) return { error: 'artist_not_found' }
    update.artist_id = artistRow.id
    update.artist_name = artistRow.display_name || booking.artist_name
    if (contract) {
      contractUpdate = {
        artist_id: artistRow.id,
        artist_name: artistRow.display_name || booking.artist_name,
      }
    }
  }

  // --- Simple fields (always editable while pending) ---------------------
  if (patch.date != null) update.date = patch.date
  if (patch.type != null) update.booking_type = patch.type
  if (patch.notes !== undefined) update.notes = patch.notes || null
  if (patch.durationUnit != null) update.duration_unit = patch.durationUnit
  if (patch.duration != null) {
    update.duration_hours = patch.durationUnit === 'project' ? 1 : Number(patch.duration) || 1
  }

  // --- Fee (blocked once a contract exists) ------------------------------
  if (patch.agreedTotal != null) {
    if (contract) return { error: 'fee_locked_by_contract' }
    const agreed = Math.round(Number(patch.agreedTotal))
    if (!Number.isFinite(agreed) || agreed < 1) return { error: 'invalid_fee' }
    const hours = Number(update.duration_hours ?? booking.duration_hours) || 1
    update.agreed_total = agreed
    update.rate = Math.max(Math.round(agreed / Math.max(hours, 1)), 1)
  }

  const { data: updated, error: updateError } = await db
    .from('bookings')
    .update(update)
    .eq('id', id)
    .select('*, contract:contracts!contract_id(id, title, status, signed_by_employer, signed_by_artist)')
    .single()

  if (updateError) throw new Error(updateError.message)

  if (contractUpdate) {
    await db.from('contracts').update(contractUpdate).eq('id', contract.id)
  }

  return { booking: updated }
}
