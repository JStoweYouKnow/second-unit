import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileApi, billing, calendar } from '../lib/api'
import { User, Mail, Shield, Bell, CreditCard, Camera, FileText, Trash2 } from '../components/icons'
import {
  uploadTaxDocument,
  listTaxDocuments,
  getTaxDocumentSignedUrl,
  deleteTaxDocument,
} from '../lib/taxDocuments'
import { ArtistFormFields } from '../components/ArtistFormFields'
import ThemeToggle from '../components/ThemeToggle'
import { MfaSettings } from '../components/MfaSettings'
import {
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../lib/pushNotifications'
import { useArtistProfile, saveArtistProfile } from '../hooks/useArtistProfile'
import { useMyApplication, isPendingApplicant } from '../hooks/useArtistApplication'
import { artistRecordToForm, emptyArtistForm } from '../lib/artistProfile'

export default function Account() {
  const { profile, user, isMockMode, fetchProfile } = useAuth()
  const { artist, loading: artistLoading, refetch: refetchArtist } = useArtistProfile(profile?.id)
  const { application, loading: appLoading } = useMyApplication(profile?.id)

  const [activeTab, setActiveTab] = useState('profile')
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [billingLine1, setBillingLine1] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingRegion, setBillingRegion] = useState('')
  const [billingPostal, setBillingPostal] = useState('')
  const [taxDocs, setTaxDocs] = useState([])
  const [taxBusy, setTaxBusy] = useState(false)
  const [taxDocType, setTaxDocType] = useState('w9')
  const [artistForm, setArtistForm] = useState(emptyArtistForm())
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [notifPrefs, setNotifPrefs] = useState({
    messages: true,
    projects: true,
    billing: true,
    marketing: false,
    push: false,
  })
  const [pushBusy, setPushBusy] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState({ connected: false, feedUrl: null })
  const [calendarBusy, setCalendarBusy] = useState(false)

  const isApprovedArtist = profile?.role === 'artist' && !!artist
  const isPending = isPendingApplicant(application)

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name)
    setCompanyName(profile?.company_name || '')
    setBusinessType(profile?.business_type || '')
    setBillingLine1(profile?.billing_address_line1 || '')
    setBillingCity(profile?.billing_city || '')
    setBillingRegion(profile?.billing_region || '')
    setBillingPostal(profile?.billing_postal || '')
  }, [profile])

  useEffect(() => {
    if (!profile?.id || profile?.role === 'artist') return
    listTaxDocuments(profile.id)
      .then(setTaxDocs)
      .catch(() => setTaxDocs([]))
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (artist) {
      setArtistForm(artistRecordToForm(artist))
      setFullName(artist.displayName || profile?.full_name || '')
    }
  }, [artist, profile?.full_name])

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      setActiveTab('billing')
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('calendar') === 'connected') {
      setActiveTab('profile')
      calendar.getStatus().then(setCalendarStatus).catch(() => {})
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('calendar') === 'error') {
      setError('Google Calendar connection failed. Check OAuth credentials and try again.')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.id) return
    calendar.getStatus().then(setCalendarStatus).catch(() => {})
  }, [profile?.id])

  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.id) return
    profileApi.getNotificationPrefs().then(setNotifPrefs).catch(() => {})
  }, [profile?.id])

  const loadPaymentMethods = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setBillingLoading(true)
    try {
      const data = await billing.listPaymentMethods()
      setPaymentMethods(data.paymentMethods || [])
    } catch {
      setPaymentMethods([])
    } finally {
      setBillingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'billing') loadPaymentMethods()
  }, [activeTab, loadPaymentMethods])

  const handleUpdatePassword = async () => {
    setPasswordMsg('')
    setError('')
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setPasswordMsg('Password change requires Supabase auth.')
      return
    }
    if (currentPassword && user?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        setPasswordMsg('Current password is incorrect.')
        return
      }
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setPasswordMsg(updateError.message)
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMsg('Password updated successfully.')
  }

  const handleSaveNotificationPrefs = async () => {
    setIsSaving(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const savedPrefs = await profileApi.updateNotificationPrefs(notifPrefs)
        setNotifPrefs(savedPrefs)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnablePush = async () => {
    setPushBusy(true)
    setError('')
    try {
      await subscribeToPushNotifications()
      if (isSupabaseConfigured) {
        const savedPrefs = await profileApi.getNotificationPrefs()
        setNotifPrefs(savedPrefs)
      } else {
        setNotifPrefs((p) => ({ ...p, push: true }))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Could not enable push notifications')
    } finally {
      setPushBusy(false)
    }
  }

  const handleDisablePush = async () => {
    setPushBusy(true)
    setError('')
    try {
      await unsubscribeFromPushNotifications()
      if (isSupabaseConfigured) {
        const savedPrefs = await profileApi.getNotificationPrefs()
        setNotifPrefs(savedPrefs)
      } else {
        setNotifPrefs((p) => ({ ...p, push: false }))
      }
    } catch (err) {
      setError(err.message || 'Could not disable push notifications')
    } finally {
      setPushBusy(false)
    }
  }

  const handleAddPaymentMethod = async () => {
    setBillingLoading(true)
    setError('')
    try {
      const { url } = await billing.createSetupSession()
      if (url) window.location.href = url
    } catch (err) {
      setError(err.message || 'Could not open Stripe billing portal')
      setBillingLoading(false)
    }
  }

  const handleConnectCalendar = async () => {
    setCalendarBusy(true)
    setError('')
    try {
      const { url } = await calendar.connect()
      if (url) window.location.href = url
    } catch (err) {
      setError(err.message || 'Could not start Google Calendar OAuth')
      setCalendarBusy(false)
    }
  }

  const handleDisconnectCalendar = async () => {
    setCalendarBusy(true)
    try {
      await calendar.disconnect()
      setCalendarStatus({ connected: false })
    } catch (err) {
      setError(err.message || 'Could not disconnect calendar')
    } finally {
      setCalendarBusy(false)
    }
  }

  const handleSyncCalendar = async () => {
    setCalendarBusy(true)
    try {
      await calendar.sync()
      const status = await calendar.getStatus()
      setCalendarStatus(status)
    } catch (err) {
      setError(err.message || 'Calendar sync failed')
    } finally {
      setCalendarBusy(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)
    setError('')

    if (isApprovedArtist) {
      const { error: saveError } = await saveArtistProfile({
        profileId: profile.id,
        fullName,
        form: artistForm,
        existingArtist: artist,
      })

      if (saveError) {
        setError(saveError.message || 'Failed to save profile')
        setIsSaving(false)
        return
      }

      await refetchArtist()
      await fetchProfile?.(profile.id)
    } else if (profile?.id) {
      if (isSupabaseConfigured) {
        const patch = {
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        }
        if (profile.role !== 'artist') {
          Object.assign(patch, {
            company_name: companyName.trim() || null,
            business_type: businessType.trim() || null,
            billing_address_line1: billingLine1.trim() || null,
            billing_city: billingCity.trim() || null,
            billing_region: billingRegion.trim() || null,
            billing_postal: billingPostal.trim() || null,
            billing_country: 'US',
            tax_onboarding_completed_at:
              companyName.trim() && taxDocs.length
                ? profile.tax_onboarding_completed_at || new Date().toISOString()
                : profile.tax_onboarding_completed_at || null,
          })
        }
        const { error: profileError } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', profile.id)

        if (profileError) {
          setError(profileError.message)
          setIsSaving(false)
          return
        }
      } else {
        localStorage.setItem('mock_user_name', fullName)
      }
      await fetchProfile?.(profile.id)
    }

    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Account Settings</h1>
            <p>Manage your profile, security, and payment preferences</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 40, marginTop: 32 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            type="button"
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> Profile Info
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={18} /> Security
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} /> Notifications
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CreditCard size={18} /> Billing
          </button>
        </aside>

        <main className="card" style={{ padding: 32 }}>
          {activeTab === 'profile' && (
            <div className="slide-up">
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
                <div className="avatar" style={{ width: 80, height: 80, fontSize: 32, position: 'relative' }}>
                  {(fullName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  <button type="button" className="btn-icon" style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, background: 'var(--accent)', color: 'white', borderColor: 'transparent' }}>
                    <Camera size={16} />
                  </button>
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{fullName || 'User'}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{user?.email}</p>
                </div>
              </div>

              {isPending && (
                <div style={{ padding: 16, marginBottom: 24, borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 197, 66, 0.3)', background: 'rgba(245, 197, 66, 0.08)', fontSize: 14 }}>
                  Your artist application is under review.{' '}
                  <Link to="/application-status" style={{ color: 'var(--gold)' }}>View status</Link>
                  {' · '}
                  <Link to="/apply" style={{ color: 'var(--gold)' }}>Edit application</Link>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="filter-select" style={{ width: '100%' }} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Role</label>
                  <input className="filter-select" style={{ width: '100%' }} value={profile?.role || 'employer'} disabled />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <input className="filter-select" style={{ width: '100%', paddingLeft: 40 }} value={user?.email || ''} disabled />
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>

              {profile?.role !== 'artist' && (
                <>
                  <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
                  <h3 style={{ marginBottom: 8 }}>Business & tax</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                    Optional for first payments. Store company details and upload W-9 / 1099 agreements for your records.
                    The Callsheet does not file taxes for you.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Company / legal entity</label>
                      <input className="filter-select" style={{ width: '100%' }} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Productions LLC" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Business type</label>
                      <select className="filter-select" style={{ width: '100%' }} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                        <option value="">Select…</option>
                        <option value="individual">Individual / sole prop</option>
                        <option value="llc">LLC</option>
                        <option value="corporation">Corporation</option>
                        <option value="partnership">Partnership</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Billing address</label>
                      <input className="filter-select" style={{ width: '100%' }} value={billingLine1} onChange={(e) => setBillingLine1(e.target.value)} placeholder="Street address" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="filter-select" style={{ width: '100%' }} value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State / region</label>
                      <input className="filter-select" style={{ width: '100%' }} value={billingRegion} onChange={(e) => setBillingRegion(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Postal code</label>
                      <input className="filter-select" style={{ width: '100%' }} value={billingPostal} onChange={(e) => setBillingPostal(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <label className="form-label">Tax documents (W-9, 1099 agreement, etc.)</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                      <select className="filter-select" value={taxDocType} onChange={(e) => setTaxDocType(e.target.value)} style={{ width: 180 }}>
                        <option value="w9">W-9</option>
                        <option value="1099_agreement">1099 agreement</option>
                        <option value="other">Other</option>
                      </select>
                      <label className="btn btn-secondary" style={{ margin: 0, cursor: taxBusy ? 'wait' : 'pointer' }}>
                        <FileText size={16} /> {taxBusy ? 'Uploading…' : 'Upload file'}
                        <input
                          type="file"
                          hidden
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          disabled={taxBusy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file || !profile?.id) return
                            setTaxBusy(true)
                            setError('')
                            try {
                              const row = await uploadTaxDocument(profile.id, file, { docType: taxDocType })
                              setTaxDocs((prev) => [row, ...prev])
                            } catch (err) {
                              setError(err.message || 'Upload failed — run employer-tax-vault.sql in Supabase if missing')
                            } finally {
                              setTaxBusy(false)
                            }
                          }}
                        />
                      </label>
                    </div>
                    {taxDocs.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tax documents uploaded yet.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {taxDocs.map((doc) => (
                          <li key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                            <FileText size={16} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>
                              <strong>{doc.file_name}</strong>
                              <span style={{ color: 'var(--text-muted)' }}> · {doc.doc_type}</span>
                            </span>
                            <button
                              type="button"
                              className="btn-icon"
                              title="Download"
                              onClick={async () => {
                                try {
                                  const url = await getTaxDocumentSignedUrl(doc.storage_path)
                                  if (url) window.open(url, '_blank', 'noopener')
                                } catch (err) {
                                  setError(err.message)
                                }
                              }}
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              title="Delete"
                              onClick={async () => {
                                if (!confirm('Delete this tax document?')) return
                                try {
                                  await deleteTaxDocument(profile.id, doc)
                                  setTaxDocs((prev) => prev.filter((d) => d.id !== doc.id))
                                } catch (err) {
                                  setError(err.message)
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {isApprovedArtist && (
                <>
                  <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
                  <h3 style={{ marginBottom: 24 }}>Artist Profile Details</h3>
                  {artistLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading artist profile…</p>
                  ) : (
                    <ArtistFormFields form={artistForm} onChange={setArtistForm} />
                  )}
                </>
              )}

              {!isApprovedArtist && application && !isPending && application.status === 'rejected' && (
                <div style={{ marginTop: 24, padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                    Your previous application was not approved. Request a new invite link to apply again.
                  </p>
                  <Link to="/apply" className="btn btn-primary btn-sm">Resubmit application</Link>
                </div>
              )}

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
              <h3 style={{ marginBottom: 12 }}>Backend Connection Status</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Verify where your data is being stored and processed.</p>

              <div style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isMockMode ? 'var(--warning)' : 'var(--success)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{isMockMode ? 'Mock Mode (Local Storage)' : 'Supabase (Production Database)'}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
                    {isMockMode
                      ? 'The app is running without a backend connection. All changes are temporary and saved only in your browser.'
                      : 'Successfully connected to the live Supabase database. All data is persistent and synced across devices.'}
                  </p>
                </div>
                {!isMockMode && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Connected</span>}
                {isMockMode && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>No Backend</span>}
              </div>

              {error && <div className="auth-error" style={{ marginTop: 20 }}>{error}</div>}

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />

              <h4 style={{ margin: '0 0 12px 0', fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-tight)' }}>Appearance</h4>
              <ThemeToggle variant="row" />

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />

              <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-display)' }}>Google Calendar</h4>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                Two-way sync: confirmed bookings push to your calendar; busy times import into your availability (artists).
              </p>
              {calendarStatus.connected ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--success)' }}>Connected {calendarStatus.lastSyncedAt ? `· last sync ${new Date(calendarStatus.lastSyncedAt).toLocaleString()}` : ''}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSyncCalendar} disabled={calendarBusy}>Sync now</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleDisconnectCalendar} disabled={calendarBusy}>Disconnect</button>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleConnectCalendar} disabled={calendarBusy || !isSupabaseConfigured}>
                  Connect Google Calendar
                </button>
              )}

              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                {saved && <span style={{ color: 'var(--success)', fontSize: 14, fontWeight: 500 }}>Profile updated successfully!</span>}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={isSaving || (isApprovedArtist && artistLoading) || appLoading}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="slide-up">
              <h3 style={{ marginBottom: 24 }}>Security Settings</h3>

              <div style={{ display: 'grid', gap: 20, maxWidth: 500 }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••"
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <div>
                  {passwordMsg && (
                    <p style={{ fontSize: 13, color: passwordMsg.includes('success') ? 'var(--success)' : 'var(--danger)', marginBottom: 8 }}>
                      {passwordMsg}
                    </p>
                  )}
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={handleUpdatePassword}>
                    Update Password
                  </button>
                </div>
              </div>

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />

              <MfaSettings />

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />

              <div>
                <h4 style={{ margin: '0 0 8px 0' }}>iCal subscription feed</h4>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 12px 0', fontSize: 14 }}>
                  Subscribe in Apple Calendar, Outlook, or any iCal app — works without Google OAuth.
                </p>
                {calendarStatus.feedUrl ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <code style={{ fontSize: 12, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, wordBreak: 'break-all' }}>
                      {calendarStatus.feedUrl}
                    </code>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigator.clipboard?.writeText(calendarStatus.feedUrl)}
                    >
                      Copy URL
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => calendar.getFeedToken().then((r) => setCalendarStatus((s) => ({ ...s, feedUrl: r.feedUrl }))).catch(() => setError('Could not generate feed URL'))}>
                    Generate feed URL
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="slide-up">
              <h3 style={{ marginBottom: 24 }}>Notification Preferences</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                {[
                  { key: 'messages', label: 'New Messages', desc: 'When a client or artist sends you a direct message.' },
                  { key: 'projects', label: 'Project Updates', desc: 'Milestone approvals, contract changes, and status updates.' },
                  { key: 'billing', label: 'Billing Alerts', desc: 'Invoices, payment receipts, and escrow releases.' },
                  { key: 'marketing', label: 'Marketing & News', desc: 'Product updates, beta features, and community highlights.' },
                ].map((n) => (
                  <label key={n.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--surface)' }}>
                    <input
                      type="checkbox"
                      checked={!!notifPrefs[n.key]}
                      onChange={(e) => setNotifPrefs((p) => ({ ...p, [n.key]: e.target.checked }))}
                      style={{ marginTop: 4 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{n.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 32, padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', maxWidth: 600 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Browser push notifications</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Get alerts on this device when you receive messages, booking updates, or review replies — even when The Callsheet tab is in the background.
                </p>
                {!isPushSupported() ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Push notifications are not supported in this browser.
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: notifPrefs.push ? 'var(--success)' : 'var(--text-muted)' }}>
                      {notifPrefs.push ? 'Enabled on this device' : 'Not enabled'}
                      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && ' — blocked in browser settings'}
                    </span>
                    {notifPrefs.push ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleDisablePush} disabled={pushBusy}>
                        {pushBusy ? 'Updating…' : 'Disable push'}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleEnablePush} disabled={pushBusy || (typeof Notification !== 'undefined' && Notification.permission === 'denied')}>
                        {pushBusy ? 'Enabling…' : 'Enable push'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
                {saved && <span style={{ color: 'var(--success)', fontSize: 14 }}>Preferences saved.</span>}
                <button type="button" className="btn btn-primary" onClick={handleSaveNotificationPrefs} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="slide-up">
              <h3 style={{ marginBottom: 24 }}>Billing & Payments</h3>

              <div className="card" style={{ padding: 24, background: 'rgba(245, 197, 66, 0.05)', borderColor: 'var(--gold)', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--gold)' }}>{isApprovedArtist ? 'Artist account' : 'Private Beta Plan'}</h4>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
                      {isApprovedArtist
                        ? 'No monthly subscription during beta. Payouts are processed via Stripe Connect when clients pay for your work.'
                        : 'No monthly subscription during beta. Hirers are charged at checkout; artists receive payouts after milestone approval. A 15% platform fee is retained by The Callsheet.'}
                    </p>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>$0<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></div>
                </div>
              </div>

              <h4 style={{ marginBottom: 16 }}>Payment Methods</h4>
              {billingLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading payment methods…</p>
              ) : paymentMethods.length === 0 ? (
                <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', marginBottom: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 12px' }}>No saved cards yet. Add one for faster checkout.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPaymentMethod}>Add payment method</button>
                </div>
              ) : (
                paymentMethods.map((pm) => (
                  <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ background: 'var(--bg-app)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                        {pm.brand}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{pm.brand} ending in {pm.last4}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expires {pm.expMonth}/{pm.expYear}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {paymentMethods.length > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 32 }} onClick={handleAddPaymentMethod} disabled={billingLoading}>
                  Add another card
                </button>
              )}

              <h4 style={{ marginBottom: 16 }}>Billing History</h4>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 16px', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  <div>Date</div>
                  <div>Description</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  No billing history available yet.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
