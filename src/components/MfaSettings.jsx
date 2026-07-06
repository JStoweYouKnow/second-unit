import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function MfaSettings() {
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [factorId, setFactorId] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadFactors = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setFactors(data?.totp || [])
    } catch (err) {
      setMessage(err.message || 'Could not load 2FA status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  const handleStartEnroll = async () => {
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp?.qr_code || '')
      setEnrolling(true)
    } catch (err) {
      setMessage(err.message || 'Enrollment failed — enable MFA in Supabase Auth settings')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyEnroll = async () => {
    if (!supabase || !factorId || !verifyCode.trim()) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode.trim(),
      })
      if (error) throw error
      setEnrolling(false)
      setVerifyCode('')
      setQrCode('')
      setFactorId(null)
      setMessage('Two-factor authentication enabled.')
      await loadFactors()
    } catch (err) {
      setMessage(err.message || 'Invalid code — try again')
    } finally {
      setBusy(false)
    }
  }

  const handleUnenroll = async () => {
    if (!supabase || !verifiedFactor) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id })
      if (error) throw error
      setMessage('Two-factor authentication disabled.')
      await loadFactors()
    } catch (err) {
      setMessage(err.message || 'Could not disable 2FA')
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
        Two-factor authentication requires Supabase auth.
      </p>
    )
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Loading 2FA status…</p>
  }

  return (
    <div>
      {verifiedFactor ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>2FA is enabled</div>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
              Your account requires an authenticator code at sign-in.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleUnenroll} disabled={busy}>
            Disable 2FA
          </button>
        </div>
      ) : enrolling ? (
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Scan this QR code with Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
          </p>
          {qrCode && (
            <img
              src={qrCode}
              alt="TOTP QR code"
              style={{ width: 180, height: 180, marginBottom: 16, borderRadius: 8, background: '#fff' }}
            />
          )}
          <div className="form-group">
            <input
              className="form-input"
              placeholder="123456"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleVerifyEnroll} disabled={busy || verifyCode.length < 6}>
              Verify & enable
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEnrolling(false); setVerifyCode('') }} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
            Add an extra layer of security with an authenticator app.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleStartEnroll} disabled={busy}>
            Enable 2FA
          </button>
        </div>
      )}
      {message && (
        <p style={{ fontSize: 13, marginTop: 12, color: message.includes('enabled') || message.includes('disabled') ? 'var(--success)' : 'var(--danger)' }}>
          {message}
        </p>
      )}
    </div>
  )
}
