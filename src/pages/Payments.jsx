import { useState } from 'react'
import { CreditCard, CheckCircle, Clock, ArrowUpRight, DollarSign, TrendingUp, Download, Eye, X, Filter, Search, ArrowDownRight, Receipt } from 'lucide-react'
import { payments as mockPayments } from '../data/mockData'

export default function Payments() {
  const [showStripe, setShowStripe] = useState(false)
  const [showReceipt, setShowReceipt] = useState(null)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filteredPayments = mockPayments.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.description.toLowerCase().includes(search.toLowerCase()) && !p.artistName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = mockPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const pending = mockPayments.filter(p => p.status === 'pending' || p.status === 'upcoming').reduce((s, p) => s + p.amount, 0)
  const thisMonth = mockPayments.filter(p => p.status === 'paid').slice(0, 2).reduce((s, p) => s + p.amount, 0)
  const platformFees = Math.round(total * 0.1)

  const statusStyles = {
    paid: { bg: 'rgba(0,212,170,0.1)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Paid' },
    pending: { bg: 'rgba(245,197,66,0.1)', color: 'var(--warning)', icon: <Clock size={14} />, label: 'Pending' },
    upcoming: { bg: 'rgba(124,92,252,0.1)', color: 'var(--accent)', icon: <Clock size={14} />, label: 'Scheduled' },
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

Payment Method: •••• 4242 (Visa)
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>💳 Payments</h1>
            <p>Track payments powered by Stripe</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-label"><DollarSign size={14} /> Total Paid</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>${total.toLocaleString()}</span>
          <span className="stat-change"><ArrowUpRight size={12} /> {mockPayments.filter(p => p.status === 'paid').length} payments</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Clock size={14} /> Outstanding</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>${pending.toLocaleString()}</span>
          <span className="stat-change">{mockPayments.filter(p => p.status !== 'paid').length} pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><TrendingUp size={14} /> This Month</span>
          <span className="stat-value">${thisMonth.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Receipt size={14} /> Platform Fees</span>
          <span className="stat-value" style={{ color: 'var(--accent)' }}>${platformFees.toLocaleString()}</span>
          <span className="stat-change">10% per transaction</span>
        </div>
      </div>

      {/* Stripe Banner */}
      <div style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, rgba(99,91,255,0.1), rgba(0,212,170,0.05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'rgba(99,91,255,0.2)' }}>
            <CreditCard size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Stripe Connected</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Payments are processed securely via Stripe · 10% platform fee</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm">
          <ArrowUpRight size={14} /> Stripe Dashboard
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search payments..." value={search}
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

      {/* Payment Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          <span>Description</span>
          <span>Artist</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'center', width: 140 }}>Status</span>
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
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
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
                <span style={{ fontSize: 14 }}>{p.artistName}</span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{p.date}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                  ${p.amount.toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', width: 140 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.icon} {s.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧾 Receipt</h2>
              <button className="btn-icon" onClick={() => setShowReceipt(null)}><X size={18} /></button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 4 }}>
                ${showReceipt.amount.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{showReceipt.description}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: statusStyles[showReceipt.status]?.bg, color: statusStyles[showReceipt.status]?.color
              }}>
                {statusStyles[showReceipt.status]?.icon} {statusStyles[showReceipt.status]?.label}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Artist', value: showReceipt.artistName },
                { label: 'Date', value: showReceipt.date },
                { label: 'Payment ID', value: showReceipt.id },
                { label: 'Method', value: '•••• 4242 (Visa)' },
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

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => handleDownloadReceipt(showReceipt)}>
                <Download size={16} /> Download Receipt
              </button>
              {(showReceipt.status === 'pending' || showReceipt.status === 'upcoming') && (
                <button className="btn btn-primary" onClick={() => { setShowReceipt(null); setSelectedPayment(showReceipt); setShowStripe(true) }}>
                  <CreditCard size={16} /> Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showStripe && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowStripe(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💳 Process Payment</h2>
              <button className="btn-icon" onClick={() => setShowStripe(false)}><X size={18} /></button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 4 }}>
                ${selectedPayment.amount.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{selectedPayment.description}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>to {selectedPayment.artistName}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Card Number</label>
              <input className="form-input" placeholder="4242 4242 4242 4242" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Expiry</label>
                <input className="form-input" placeholder="MM/YY" />
              </div>
              <div className="form-group">
                <label className="form-label">CVC</label>
                <input className="form-input" placeholder="123" />
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              <CreditCard size={18} /> Pay ${selectedPayment.amount.toLocaleString()} with Stripe
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              🔒 Secured by Stripe. Your payment information is encrypted.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
