import { useMemo, useState, useEffect } from 'react'
import {
  CreditCard, CheckCircle, Clock, ArrowUpRight, DollarSign, TrendingUp,
  Download, X, Search, ArrowDownRight, Receipt, Shield, FileText,
  Mail, Lock, ChevronRight, UserPlus, ExternalLink, Loader2,
} from '../components/icons'
import { payments as mockPayments } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'
import { stripeConnect, payments as paymentsApi } from '../lib/api'

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
              Confirm your details to enable milestone payments. Card details are collected by Stripe at checkout — Second Unit never stores them.
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
              <span>Payments are processed via Stripe Checkout. A 10% platform fee applies per transaction.</span>
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

function ConnectModal({ userEmail, onClose, onDone }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canSubmit = form.firstName.trim() && form.lastName.trim()

  async function handleConnect() {
    setBusy(true)
    setError(null)
    try {
      const { accountId } = await stripeConnect.createAccount(userEmail)
      const { url } = await stripeConnect.getOnboardingLink(accountId)
      // Store partial status so the return URL can complete it
      saveLS('su_connect_pending_v1', { accountId, firstName: form.firstName, lastName: form.lastName })
      window.location.href = url
    } catch {
      // Stripe not configured — fall back to mock activation
      onDone({ firstName: form.firstName, lastName: form.lastName, bankLast4: '0000', accountId: `acct_mock_${Date.now()}` })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Set up payouts</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
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
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Last name</label>
            <input className="form-input" placeholder="Last" value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="date" value={form.dob}
            onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
        <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
          <Lock size={14} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
          <span>Stripe handles identity verification. A 10% platform fee is deducted from each payout.</span>
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
  const { profile, user } = useAuth()
  const isArtist = isArtistProfile(profile)
  const me = demoArtistPersona(profile)
  const paymentPool = useMemo(() => {
    if (!isArtist || !me) return mockPayments
    return mockPayments.filter((p) => p.artistName === me.name)
  }, [isArtist, me])

  const [stripeStatus, setStripeStatus] = useState(() => loadLS('su_stripe_v1'))
  const [connectStatus, setConnectStatus] = useState(() => loadLS('su_connect_v1'))
  const [confirmBusy, setConfirmBusy] = useState(false)

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
    if (params.get('stripe_success')) {
      const pending = loadLS('su_connect_pending_v1')
      if (pending) {
        const status = { ...pending, bankLast4: '····' }
        setConnectStatus(status)
        saveLS('su_connect_v1', status)
        saveLS('su_connect_pending_v1', null)
      }
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const filteredPayments = paymentPool.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.description.toLowerCase().includes(search.toLowerCase()) && !p.artistName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = paymentPool.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const pending = paymentPool.filter(p => p.status === 'pending' || p.status === 'upcoming').reduce((s, p) => s + p.amount, 0)
  const thisMonth = paymentPool.filter(p => p.status === 'paid').slice(0, 2).reduce((s, p) => s + p.amount, 0)
  const platformFees = Math.round(total * 0.1)

  const statusStyles = {
    paid: { bg: 'var(--success-muted-bg)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Paid' },
    pending: { bg: 'rgba(245,197,66,0.1)', color: 'var(--warning)', icon: <Clock size={14} />, label: 'Pending' },
    upcoming: { bg: 'var(--accent-tint-10)', color: 'var(--accent)', icon: <Clock size={14} />, label: 'Scheduled' },
    refunded: { bg: 'rgba(255,77,106,0.1)', color: 'var(--danger)', icon: <ArrowDownRight size={14} />, label: 'Refunded' },
  }

  const handleDownloadReceipt = (payment) => {
    const content = `
═══════════════════════════════════════
         SECOND UNIT — RECEIPT
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
Platform Fee:  $${Math.round(payment.amount * 0.1).toLocaleString()} (10%)
───────────────────────────────────────
Total Charged: $${(payment.amount + Math.round(payment.amount * 0.1)).toLocaleString()}

Payment Method: Stripe${stripeStatus?.email ? ` · ${stripeStatus.email}` : ''}
Processed by: Stripe

═══════════════════════════════════════
Thank you for using Second Unit!
https://secondunit.com
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
    const platformFee = Math.round(payment.amount * 0.1)
    const tot = payment.amount + platformFee
    const roleNote = isArtist
      ? 'Artist copy — amounts shown reflect your payout / milestone record on Second Unit.'
      : 'Client copy — amounts shown reflect your payment record on Second Unit.'
    const content = `
═══════════════════════════════════════
         SECOND UNIT — INVOICE
═══════════════════════════════════════

Invoice #: INV-${payment.id}
Issue date: ${payment.date}
Status: ${String(payment.status).toUpperCase()}

Bill to / Record for: ${viewer}
${roleNote}

───────────────────────────────────────
LINE ITEMS
───────────────────────────────────────

${payment.description}
Service provider (artist): ${payment.artistName}

  Line subtotal                         $${payment.amount.toLocaleString()}
  Platform facilitation fee (10%)      $${platformFee.toLocaleString()}
───────────────────────────────────────
  Total (incl. platform fee)           $${tot.toLocaleString()}

Payment reference: ${payment.id}
Settlement: processed via Stripe on Second Unit

═══════════════════════════════════════
https://secondunit.com
═══════════════════════════════════════
`
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
            <p>{isArtist ? 'Payouts and milestones for your work' : 'Track payments powered by Stripe'}</p>
          </div>
          {!isArtist && !stripeStatus && (
            <button type="button" className="btn btn-primary" onClick={() => setShowSetup(true)}>
              <CreditCard size={16} /> Set up payments
            </button>
          )}
          {isArtist && !connectStatus && (
            <button type="button" className="btn btn-primary" onClick={() => setShowConnect(true)}>
              <UserPlus size={16} /> Connect payout account
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-label"><DollarSign size={14} /> {isArtist ? 'Paid to you' : 'Total paid'}</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>${total.toLocaleString()}</span>
          <span className="stat-change"><ArrowUpRight size={12} /> {paymentPool.filter(p => p.status === 'paid').length} {isArtist ? 'payouts' : 'payments'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Clock size={14} /> {isArtist ? 'Incoming' : 'Outstanding'}</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>${pending.toLocaleString()}</span>
          <span className="stat-change">{paymentPool.filter(p => p.status !== 'paid').length} pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><TrendingUp size={14} /> This month</span>
          <span className="stat-value">${thisMonth.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Receipt size={14} /> {isArtist ? 'Fees withheld' : 'Platform fees'}</span>
          <span className="stat-value" style={{ color: 'var(--accent)' }}>${platformFees.toLocaleString()}</span>
          <span className="stat-change">10% per transaction</span>
        </div>
      </div>

      {/* Stripe status banner */}
      {!isArtist && !stripeStatus && (
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

      {!isArtist && stripeStatus && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, var(--success-muted-bg), var(--accent-tint-05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--success-muted-bg)' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Stripe payments active</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {stripeStatus.email} · card details collected at checkout · 10% platform fee
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSetup(true)}>
            Manage
          </button>
        </div>
      )}

      {isArtist && !connectStatus && (
        <div style={{ marginBottom: 24, padding: '20px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--accent-tint-10)' }}>
              <Mail size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>You've been invited to set up payouts</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connect your bank account via Stripe Connect to receive milestone payments automatically.</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowConnect(true)}>
            Set up payouts <ChevronRight size={16} />
          </button>
        </div>
      )}

      {isArtist && connectStatus && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, var(--success-muted-bg), var(--accent-tint-05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--success-muted-bg)' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Stripe Connect active</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Bank account ···· {connectStatus.bankLast4} · Payouts arrive 2–3 business days after approval · ID: {connectStatus.accountId}
              </div>
            </div>
          </div>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            <ArrowUpRight size={14} /> Stripe dashboard
          </a>
        </div>
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

        {filteredPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            No payments match your filters.
          </div>
        ) : (
          filteredPayments.map(p => {
            const s = statusStyles[p.status] || statusStyles.pending
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
                  ${p.amount.toLocaleString()}
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
                ${showReceipt.amount.toLocaleString()}
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
                { label: 'Method', value: stripeStatus ? `Stripe · ${stripeStatus.email}` : (connectStatus ? `Stripe Connect · ···· ${connectStatus.bankLast4}` : '—') },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 24, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span>${showReceipt.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Platform fee (10%)</span>
                <span>${Math.round(showReceipt.amount * 0.1).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Total</span>
                <span>${(showReceipt.amount + Math.round(showReceipt.amount * 0.1)).toLocaleString()}</span>
              </div>
            </div>

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
                  <div style={{ fontWeight: 600 }}>{stripeStatus.brand} ···· {stripeStatus.last4}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stripeStatus.email}</div>
                </div>
              </div>
            )}
            <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-muted)' }}>
                <span>Milestone amount</span><span>${selectedPayment.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-muted)' }}>
                <span>Platform fee (10%)</span><span>${Math.round(selectedPayment.amount * 0.1).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>Total charge</span>
                <span>${(selectedPayment.amount + Math.round(selectedPayment.amount * 0.1)).toLocaleString()}</span>
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
                    bookingId: selectedPayment.id,
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
          onClose={() => setShowConnect(false)}
          onDone={(status) => { setConnectStatus(status); saveLS('su_connect_v1', status) }}
        />
      )}
    </div>
  )
}
