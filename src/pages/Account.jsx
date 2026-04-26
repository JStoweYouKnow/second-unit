import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Shield, Bell, CreditCard, ChevronRight, Camera } from '../components/icons'

export default function Account() {
  const { profile, user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

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

              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary">Save Changes</button>
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
