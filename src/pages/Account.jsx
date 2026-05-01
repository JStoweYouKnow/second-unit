import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Shield, Bell, CreditCard, ChevronRight, Camera } from '../components/icons'

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

          {activeTab !== 'profile' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                <ChevronRight size={48} style={{ opacity: 0.2 }} />
              </div>
              <h3>Section Under Construction</h3>
              <p style={{ color: 'var(--text-muted)' }}>We're currently polishing the {activeTab} settings.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
