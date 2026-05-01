import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Shield, Bell, CreditCard, Camera } from '../components/icons'

export default function Account() {
  const { profile, user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setSaved(false)
    setTimeout(() => {
      setIsSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 800)
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
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> Profile Info
          </button>
          <button 
            className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={18} /> Security
          </button>
          <button 
            className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} /> Notifications
          </button>
          <button 
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
                  {(profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  <button className="btn-icon" style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, background: 'var(--accent)', color: 'white', borderColor: 'transparent' }}>
                    <Camera size={16} />
                  </button>
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{profile?.full_name || 'User'}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{user?.email}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="filter-select" style={{ width: '100%' }} defaultValue={profile?.full_name} />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="filter-select" style={{ width: '100%' }} defaultValue={profile?.full_name?.split(' ')[0]} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <input className="filter-select" style={{ width: '100%', paddingLeft: 40 }} defaultValue={user?.email} disabled />
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>


              {profile?.role === 'artist' && (
                <>
                  <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
                  <h3 style={{ marginBottom: 24 }}>Artist Profile Details</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Professional Bio</label>
                      <textarea 
                        className="filter-select" 
                        style={{ width: '100%', minHeight: '100px', padding: '12px', resize: 'vertical' }} 
                        placeholder="Award-winning AI visual artist specializing in..."
                      />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label">Core Skills (comma separated)</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="Midjourney, Stable Diffusion, Runway" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Location</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="Los Angeles, CA" />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label">Past Brands & Clients (comma separated)</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="Nike, Apple, Spotify" />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          Typical Project Rate (USD)
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, background: 'var(--surface)', padding: '2px 6px', borderRadius: 10 }}>Private</span>
                        </label>
                        <input className="filter-select" style={{ width: '100%' }} type="number" placeholder="e.g. 5000" />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>We use this to filter out job inquiries with inadequate budgets.</span>
                      </div>
                    </div>

                    <h4 style={{ marginTop: 16, marginBottom: 8 }}>Social & Portfolio Links</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label">Website Portfolio</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="https://yourwebsite.com" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Instagram</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="https://instagram.com/username" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Twitter / X</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="https://twitter.com/username" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">LinkedIn</label>
                        <input className="filter-select" style={{ width: '100%' }} placeholder="https://linkedin.com/in/username" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 8 }}>
                      <label className="form-label">Video Reels (YouTube/Vimeo URLs, comma separated)</label>
                      <input className="filter-select" style={{ width: '100%' }} placeholder="https://youtube.com/..., https://vimeo.com/..." />
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                {saved && <span style={{ color: 'var(--success)', fontSize: 14, fontWeight: 500 }}>Profile updated successfully!</span>}
                <button 
                  className="btn btn-primary" 
                  onClick={handleSave} 
                  disabled={isSaving}
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
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="filter-select" type="password" style={{ width: '100%' }} placeholder="••••••••" />
                </div>
                <div>
                  <button className="btn btn-secondary" style={{ marginTop: 8 }}>Update Password</button>
                </div>
              </div>

              <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0' }}>Two-Factor Authentication</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Add an extra layer of security to your account.</p>
                </div>
                <button className="btn btn-primary btn-sm">Enable 2FA</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="slide-up">
              <h3 style={{ marginBottom: 24 }}>Notification Preferences</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                {[
                  { id: 'n1', label: 'New Messages', desc: 'When a client or artist sends you a direct message.' },
                  { id: 'n2', label: 'Project Updates', desc: 'Milestone approvals, contract changes, and status updates.' },
                  { id: 'n3', label: 'Billing Alerts', desc: 'Invoices, payment receipts, and escrow releases.' },
                  { id: 'n4', label: 'Marketing & News', desc: 'Product updates, beta features, and community highlights.' }
                ].map(n => (
                  <label key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--surface)' }}>
                    <input type="checkbox" defaultChecked={n.id !== 'n4'} style={{ marginTop: 4 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{n.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div style={{ marginTop: 32 }}>
                <button className="btn btn-primary">Save Preferences</button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="slide-up">
              <h3 style={{ marginBottom: 24 }}>Billing & Payments</h3>
              
              <div className="card" style={{ padding: 24, background: 'rgba(245, 197, 66, 0.05)', borderColor: 'var(--gold)', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--gold)' }}>Private Beta Plan</h4>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>You are currently enjoying fee-free early access.</p>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>$0<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></div>
                </div>
              </div>

              <h4 style={{ marginBottom: 16 }}>Payment Methods</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'var(--bg-app)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>VISA</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Visa ending in 4242</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expires 12/2028</div>
                  </div>
                </div>
                <button className="btn-link" style={{ color: 'var(--text-muted)' }}>Edit</button>
              </div>

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
