import { useState, useEffect } from 'react'
import {
  CreditCard, CheckCircle, Clock, ArrowUpRight, DollarSign, TrendingUp,
  Download, X, Search, ArrowDownRight, Receipt, Shield, FileText,
  Mail, Lock, ChevronRight, UserPlus, ExternalLink, Loader2,
} from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { usePayments } from '../hooks/usePayments'
import { demoArtistPersona } from '../lib/roleView'
import { stripeConnect, payments as paymentsApi, adminApi } from '../lib/api'
import {
  PLATFORM_FEE_PERCENT,
  platformFeeAmount,
  artistEarningsAmount,
  artistReleasedAmount,
  artistEscrowAmount,
  paymentDisplayAmount,
} from '../lib/fees'

function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ─── Hirer Setup Modal ──────────────────────────────────────────────────────

function SetupModal({ profile, onClose, onDone }) {
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ name: profile?.full_name || '', email: '' })
  const canSubmit = form.name.trim() && /\S+@\S+\.\S+/.test(form.email)

  function handleActivate() {
    onDone({ name: form.name, email: form.email })
    setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={done ? onClose : undefined}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{done ? 'Payments activated' : 'Set up payments'}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {!done ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              Confirm your details to enable milestone payments. Card details are collected by Stripe at checkout — The Callsheet never stores them.
            </p>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-input" placeholder="Your name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Billing email</label>
              <input className="form-input" type="email" placeholder="you@company.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Shield size={14} style={{ color: 'var(--success)', marginTop: 1, flexShrink: 0 }} />
              <span>Only your card is charged via Stripe Checkout. Funds are held in escrow; the artist is paid after you approve each milestone. The {PLATFORM_FEE_PERCENT}% platform fee is retained by The Callsheet.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!canSubmit}
                style={{ opacity: canSubmit ? 1 : 0.5 }}
                onClick={handleActivate}>
                <CreditCard size={16} /> Activate payments
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>You're all set</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Payments are enabled for <strong>{form.email}</strong>.<br />
              You'll enter card details on Stripe's secure page at each checkout.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Artist Connect Modal ────────────────────────────────────────────────────

function ConnectModal({ userEmail, artistId, onClose, ensureArtistId, allowMissingArtist }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canSubmit = form.firstName.trim() && form.lastName.trim()

  async function handleConnect() {
    setBusy(true)
    setError(null)
    try {
      let resolvedArtistId = artistId
      if (!resolvedArtistId && ensureArtistId) {
        resolvedArtistId = await ensureArtistId()
      }
      if (!resolvedArtistId) {
        throw new Error('Artist profile not found. Complete your profile before connecting payouts.')
      }

      const { accountId } = await stripeConnect.createAccount(userEmail, resolvedArtistId)
      if (!accountId) throw new Error('Stripe did not return a Connect account id')

      const { url } = await stripeConnect.getOnboardingLink(accountId)
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        throw new Error('Stripe did not return a valid onboarding URL')
      }

      saveLS('su_connect_pending_v1', {
        accountId,
        firstName: form.firstName,
        lastName: form.lastName,
      })
      window.location.assign(url)
    } catch (err) {
      console.error('[ConnectModal]', err)
      setError(err.message || 'Could not start Stripe Connect. Check that Stripe is configured and Connect is enabled.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Set up payouts</h2>
          <button type="button" className="btn-icon" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>

        <div style={{ padding: '14px 16px', background: 'var(--accent-tint-05)', border: '1px solid var(--accent-tint-border)', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Mail size={16} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Connect via Stripe</strong>
            <span style={{ color: 'var(--text-muted)' }}>You'll be taken to Stripe to verify your identity and add a bank account for payouts.</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">First name</label>
            <input className="form-input" placeholder="First" value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} disabled={busy} />
          </div>
          <div className="form-group">
            <label className="form-label">Last name</label>
            <input className="form-input" placeholder="Last" value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} disabled={busy} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="date" value={form.dob}
            onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} disabled={busy} />
        </div>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, lineHeight: 1.4 }}>{error}</p>
        )}
        {!artistId && !allowMissingArtist && (
          <p style={{ fontSize: 13, color: 'var(--warning)', marginBottom: 12 }}>
            No artist profile is linked to this login. Sign in as an approved artist (or finish application approval) before connecting payouts.
          </p>
        )}
        <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
          <Lock size={14} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
          <span>Stripe handles identity verification and sends payouts to your connected bank account when clients pay.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!canSubmit || busy}
            style={{ opacity: canSubmit && !busy ? 1 : 0.5 }}
            onClick={handleConnect}>
            {busy
              ? <><Loader2 size={16} className="animate-spin" /> Connecting…</>
              : <><ExternalLink size={16} /> Continue to Stripe</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Payments() {
  const { profile, user, isAuthenticated, effectiveRole, isAdmin, adminViewAs } = useAuth()
  const { artist: myArtistRecord, refetch: refetchArtist } = useArtistProfile(profile?.id)
  // Same rule as Dashboard / App nav: admin "View as" drives the UI via effectiveRole.
  const isArtist = effectiveRole === 'artist'
  const isAdminArtistTest = isAdmin && adminViewAs === 'artist'
  const me = demoArtistPersona(
    isArtist ? { ...profile, role: 'artist' } : profile,
    myArtistRecord
  )
  const { payments: paymentPool, loading: paymentsLoading, error: paymentsError, refetch: refetchPayments } = usePayments(isAuthenticated)

  const [stripeStatus, setStripeStatus] = useState(() => loadLS('su_stripe_v1'))
  const [connectLive, setConnectLive] = useState(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const [connectBusy, setConnectBusy] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const refreshConnectStatus = async () => {
    if (!isArtist) return
    setConnectLoading(true)
    setConnectError(null)
    try {
      const status = await stripeConnect.getStatus(myArtistRecord?.stripeAccountId)
      setConnectLive(status)
      if (status?.accountId) {
        saveLS('su_connect_v1', {
          accountId: status.accountId,
          bankLast4: status.bankLast4 || '····',
          status: status.status,
          payoutsEnabled: status.payoutsEnabled,
        })
      }
    } catch (err) {
      setConnectError(err.message || 'Could not verify payout account status')
      // Fall back to DB id only — never claim "ready" without Stripe confirmation.
      if (myArtistRecord?.stripeAccountId) {
        setConnectLive({
          connected: true,
          accountId: myArtistRecord.stripeAccountId,
          detailsSubmitted: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          requirementsDue: [],
          bankLast4: null,
          status: 'incomplete',
          message: 'Could not reach Stripe — finish or re-check onboarding.',
        })
      } else {
        setConnectLive({
          connected: false,
          accountId: null,
          status: 'not_connected',
          payoutsEnabled: false,
          detailsSubmitted: false,
          chargesEnabled: false,
          requirementsDue: [],
          bankLast4: null,
          message: 'Payout account not connected yet.',
        })
      }
    } finally {
      setConnectLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isArtist) {
      setConnectLive(null)
      setConnectError(null)
      setConnectLoading(false)
      return
    }
    refreshConnectStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isArtist, myArtistRecord?.id, myArtistRecord?.stripeAccountId])

  const [showSetup, setShowSetup] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [showStripe, setShowStripe] = useState(false)
  const [showReceipt, setShowReceipt] = useState(null)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_success') || params.get('stripe_refresh')) {
      saveLS('su_connect_pending_v1', null)
      refetchPayments()
      refetchArtist?.()
      refreshConnectStatus()
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchPayments])

  const resumeOnboarding = async () => {
    setConnectBusy(true)
    setConnectError(null)
    try {
      let accountId = connectLive?.accountId || myArtistRecord?.stripeAccountId
      let artistId = myArtistRecord?.id
      if (!artistId && isAdminArtistTest) {
        const { artist } = await adminApi.ensureArtistPersona()
        artistId = artist?.id
        await refetchArtist?.()
      }
      if (!accountId) {
        if (!artistId) {
          throw new Error('No artist profile linked to this account. Sign in as an approved artist to connect payouts.')
        }
        const created = await stripeConnect.createAccount(
          user?.email || profile?.email || '',
          artistId
        )
        accountId = created?.accountId
        await refetchArtist?.()
      }
      if (!accountId) throw new Error('Could not create or find a Stripe Connect account')

      const { url } = await stripeConnect.getOnboardingLink(accountId)
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        throw new Error('Stripe did not return a valid onboarding URL')
      }
      window.location.assign(url)
    } catch (err) {
      setConnectError(err.message || 'Could not open Stripe onboarding')
      setConnectBusy(false)
    }
  }

  // Prefer live Stripe status; while loading, still show a clear card from DB.
  const connectState =
    connectLive?.status ||
    (connectLoading
      ? 'checking'
      : myArtistRecord?.stripeAccountId
        ? 'incomplete'
        : 'not_connected')
  const connectReady = connectState === 'ready' && !!connectLive?.payoutsEnabled
  const connectIncomplete = connectState === 'incomplete' || connectState === 'restricted'
  const showArtistConnectCard = isArtist
  // Hirer checkout banner only in hirer/admin view — never while View as Artist.
  const showHirerPayBanner = !isArtist && !!stripeStatus
  const showHirerSetupBanner = !isArtist && !stripeStatus

  const filteredPayments = paymentPool.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.description.toLowerCase().includes(search.toLowerCase()) && !p.artistName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const sumAmount = (payments) =>
    payments.reduce((s, p) => s + paymentDisplayAmount(p, isArtist), 0)

  const paidPayments = paymentPool.filter((p) => p.status === 'paid')
  const releasedTotal = isArtist
    ? paidPayments.reduce((s, p) => s + artistReleasedAmount(p), 0)
    : sumAmount(paidPayments)
  const escrowTotal = isArtist
    ? paidPayments.reduce((s, p) => s + artistEscrowAmount(p), 0)
    : 0
  const pending = isArtist
    ? escrowTotal
    : sumAmount(paymentPool.filter((p) => p.status === 'pending' || p.status === 'upcoming'))
  const total = releasedTotal
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const thisMonth = isArtist
    ? paidPayments
        .filter((p) => p.date?.startsWith(monthPrefix) && p.payoutStatus === 'paid' && p.transferId)
        .reduce((s, p) => s + artistReleasedAmount(p), 0)
    : sumAmount(paidPayments.filter((p) => p.date?.startsWith(monthPrefix)))
  const platformFees = platformFeeAmount(
    paidPayments.reduce((s, p) => s + p.amount, 0),
  )
  const paidCount = isArtist
    ? paidPayments.filter((p) => (p.payoutStatus === 'paid' && p.transferId) || p.payoutStatus == null).length
    : paidPayments.length
  const escrowCount = paidPayments.filter(
    (p) => p.payoutStatus === 'pending' || (p.payoutStatus === 'paid' && !p.transferId)
  ).length

  const statusStyles = {
    paid: { bg: 'var(--success-muted-bg)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Paid' },
    pending: { bg: 'rgba(245,197,66,0.1)', color: 'var(--warning)', icon: <Clock size={14} />, label: 'Pending' },
    upcoming: { bg: 'var(--accent-tint-10)', color: 'var(--accent)', icon: <Clock size={14} />, label: 'Scheduled' },
    refunded: { bg: 'rgba(255,77,106,0.1)', color: 'var(--danger)', icon: <ArrowDownRight size={14} />, label: 'Refunded' },
    escrow: { bg: 'rgba(245,197,66,0.1)', color: 'var(--warning)', icon: <Clock size={14} />, label: 'In escrow' },
    released: { bg: 'var(--success-muted-bg)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Released' },
  }

  function paymentRowStatus(p) {
    if (!isArtist) return statusStyles[p.status] || statusStyles.pending
    if (p.status !== 'paid') return statusStyles[p.status] || statusStyles.pending
    // Real release requires a Stripe transfer id.
    if (p.payoutStatus === 'paid' && p.transferId) return statusStyles.released
    if (p.payoutStatus === 'pending' || (p.payoutStatus === 'paid' && !p.transferId)) {
      return statusStyles.escrow
    }
    if (p.payoutStatus == null) return statusStyles.released
    return statusStyles[p.status] || statusStyles.pending
  }

  const handleDownloadReceipt = (payment) => {
    const displayAmount = paymentDisplayAmount(payment, isArtist)
    const content = isArtist
      ? `
═══════════════════════════════════════
         THE CALLSHEET — RECEIPT
═══════════════════════════════════════

Receipt #: ${payment.id}
Date: ${payment.date}
Status: ${payment.status.toUpperCase()}

───────────────────────────────────────
PAYOUT DETAILS
───────────────────────────────────────

Description: ${payment.description}
Client payment for your work

Amount paid to you: $${displayAmount.toLocaleString()}

Settlement: processed via Stripe Connect on The Callsheet

═══════════════════════════════════════
Thank you for using The Callsheet!
https://thecallsheet.ai
═══════════════════════════════════════
`
      : `
═══════════════════════════════════════
         THE CALLSHEET — RECEIPT
═══════════════════════════════════════

Receipt #: ${payment.id}
Date: ${payment.date}
Status: ${payment.status.toUpperCase()}

───────────────────────────────────────
PAYMENT DETAILS
───────────────────────────────────────

Description: ${payment.description}
Artist: ${payment.artistName}

Subtotal:      $${payment.amount.toLocaleString()}
Platform Fee:  $${platformFeeAmount(payment.amount).toLocaleString()} (${PLATFORM_FEE_PERCENT}% — retained by platform)
Artist Payout: $${artistEarningsAmount(payment).toLocaleString()}
───────────────────────────────────────
Total Charged: $${payment.amount.toLocaleString()}

Payment Method: Stripe${stripeStatus?.email ? ` · ${stripeStatus.email}` : ''}
Processed by: Stripe

═══════════════════════════════════════
Thank you for using The Callsheet!
https://thecallsheet.ai
═══════════════════════════════════════
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Receipt_${payment.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadInvoice = (payment) => {
    const viewer = profile?.full_name || (isArtist ? 'Artist' : 'Client')
    const displayAmount = paymentDisplayAmount(payment, isArtist)
    const content = isArtist
      ? `
═══════════════════════════════════════
         THE CALLSHEET — INVOICE
═══════════════════════════════════════

Invoice #: INV-${payment.id}
Issue date: ${payment.date}
Status: ${String(payment.status).toUpperCase()}

Record for: ${viewer}
Artist copy — payout record on The Callsheet.

───────────────────────────────────────
LINE ITEMS
───────────────────────────────────────

${payment.description}

  Payout amount                         $${displayAmount.toLocaleString()}
───────────────────────────────────────
  Total paid to you                     $${displayAmount.toLocaleString()}

Payment reference: ${payment.id}
Settlement: processed via Stripe Connect on The Callsheet

═══════════════════════════════════════
https://thecallsheet.ai
═══════════════════════════════════════
`
      : (() => {
        const platformFee = platformFeeAmount(payment.amount)
        const artistShare = artistEarningsAmount(payment)
        const tot = payment.amount
        return `
═══════════════════════════════════════
         THE CALLSHEET — INVOICE
═══════════════════════════════════════

Invoice #: INV-${payment.id}
Issue date: ${payment.date}
Status: ${String(payment.status).toUpperCase()}

Bill to / Record for: ${viewer}
Client copy — amounts shown reflect your payment record on The Callsheet.

───────────────────────────────────────
LINE ITEMS
───────────────────────────────────────

${payment.description}
Service provider (artist): ${payment.artistName}

  Line subtotal                         $${payment.amount.toLocaleString()}
  Platform fee (${PLATFORM_FEE_PERCENT}%, retained by platform)  $${platformFee.toLocaleString()}
  Artist net payout                     $${artistShare.toLocaleString()}
───────────────────────────────────────
  Total paid by client                  $${tot.toLocaleString()}

Payment reference: ${payment.id}
Settlement: processed via Stripe on The Callsheet

═══════════════════════════════════════
https://thecallsheet.ai
═══════════════════════════════════════
`
      })()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Invoice_${payment.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{isArtist ? 'Earnings' : 'Payments'}</h1>
            <p>
              {isArtist
                ? (isAdminArtistTest
                  ? 'Admin test artist — connect Stripe, then switch to Hirer to fund a milestone and back here to confirm release'
                  : 'Payouts and milestones for your work')
                : 'Track payments powered by Stripe'}
            </p>
          </div>
          {!isArtist && !stripeStatus && (
            <button type="button" className="btn btn-primary" onClick={() => setShowSetup(true)}>
              <CreditCard size={16} /> Set up payments
            </button>
          )}
          {isArtist && !connectReady && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (connectIncomplete ? resumeOnboarding() : setShowConnect(true))}
              disabled={connectBusy || connectLoading}
            >
              {connectBusy || connectLoading
                ? <><Loader2 size={16} className="animate-spin" /> Checking…</>
                : connectIncomplete
                  ? <><ExternalLink size={16} /> Finish payout setup</>
                  : <><UserPlus size={16} /> Connect payout account</>}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-label"><DollarSign size={14} /> {isArtist ? 'Released to you' : 'Total paid'}</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>${total.toLocaleString()}</span>
          <span className="stat-change"><ArrowUpRight size={12} /> {paidCount} {isArtist ? 'payouts' : 'payments'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Clock size={14} /> {isArtist ? 'In escrow' : 'Outstanding'}</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>${pending.toLocaleString()}</span>
          <span className="stat-change">
            {isArtist
              ? `${escrowCount} awaiting client approval`
              : `${paymentPool.filter(p => p.status !== 'paid').length} pending`}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><TrendingUp size={14} /> This month</span>
          <span className="stat-value">${thisMonth.toLocaleString()}</span>
        </div>
        {isArtist ? (
          <div className="stat-card">
            <span className="stat-label"><CheckCircle size={14} /> Completed</span>
            <span className="stat-value">{paidCount}</span>
            <span className="stat-change">Released milestones &amp; bookings</span>
          </div>
        ) : (
          <div className="stat-card">
            <span className="stat-label"><Receipt size={14} /> Platform fees</span>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>${platformFees.toLocaleString()}</span>
            <span className="stat-change">{PLATFORM_FEE_PERCENT}% facilitation fee</span>
          </div>
        )}
      </div>

      {isAdminArtistTest && (
        <div style={{ marginBottom: 24, padding: '14px 18px', background: 'var(--accent-tint-05)', border: '1px solid var(--accent-tint-border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>Admin payment test loop</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>Connect Stripe below (Continue to Stripe) until status is <em>Ready for payouts</em>.</li>
            <li>Switch View as → <strong>Hirer</strong>, create a Project (or Booking) selecting your test artist, pay a milestone.</li>
            <li>Switch View as → <strong>Artist</strong>, confirm the booking if needed, then after client approval check Released vs In escrow here.</li>
          </ol>
          {myArtistRecord?.id && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Test artist id: {myArtistRecord.id}
              {myArtistRecord.displayName ? ` · ${myArtistRecord.displayName}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Stripe status banner */}
      {showHirerSetupBanner && (
        <div style={{ marginBottom: 24, padding: '20px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--accent-tint-10)' }}>
              <CreditCard size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>Set up Stripe to pay artists</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add a payment method to send milestone payments. Secure card and bank transfers via Stripe.</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowSetup(true)}>
            Get started <ChevronRight size={16} />
          </button>
        </div>
      )}

      {showHirerPayBanner && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, var(--success-muted-bg), var(--accent-tint-05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--success-muted-bg)' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Ready to pay artists</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {stripeStatus.email} · you pay at checkout (this is not artist payout setup) · {PLATFORM_FEE_PERCENT}% platform fee
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSetup(true)}>
            Manage
          </button>
        </div>
      )}

      {showArtistConnectCard && (connectLoading || connectState === 'checking') && !connectLive && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Checking Stripe Connect payout status…</div>
        </div>
      )}

      {showArtistConnectCard && connectError && (
        <div className="auth-error" style={{ marginBottom: 16 }}>{connectError}</div>
      )}

      {showArtistConnectCard && connectState === 'not_connected' && (
        <div style={{ marginBottom: 24, padding: '20px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--accent-tint-10)' }}>
              <Mail size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>Payout account not connected</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Connect Stripe to receive released earnings in your bank. Escrowed payments cannot be paid out until this is done.
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowConnect(true)}>
            Connect Stripe <ChevronRight size={16} />
          </button>
        </div>
      )}

      {showArtistConnectCard && connectIncomplete && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.35)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'rgba(245,197,66,0.15)' }}>
              <Clock size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {connectState === 'restricted' ? 'Payouts not enabled yet' : 'Finish Stripe Connect setup'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {connectLive?.message || 'Your Stripe account exists, but onboarding is incomplete.'}
                {connectLive?.accountId ? ` · ID: ${connectLive.accountId}` : myArtistRecord?.stripeAccountId ? ` · ID: ${myArtistRecord.stripeAccountId}` : ''}
                {connectLive?.requirementsDue?.length
                  ? ` · ${connectLive.requirementsDue.length} item(s) still required`
                  : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={refreshConnectStatus} disabled={connectLoading}>
              {connectLoading ? <Loader2 size={14} className="animate-spin" /> : 'Refresh'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={resumeOnboarding} disabled={connectBusy}>
              {connectBusy ? <Loader2 size={14} className="animate-spin" /> : <><ExternalLink size={14} /> Continue setup</>}
            </button>
          </div>
        </div>
      )}

      {showArtistConnectCard && connectReady && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, var(--success-muted-bg), var(--accent-tint-05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--success-muted-bg)' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Ready for payouts</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Stripe Connect verified · payouts enabled
                {connectLive?.bankLast4 ? ` · bank ···· ${connectLive.bankLast4}` : ''}
                {' · '}transfers after milestone approval · ID: {connectLive.accountId}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={refreshConnectStatus} disabled={connectLoading}>
              {connectLoading ? <Loader2 size={14} className="animate-spin" /> : 'Refresh status'}
            </button>
            <a href="https://connect.stripe.com/express_login" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <ArrowUpRight size={14} /> Stripe Express
            </a>
          </div>
        </div>
      )}

      {paymentsError && (
        <div className="auth-error" style={{ marginBottom: 20 }}>{paymentsError}</div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder={isArtist ? 'Search payouts…' : 'Search payments…'} value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'all', label: 'All' },
            { value: 'paid', label: 'Paid' },
            { value: 'pending', label: 'Pending' },
            { value: 'upcoming', label: 'Scheduled' },
          ].map(f => (
            <button key={f.value}
              className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1fr 1fr 1fr minmax(200px, auto)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          <span>Description</span>
          <span>{isArtist ? 'Payee' : 'Artist'}</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'center' }}>Receipt · Invoice</span>
        </div>

        {paymentsLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p>Loading payments…</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            {paymentPool.length === 0
              ? (isArtist
                ? 'No earnings yet. You’ll see escrowed and released payouts here after clients fund milestones.'
                : 'No payments yet. Complete a booking or milestone checkout to see records here.')
              : 'No payments match your filters.'}
          </div>
        ) : (
          filteredPayments.map(p => {
            const s = paymentRowStatus(p)
            return (
              <div key={p.id} className="slide-up" style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1fr 1fr 1fr minmax(200px, auto)',
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                alignItems: 'center', transition: 'var(--transition)',
                cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setShowReceipt(p)}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {p.id}</div>
                </div>
                <span style={{ fontSize: 14 }}>{isArtist ? me?.name ?? p.artistName : p.artistName}</span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{p.date}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                  ${paymentDisplayAmount(p, isArtist).toLocaleString()}
                </span>
                <div
                  style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}
                  onClick={e => e.stopPropagation()}
                  role="presentation"
                >
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.icon} {s.label}
                  </span>
                  <button type="button" className="btn-icon" title="Download receipt" onClick={() => handleDownloadReceipt(p)}>
                    <Receipt size={16} />
                  </button>
                  <button type="button" className="btn-icon" title="Download invoice" onClick={() => handleDownloadInvoice(p)}>
                    <FileText size={16} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Receipt modal ───────────────────────────────────────────── */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receipt &amp; invoice</h2>
              <button type="button" className="btn-icon" onClick={() => setShowReceipt(null)}><X size={18} /></button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 4 }}>
                ${paymentDisplayAmount(showReceipt, isArtist).toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{showReceipt.description}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: statusStyles[showReceipt.status]?.bg, color: statusStyles[showReceipt.status]?.color,
              }}>
                {statusStyles[showReceipt.status]?.icon} {statusStyles[showReceipt.status]?.label}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: isArtist ? 'Payee' : 'Artist', value: isArtist ? (me?.name ?? showReceipt.artistName) : showReceipt.artistName },
                { label: 'Date', value: showReceipt.date },
                { label: 'Payment ID', value: showReceipt.id },
                { label: 'Method', value: stripeStatus ? `Stripe · ${stripeStatus.email}` : (connectReady ? `Stripe Connect · ···· ${connectLive?.bankLast4 || '····'}` : '—') },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {isArtist ? (
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 24, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Your share (85%)</span>
                  <span>${artistEarningsAmount(showReceipt).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>{(showReceipt.payoutStatus === 'paid' && showReceipt.transferId) || showReceipt.payoutStatus == null ? 'Released to you' : 'Held in escrow'}</span>
                  <span>${paymentDisplayAmount(showReceipt, true).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 24, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                  <span>${showReceipt.amount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                  <span>${platformFeeAmount(showReceipt.amount).toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total charged</span>
                  <span>${showReceipt.amount.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => handleDownloadReceipt(showReceipt)}>
                <Download size={16} /> Receipt (.txt)
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handleDownloadInvoice(showReceipt)}>
                <FileText size={16} /> Invoice (.txt)
              </button>
              {!isArtist && (showReceipt.status === 'pending' || showReceipt.status === 'upcoming') && (
                <button type="button" className="btn btn-primary" onClick={() => {
                  setShowReceipt(null)
                  setSelectedPayment(showReceipt)
                  if (!stripeStatus) { setShowSetup(true) } else { setShowStripe(true) }
                }}>
                  <CreditCard size={16} /> Pay now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pay modal (hirer, Stripe connected) ─────────────────────── */}
      {showStripe && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowStripe(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm payment</h2>
              <button type="button" className="btn-icon" onClick={() => setShowStripe(false)}><X size={18} /></button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 4 }}>
                ${selectedPayment.amount.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{selectedPayment.description}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>to {selectedPayment.artistName}</div>
            </div>
            {stripeStatus && (
              <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
                <CreditCard size={18} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Stripe Checkout</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stripeStatus.email}</div>
                </div>
              </div>
            )}
            <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-muted)' }}>
                <span>Milestone amount</span><span>${selectedPayment.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-muted)' }}>
                <span>Platform fee ({PLATFORM_FEE_PERCENT}%, retained by platform)</span><span>${platformFeeAmount(selectedPayment.amount).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>Total charge</span>
                <span>${selectedPayment.amount.toLocaleString()}</span>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              disabled={confirmBusy}
              onClick={async () => {
                setConfirmBusy(true)
                try {
                  const { url } = await paymentsApi.createCheckout({
                    amount: selectedPayment.amount,
                    artistName: selectedPayment.artistName,
                    description: selectedPayment.description,
                    bookingId: selectedPayment.bookingId || selectedPayment.id,
                  })
                  window.location.href = url
                } catch {
                  setConfirmBusy(false)
                }
              }}>
              {confirmBusy
                ? <Loader2 size={18} className="animate-spin" />
                : <><CreditCard size={18} /> Confirm &amp; pay ${selectedPayment.amount.toLocaleString()}</>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <Shield size={12} style={{ marginRight: 4 }} /> Secured by Stripe. Your payment information is encrypted.
            </div>
          </div>
        </div>
      )}

      {/* ── Hirer Stripe setup modal ─────────────────────────────────── */}
      {showSetup && (
        <SetupModal
          profile={profile}
          onClose={() => setShowSetup(false)}
          onDone={(status) => { setStripeStatus(status); saveLS('su_stripe_v1', status) }}
        />
      )}

      {/* ── Artist Connect modal ─────────────────────────────────────── */}
      {showConnect && (
        <ConnectModal
          userEmail={user?.email || profile?.email || ''}
          artistId={myArtistRecord?.id}
          allowMissingArtist={isAdminArtistTest}
          ensureArtistId={async () => {
            if (myArtistRecord?.id) return myArtistRecord.id
            const { artist } = await adminApi.ensureArtistPersona()
            await refetchArtist?.()
            return artist?.id
          }}
          onClose={() => setShowConnect(false)}
        />
      )}
    </div>
  )
}
