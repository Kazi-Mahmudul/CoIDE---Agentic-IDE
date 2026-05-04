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
  const [showManual, setShowManual] = useState(false)

  const navigate = useCallback(async (path) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listDirectory(path)
      setCurrentPath(data.path)
      setParent(data.parent)
      setItems(data.items)
      setManualPath(data.path)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    getFilesystemRoots().then(data => {
      setRoots(data.roots || [])
      // Navigate to home directory by default
      const home = navigator.platform.includes('Win')
        ? (data.roots[0]?.path || 'C:/')
        : '/home'
      navigate(home).catch(() => navigate(data.roots[0]?.path || '/'))
    }).catch(() => {})
  }, [open, navigate])

  const handleManualGo = () => {
    if (manualPath.trim()) navigate(manualPath.trim())
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[560px] max-w-[95vw] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c] flex-shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={15} className="text-yellow-400" />
            <span className="text-sm font-semibold text-[#d4d4d4]">Open Folder</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4]">
            <X size={15} />
          </button>
        </div>

        {/* Path bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3c3c3c] flex-shrink-0 bg-[#1e1e1e]">
          <button
            onClick={() => parent && navigate(parent)}
            disabled={!parent}
            className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] disabled:opacity-30 disabled:cursor-default"
            title="Go up"
          >
            <ArrowLeft size={14} />
          </button>
          <input
            type="text"
            value={manualPath}
            onChange={e => setManualPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualGo()}
            placeholder="Type a path and press Enter…"
            className="flex-1 bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 text-xs text-[#d4d4d4] placeholder-[#555] focus:outline-none focus:border-[#007acc]"
          />
          <button
            onClick={handleManualGo}
            className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#d4d4d4] rounded border border-[#555]"
          >
            Go
          </button>
        </div>

        {/* Drive roots */}
        {roots.length > 1 && (
          <div className="flex gap-1 px-4 py-2 border-b border-[#3c3c3c] flex-shrink-0 flex-wrap">
            {roots.map(r => (
              <button
                key={r.path}
                onClick={() => navigate(r.path)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#094771] text-[#d4d4d4] rounded border border-[#555] transition-colors"
              >
                <HardDrive size={11} />
                {r.name}
              </button>
            ))}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8 text-[#555] text-sm">
              Loading…
            </div>
          )}
          {error && (
            <div className="px-4 py-3 text-red-400 text-xs">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="px-4 py-3 text-[#555] text-xs italic">Empty folder</div>
          )}
          {!loading && !error && items.map(item => (
            <button
              key={item.path}
              onClick={() => item.type === 'directory' ? navigate(item.path) : null}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-xs text-left transition-colors
                ${item.type === 'directory'
                  ? 'text-[#d4d4d4] hover:bg-[#2a2d2e] cursor-pointer'
                  : 'text-[#858585] cursor-default'
                }`}
            >
              {item.type === 'directory' ? (
                <>
                  <Folder size={13} className="text-yellow-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.name}</span>
                  <ChevronRight size={11} className="text-[#555] flex-shrink-0" />
                </>
              ) : (
                <>
                  <span className="w-3 flex-shrink-0" />
                  <span className="flex-1 truncate text-[#666]">{item.name}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#3c3c3c] flex-shrink-0 bg-[#1e1e1e]">
          <div className="text-xs text-[#555] truncate flex-1 mr-4">
            {currentPath || 'No folder selected'}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#858585] hover:text-[#d4d4d4] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => currentPath && onSelect(currentPath)}
              disabled={!currentPath}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#007acc] hover:bg-[#0098ff] disabled:bg-[#3c3c3c] disabled:text-[#555] text-white rounded transition-colors"
            >
              <Check size={12} />
              Open Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
