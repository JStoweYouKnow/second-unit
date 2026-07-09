import { useMemo, useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Calendar, Clock, Plus, CheckCircle, AlertCircle, X, Send, CreditCard, Loader2, Shield, ExternalLink } from '../components/icons'
import { useArtists } from '../hooks/useData'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { useBookings } from '../hooks/useBookings'
import { bookings as bookingsApi, payments as paymentsApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'
import { bookingSubtotal, bookingScheduleCaption } from '../lib/pricing'
import { PLATFORM_FEE_PERCENT } from '../lib/fees'

export default function Bookings() {
  const { profile, isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isArtist = isArtistProfile(profile)
  const { artist: myArtistRecord } = useArtistProfile(profile?.id)
  const myArtist = demoArtistPersona(profile, myArtistRecord)
  const { artists } = useArtists()
  const { bookings, loading: bookingsLoading, error: bookingsError, refetch } = useBookings(isAuthenticated)
  const [tab, setTab] = useState('upcoming')
  const [showNew, setShowNew] = useState(false)
  const [showPay, setShowPay] = useState(null)
  const [newBooking, setNewBooking] = useState({
    artistId: '',
    date: '',
    time: '',
    duration: 2,
    durationUnit: 'hours',
    agreedTotal: '',
    type: 'Consultation',
    notes: '',
  })
  const [showComplete, setShowComplete] = useState(null)
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  // Handle return from Stripe Checkout (or mock payment)
  useEffect(() => {
    const success = searchParams.get('payment_success')
    if (success) {
      refetch()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, refetch, setSearchParams])

  const roleBookings = useMemo(() => {
    if (!isArtist || !myArtist) return bookings
    return bookings.filter((b) => String(b.artistId) === String(myArtist.id))
  }, [isArtist, myArtist, bookings])

  const filtered = tab === 'upcoming'
    ? roleBookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'paid')
    : roleBookings

  const handleCreateBooking = async (e) => {
    e.preventDefault()
    setError(null)
    const artist = artists.find((a) => String(a.id) === String(newBooking.artistId))
    if (!artist) return

    const agreed = Math.round(Number(String(newBooking.agreedTotal).replace(/,/g, '')))
    if (!Number.isFinite(agreed) || agreed < 1) {
      setError('Enter a valid agreed fee (whole dollars) you confirmed with the artist.')
      return
    }

    const duration =
      newBooking.durationUnit === 'project'
        ? 1
        : Number(newBooking.duration) || 1

    const payload = {
      artistId: artist.id,
      artistName: artist.name,
      date: newBooking.date,
      time: newBooking.time || '09:00',
      duration,
      durationUnit: newBooking.durationUnit,
      type: newBooking.type,
      agreedTotal: agreed,
      notes: newBooking.notes,
    }

    setLoading('new')
    try {
      await bookingsApi.create(payload)
      await refetch()
      setShowNew(false)
      setNewBooking({
        artistId: '',
        date: '',
        time: '',
        duration: 2,
        durationUnit: 'hours',
        agreedTotal: '',
        type: 'Consultation',
        notes: '',
      })
    } catch (err) {
      setError(err.message || 'Failed to create booking. Please try again.')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  const handleConfirm = async (id) => {
    setError(null)
    setLoading(id)
    try {
      await bookingsApi.respond(id, 'confirm')
      await refetch()
    } catch (err) {
      setError(err.message || 'Failed to confirm booking.')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  const handleDecline = async (id) => {
    setError(null)
    setLoading(id)
    try {
      await bookingsApi.respond(id, 'decline')
      await refetch()
    } catch (err) {
      setError(err.message || 'Failed to decline booking.')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  const handlePay = (booking) => {
    setShowPay(booking)
  }

  const handleComplete = async () => {
    if (!showComplete) return
    setError(null)
    setLoading(showComplete.id)
    try {
      await bookingsApi.complete(showComplete.id)
      await refetch()
      setShowComplete(null)
    } catch (err) {
      setError(err.message || 'Failed to complete booking.')
    } finally {
      setLoading(null)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!showPay) return
    setError(null)
    setLoading(showPay.id)
    try {
      const { url } = await paymentsApi.createCheckout({
        amount: bookingSubtotal(showPay),
        artistName: showPay.artistName,
        description: `${showPay.type} with ${showPay.artistName}`,
        bookingId: showPay.id,
      })
      window.location.href = url
    } catch (err) {
      setError('Could not start checkout. Please try again.')
      setLoading(null)
    }
  }

  const hasLinkedContract = (booking) => Boolean(booking?.contractId || booking?.contract?.id)

  const contractActionLabel = (booking, forArtist) => {
    const c = booking.contract
    if (!c) return forArtist ? 'View project' : 'Open project'
    if (c.status === 'pending') {
      const needsSign = forArtist ? !c.signedByArtist : !c.signedByEmployer
      return needsSign ? 'Sign agreement' : 'View project'
    }
    if (c.status === 'active') return forArtist ? 'View milestones' : 'Pay milestones'
    if (c.status === 'completed') return 'View project'
    return 'Open project'
  }

  const contractHref = (booking) => {
    const id = booking.contractId || booking.contract?.id
    return id ? `/projects?contract_id=${id}` : '/projects'
  }

  const statusConfig = {
    pending: { bg: 'rgba(245,197,66,0.1)', color: 'var(--warning)', icon: <AlertCircle size={14} />, label: 'Pending' },
    confirmed: { bg: 'var(--success-muted-bg)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Confirmed' },
    paid: { bg: 'var(--accent-tint-10)', color: 'var(--accent)', icon: <CreditCard size={14} />, label: 'Paid' },
    cancelled: { bg: 'rgba(255,77,106,0.1)', color: 'var(--danger)', icon: <X size={14} />, label: 'Cancelled' },
    completed: { bg: 'var(--success-muted-bg)', color: 'var(--success)', icon: <CheckCircle size={14} />, label: 'Completed' },
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{isArtist ? 'Your bookings' : 'Bookings'}</h1>
            <p>
              {isArtist
                ? 'Sessions clients scheduled with you — amounts reflect fees agreed in your thread.'
                : 'Schedule sessions after you and the artist align on scope and fee in Messages.'}
            </p>
          </div>
          {!isArtist && (
            <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} /> New Booking</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-secondary)' }}>
        <Shield size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
        <span>
          {isArtist
            ? 'Confirmed bookings create a linked project contract. Milestone payouts are released to your Stripe account as each phase is approved.'
            : `After the artist confirms, a project contract is created automatically. Pay through milestone escrow on Projects (${PLATFORM_FEE_PERCENT}% platform fee).`}
        </span>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>{error}</div>
          <button type="button" className="btn-icon" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {bookingsError && !error && (
        <div className="auth-error" style={{ marginBottom: 20 }}>{bookingsError}</div>
      )}

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button type="button" className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All Bookings</button>
      </div>

      {bookingsLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading bookings…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Calendar size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{isArtist ? 'No bookings on your calendar yet.' : 'No bookings yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(b => {
            const s = statusConfig[b.status] || statusConfig.pending
            const total = bookingSubtotal(b)
            const isProcessing = loading === b.id
            return (
              <div key={b.id} className="card slide-up" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, opacity: isProcessing ? 0.7 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div className="avatar avatar-sm">
                      {isArtist
                        ? (b.type || 'BK').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'BK'
                        : b.artistName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <h3 style={{ fontSize: 16 }}>{isArtist ? 'Client booking' : b.artistName}</h3>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: b.notes ? 8 : 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={14} /> {b.date}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={14} /> {bookingScheduleCaption(b)}
                    </span>
                    <span className="skill-tag">{b.type}</span>
                  </div>
                  {b.notes && <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>&ldquo;{b.notes}&rdquo;</p>}
                  {hasLinkedContract(b) && b.contract?.title && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Linked project: {b.contract.title}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>${total.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agreed fee</div>
                  </div>

                  <div style={{ minWidth: 140, display: 'flex', justifyContent: 'flex-end' }}>
                    {isProcessing ? (
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    ) : (
                      <>
                        {b.status === 'pending' && isArtist && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => handleConfirm(b.id)}>
                              <CheckCircle size={14} /> Confirm
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDecline(b.id)}>
                              Decline
                            </button>
                          </div>
                        )}
                        {b.status === 'pending' && !isArtist && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, textAlign: 'right' }}>
                            Awaiting artist confirmation
                          </span>
                        )}

                        {b.status === 'confirmed' && !isArtist && (
                          hasLinkedContract(b) ? (
                            <Link to={contractHref(b)} className="btn btn-primary btn-sm">
                              <ExternalLink size={14} /> {contractActionLabel(b, false)}
                            </Link>
                          ) : (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePay(b)}>
                              <CreditCard size={14} /> Pay Now
                            </button>
                          )
                        )}
                        {b.status === 'confirmed' && isArtist && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, textAlign: 'right' }}>
                            {hasLinkedContract(b) ? 'Contract ready — awaiting signatures / payment' : 'Awaiting client payment'}
                          </span>
                        )}

                        {b.status === 'paid' && !isArtist && (
                          hasLinkedContract(b) ? (
                            <Link to={contractHref(b)} className="btn btn-secondary btn-sm">
                              <ExternalLink size={14} /> {contractActionLabel(b, false)}
                            </Link>
                          ) : (
                            <button type="button" className="btn btn-success btn-sm" onClick={() => setShowComplete(b)}>
                              <CheckCircle size={14} /> Mark Complete
                            </button>
                          )
                        )}
                        {b.status === 'paid' && isArtist && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, textAlign: 'right' }}>
                            {hasLinkedContract(b) ? (
                              <Link to={contractHref(b)} style={{ color: 'var(--accent)' }}>
                                {contractActionLabel(b, true)}
                              </Link>
                            ) : (
                              'Awaiting project completion'
                            )}
                          </span>
                        )}

                        {['confirmed', 'paid', 'completed'].includes(b.status) && (
                          <Link to={`/disputes?booking=${b.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}>
                            <Shield size={14} /> Dispute
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowNew(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-booking-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="new-booking-title">Create New Booking</h2>
              <button type="button" className="btn-icon" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateBooking}>
              <div className="form-group">
                <label className="form-label">Artist</label>
                <select className="form-input" value={newBooking.artistId} onChange={e => setNewBooking(p => ({ ...p, artistId: e.target.value }))} required>
                  <option value="">Select an artist...</option>
                  {artists.filter(a => a.available).map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
                  ))}
                </select>
              </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={newBooking.date}
                    onChange={e => setNewBooking(p => ({ ...p, date: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label">Start time</label>
                  <input className="form-input" type="time"
                    value={newBooking.time}
                    onChange={e => setNewBooking(p => ({ ...p, time: e.target.value }))} />
                </div>

              <div className="form-group">
                <label className="form-label">Schedule length</label>
                <select
                  className="form-input"
                  value={newBooking.durationUnit}
                  onChange={(e) => {
                    const durationUnit = e.target.value
                    setNewBooking((p) => {
                      let duration = Number(p.duration) || 1
                      if (durationUnit === 'project') duration = 1
                      else if (durationUnit === 'days') {
                        const allowed = [1, 2, 3, 4, 5, 6, 7, 10, 14]
                        if (!allowed.includes(duration)) duration = 1
                      } else {
                        const allowed = [0.5, 1, 2, 3, 4, 6, 8]
                        if (!allowed.includes(duration)) duration = 2
                      }
                      return { ...p, durationUnit, duration }
                    })
                  }}
                >
                  <option value="hours">Hours (e.g. half-day consult)</option>
                  <option value="days">Multi-day block</option>
                  <option value="project">Project / milestone block</option>
                </select>
              </div>

              {newBooking.durationUnit === 'hours' && (
                <div className="form-group">
                  <label className="form-label">Duration (hours)</label>
                  <select className="form-input" value={newBooking.duration} onChange={e => setNewBooking(p => ({ ...p, duration: Number(e.target.value) }))}>
                    {[0.5, 1, 2, 3, 4, 6, 8].map((d) => (
                      <option key={d} value={d}>{d}h</option>
                    ))}
                  </select>
                </div>
              )}
              {newBooking.durationUnit === 'days' && (
                <div className="form-group">
                  <label className="form-label">Duration (days)</label>
                  <select className="form-input" value={newBooking.duration} onChange={e => setNewBooking(p => ({ ...p, duration: Number(e.target.value) }))}>
                    {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((d) => (
                      <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                    ))}
                  </select>
                </div>
              )}
              {newBooking.durationUnit === 'project' && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
                  Use this when the calendar hold covers a defined project slice or deliverable batch you already priced together.
                </p>
              )}

              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={newBooking.type} onChange={e => setNewBooking(p => ({ ...p, type: e.target.value }))}>
                  {['Consultation', 'Project Work', 'Full Day Session', 'Workshop', 'Review Session'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Agreed fee (USD)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 2500"
                  value={newBooking.agreedTotal}
                  onChange={e => setNewBooking(p => ({ ...p, agreedTotal: e.target.value }))}
                  required
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                  Enter the total fee you and the artist already agreed in Messages (or elsewhere). Nothing is charged until the artist confirms and you complete checkout.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-input" placeholder="Session goals, links, or reference materials…" value={newBooking.notes}
                  onChange={e => setNewBooking(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {newBooking.artistId && newBooking.agreedTotal && Number(newBooking.agreedTotal) > 0 && (
                <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Agreed subtotal</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                      ${Math.round(Number(String(newBooking.agreedTotal).replace(/,/g, '')) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    15% platform fee is retained when you pay. The artist receives 85% only after work is approved (via Stripe Connect when onboarded).
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading === 'new'}>
                  {loading === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowComplete(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="complete-booking-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="complete-booking-title">Mark Project Complete</h2>
              <button type="button" className="btn-icon" onClick={() => setShowComplete(null)}><X size={18} /></button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>
                Complete project
              </div>
              <div style={{ color: 'var(--text-muted)' }}>with {showComplete.artistName}</div>
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total paid at project start</span>
                <span>${bookingSubtotal(showComplete).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Platform fee (15% — collected at payment)</span>
                <span>−${Math.round(bookingSubtotal(showComplete) * 0.15).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Artist share (85%)</span>
                <span>${Math.round(bookingSubtotal(showComplete) * 0.85).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Shield size={14} style={{ color: 'var(--warning)', marginTop: 1, flexShrink: 0 }} />
              <span>Confirming completion closes the booking and releases the artist’s escrowed share (85%) to their Stripe account if still pending.</span>
            </div>

            <button
              type="button"
              className="btn btn-success btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleComplete}
              disabled={loading === showComplete.id}
            >
              {loading === showComplete.id
                ? <Loader2 size={18} className="animate-spin" />
                : <><CheckCircle size={18} /> Mark Project Complete</>}
            </button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowPay(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pay-booking-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="pay-booking-title">Pay for Booking</h2>
              <button type="button" className="btn-icon" onClick={() => setShowPay(null)}><X size={18} /></button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 4 }}>
                ${bookingSubtotal(showPay).toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{showPay.type} with {showPay.artistName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {showPay.date} · {bookingScheduleCaption(showPay)}
              </div>
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>You pay (project start)</span>
                <span style={{ fontWeight: 700 }}>${bookingSubtotal(showPay).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Platform fee (15%)</span>
                <span>−${Math.round(bookingSubtotal(showPay) * 0.15).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span>Artist receives</span>
                <span>${Math.round(bookingSubtotal(showPay) * 0.85).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Fee is collected from you at checkout. The artist’s 85% share stays in escrow until you approve work / mark the project complete.
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Shield size={14} style={{ color: 'var(--success)', marginTop: 1, flexShrink: 0 }} />
              <span>You'll be taken to Stripe's secure checkout to enter your card details. The Callsheet never handles card data directly.</span>
            </div>

            <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePaymentSubmit} disabled={loading === showPay.id}>
              {loading === showPay.id
                ? <Loader2 size={18} className="animate-spin" />
                : <><CreditCard size={18} /> Continue to Stripe Checkout <ExternalLink size={14} /></>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <Shield size={12} style={{ marginRight: 4 }} /> Secured by Stripe. Your payment information is encrypted.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
