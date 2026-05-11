import React, { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, ChevronRight, HardDrive, X, ArrowLeft, Check } from 'lucide-react'
import { listDirectory, getFilesystemRoots } from '../api.js'

export default function FolderPicker({ open, onClose, onSelect }) {
  const [currentPath, setCurrentPath] = useState(null)
  const [items, setItems] = useState([])
  const [parent, setParent] = useState(null)
  const [roots, setRoots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [manualPath, setManualPath] = useState('')

  const navigate = useCallback(async (path) => {
    setLoading(true); setError(null)
    try {
      const data = await listDirectory(path)
      setCurrentPath(data.path); setParent(data.parent)
      setItems(data.items); setManualPath(data.path)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!open) return
    getFilesystemRoots().then(data => {
      setRoots(data.roots || [])
      const home = navigator.platform.includes('Win') ? (data.roots[0]?.path || 'C:/') : '/home'
      navigate(home).catch(() => navigate(data.roots[0]?.path || '/'))
    }).catch(() => {})
  }, [open, navigate])

  if (!open) return null

  const s = {
    bg: 'var(--bg-panel)', border: 'var(--border-light)',
    text: 'var(--text-primary)', muted: 'var(--text-muted)',
    input: 'var(--bg-input)', hover: 'var(--bg-hover)',
    accent: 'var(--accent)',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-lg shadow-2xl w-[560px] max-w-[95vw] flex flex-col max-h-[80vh]"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${s.border}` }}>
          <div className="flex items-center gap-2">
            <FolderOpen size={15} className="text-yellow-400" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>Open Folder</span>
          </div>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: s.muted }}
            onMouseEnter={e => e.currentTarget.style.background = s.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={15} />
          </button>
        </div>

        {/* Path bar */}
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: 'var(--bg-app)', borderBottom: `1px solid ${s.border}` }}>
          <button onClick={() => parent && navigate(parent)} disabled={!parent}
            className="p-1 rounded transition-colors disabled:opacity-30" style={{ color: s.muted }}
            onMouseEnter={e => e.currentTarget.style.background = s.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ArrowLeft size={14} />
          </button>
          <input type="text" value={manualPath} onChange={e => setManualPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(manualPath.trim())}
            placeholder="Type a path and press Enter…"
            className="flex-1 rounded px-2 py-1 text-xs outline-none"
            style={{ background: s.input, border: `1px solid ${s.border}`, color: 'var(--text-bright)' }}
            onFocus={e => e.target.style.borderColor = s.accent}
            onBlur={e => e.target.style.borderColor = s.border} />
          <button onClick={() => navigate(manualPath.trim())}
            className="px-2 py-1 text-xs rounded transition-colors"
            style={{ background: s.input, border: `1px solid ${s.border}`, color: s.text }}>
            Go
          </button>
        </div>

        {/* Drive roots */}
        {roots.length > 1 && (
          <div className="flex gap-1 px-4 py-2 flex-shrink-0 flex-wrap"
            style={{ borderBottom: `1px solid ${s.border}` }}>
            {roots.map(r => (
              <button key={r.path} onClick={() => navigate(r.path)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
                style={{ background: s.input, border: `1px solid ${s.border}`, color: s.text }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-selected)'}
                onMouseLeave={e => e.currentTarget.style.background = s.input}>
                <HardDrive size={11} />{r.name}
              </button>
            ))}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && <div className="flex items-center justify-center py-8 text-sm" style={{ color: s.muted }}>Loading…</div>}
          {error && <div className="px-4 py-3 text-xs text-red-400">{error}</div>}
          {!loading && !error && items.length === 0 && <div className="px-4 py-3 text-xs italic" style={{ color: s.muted }}>Empty folder</div>}
          {!loading && !error && items.map(item => (
            <button key={item.path}
              onClick={() => item.type === 'directory' ? navigate(item.path) : null}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-left transition-colors"
              style={{ color: item.type === 'directory' ? s.text : s.muted, cursor: item.type === 'directory' ? 'pointer' : 'default' }}
              onMouseEnter={e => { if (item.type === 'directory') e.currentTarget.style.background = s.hover }}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.type === 'directory' ? (
                <><Folder size={13} className="text-yellow-400 flex-shrink-0" /><span className="flex-1 truncate">{item.name}</span><ChevronRight size={11} style={{ color: s.muted }} /></>
              ) : (
                <><span className="w-3 flex-shrink-0" /><span className="flex-1 truncate" style={{ color: s.muted }}>{item.name}</span></>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${s.border}`, background: 'var(--bg-app)' }}>
          <div className="text-xs truncate flex-1 mr-4" style={{ color: s.muted }}>{currentPath || 'No folder selected'}</div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-3 py-1.5 text-xs transition-colors" style={{ color: s.muted }}
              onMouseEnter={e => e.currentTarget.style.color = s.text}
              onMouseLeave={e => e.currentTarget.style.color = s.muted}>Cancel</button>
            <button onClick={() => currentPath && onSelect(currentPath)} disabled={!currentPath}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded transition-colors disabled:opacity-40"
              style={{ background: s.accent }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = s.accent}>
              <Check size={12} />Open Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
