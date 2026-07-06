export function ArtistFormFields({ form, onChange, showAccountFields = false, disabledAccountFields = false, lockEmail = false }) {
  const set = (field) => (e) => onChange({ ...form, [field]: e.target.value })

  return (
    <>
      {showAccountFields && (
        <>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              name="fullName"
              autoComplete="name"
              placeholder="Your full name"
              value={form.fullName}
              onChange={set('fullName')}
              required
              disabled={disabledAccountFields}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              disabled={disabledAccountFields || lockEmail}
            />
            {lockEmail && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                This invite is reserved for this email address.
              </span>
            )}
          </div>
          {!disabledAccountFields && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={set('password')}
                minLength={8}
                required
              />
            </div>
          )}
        </>
      )}

      <div className="form-group">
        <label className="form-label">Professional Title</label>
        <input
          className="form-input"
          placeholder="e.g. AI Visual Artist, Motion Designer"
          value={form.roleTitle}
          onChange={set('roleTitle')}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Professional Bio</label>
        <textarea
          className="form-input"
          style={{ minHeight: 100, padding: '12px', resize: 'vertical' }}
          placeholder="Award-winning AI visual artist specializing in..."
          value={form.bio}
          onChange={set('bio')}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Core Skills (comma separated)</label>
          <input
            className="form-input"
            placeholder="Midjourney, Stable Diffusion, Runway"
            value={form.skills}
            onChange={set('skills')}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Location</label>
          <input
            className="form-input"
            placeholder="Los Angeles, CA"
            value={form.location}
            onChange={set('location')}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Past Brands & Clients (comma separated)</label>
          <input
            className="form-input"
            placeholder="Nike, Apple, Spotify"
            value={form.brands}
            onChange={set('brands')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Hourly Rate (USD, public)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="e.g. 450"
            value={form.hourlyRate}
            onChange={set('hourlyRate')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Day Rate (USD, public)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="e.g. 2800"
            value={form.dailyRate}
            onChange={set('dailyRate')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Flat Project Rate (USD, public)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="e.g. 12000"
            value={form.projectFlatRate}
            onChange={set('projectFlatRate')}
          />
        </div>
      </div>

      <h4 style={{ marginTop: 8, marginBottom: 4 }}>Social & Portfolio Links</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Website Portfolio</label>
          <input className="form-input" placeholder="https://yourwebsite.com" value={form.website} onChange={set('website')} />
        </div>
        <div className="form-group">
          <label className="form-label">Instagram</label>
          <input className="form-input" placeholder="https://instagram.com/username" value={form.instagram} onChange={set('instagram')} />
        </div>
        <div className="form-group">
          <label className="form-label">Twitter / X</label>
          <input className="form-input" placeholder="https://twitter.com/username" value={form.twitter} onChange={set('twitter')} />
        </div>
        <div className="form-group">
          <label className="form-label">LinkedIn</label>
          <input className="form-input" placeholder="https://linkedin.com/in/username" value={form.linkedin} onChange={set('linkedin')} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Video Reels (YouTube/Vimeo URLs, comma separated)</label>
        <input
          className="form-input"
          placeholder="https://youtube.com/..., https://vimeo.com/..."
          value={form.videoLinks}
          onChange={set('videoLinks')}
        />
      </div>
    </>
  )
}
