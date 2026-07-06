/**
 * Validate an artist invite token via Supabase (server-side).
 * Uses the security-definer RPC so the anon key is sufficient.
 */
export async function validateInviteToken(db, token) {
  const trimmed = (token || '').trim()
  if (!trimmed) {
    return { valid: false, reason: 'missing' }
  }

  if (!db) {
    return { valid: false, reason: 'invalid', errorMessage: 'Database not configured' }
  }

  const { data, error } = await db.rpc('validate_artist_invite', { p_token: trimmed })

  if (!error && data) {
    return data
  }

  if (error) {
    console.error('validate_artist_invite (server):', error.message)
  }

  // Fallback: service-role clients can read the table directly if RPC is missing
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your-service-role-key-here') {
    const { data: row, error: rowError } = await db
      .from('artist_invites')
      .select('id, artist_name, email, expires_at, used_at')
      .eq('token', trimmed)
      .maybeSingle()

    if (!rowError && row) {
      if (row.used_at) return { valid: false, reason: 'used' }
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return { valid: false, reason: 'expired' }
      }
      return {
        valid: true,
        reason: null,
        artist_name: row.artist_name,
        email: row.email,
        invite_id: row.id,
      }
    }
  }

  if (error) {
    return { valid: false, reason: 'invalid', errorMessage: error.message }
  }

  return { valid: false, reason: 'invalid' }
}
