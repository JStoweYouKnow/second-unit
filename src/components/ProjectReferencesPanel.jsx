import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Download, Trash2, Loader2, Shield, FileText } from './icons'
import { contracts as contractsApi } from '../lib/api'
import {
  uploadProjectReference,
  downloadProjectReference,
  isAllowedProjectReferenceFile,
  MAX_PROJECT_REFERENCE_BYTES,
} from '../lib/projectReferences'
import { isSupabaseConfigured } from '../lib/supabase'

export function ProjectReferencesPanel({ contract, isArtist }) {
  const [references, setReferences] = useState([])
  const [canUpload, setCanUpload] = useState(false)
  const [canDownload, setCanDownload] = useState(false)
  const [fullySigned, setFullySigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    if (!contract?.id || !isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await contractsApi.listReferences(contract.id)
      setReferences(Array.isArray(data.references) ? data.references : [])
      setCanUpload(Boolean(data.canUpload))
      setCanDownload(Boolean(data.canDownload))
      setFullySigned(Boolean(data.fullySigned))
    } catch (err) {
      setError(err.message || 'Could not load reference materials')
    } finally {
      setLoading(false)
    }
  }, [contract?.id])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !contract?.id) return
    setError('')
    if (file.size > MAX_PROJECT_REFERENCE_BYTES) {
      setError('Reference file must be 50MB or smaller.')
      return
    }
    if (!isAllowedProjectReferenceFile(file)) {
      setError('File type not allowed for reference materials.')
      return
    }
    setBusy(true)
    try {
      const storagePath = await uploadProjectReference(contract.id, file)
      await contractsApi.addReference(contract.id, {
        storagePath,
        name: file.name,
        mime: file.type || null,
      })
      await load()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (ref) => {
    if (!contract?.id || !ref?.id) return
    setBusy(true)
    setError('')
    try {
      await contractsApi.deleteReference(contract.id, ref.id)
      await load()
    } catch (err) {
      setError(err.message || 'Could not remove reference')
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Shield size={16} aria-hidden />
        <h3 style={{ fontSize: 14, margin: 0, color: 'var(--text-secondary)' }}>Reference materials</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
        {isArtist
          ? fullySigned
            ? 'Confidential brand guidelines and references shared for this project. Download links expire after 5 minutes.'
            : 'Reference files unlock once both parties have signed the project agreement.'
          : 'Upload confidential briefs, brand guidelines, and reference files. The artist can access them after both signatures are collected.'}
      </p>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="animate-spin" /> Loading references…
        </div>
      ) : (
        <>
          {references.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {references.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <FileText size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ref.name}
                  </span>
                  {canDownload && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => downloadProjectReference(ref.storagePath, ref.name)}
                    >
                      <Download size={14} />
                    </button>
                  )}
                  {canUpload && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => handleDelete(ref)}
                      aria-label={`Remove ${ref.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.txt"
                onChange={handleUpload}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload reference
              </button>
            </>
          )}

          {!canUpload && !canDownload && references.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No reference materials yet.</div>
          )}
        </>
      )}

      {error && (
        <div className="auth-error" style={{ marginTop: 10 }} role="alert">{error}</div>
      )}
    </div>
  )
}
