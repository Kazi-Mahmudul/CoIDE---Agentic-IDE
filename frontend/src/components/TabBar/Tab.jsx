import React, { useState, useRef, useEffect } from 'react'
import { X, Circle } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'

const EXT_COLORS = {
  js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  py: '#3572a5', json: '#f7df1e', md: '#083fa1', css: '#563d7c',
  html: '#e34c26', sh: '#89e051', yml: '#cb171e', yaml: '#cb171e',
  rs: '#dea584', go: '#00add8', java: '#b07219', rb: '#701516',
}

function FileIcon({ path, size = 12 }) {
  const ext = path?.split('.').pop()?.toLowerCase()
  const color = EXT_COLORS[ext] || 'var(--text-secondary)'
  return (
    <span
      className="inline-block rounded-sm flex-shrink-0"
      style={{ width: size, height: size, background: color, opacity: 0.85 }}
    />
  )
}

export default function Tab({ file, isActive, onDragStart, onDragOver, onDrop }) {
  const { setActiveFile, closeFile } = useIDEStore()
  const [contextMenu, setContextMenu] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!contextMenu) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setContextMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [contextMenu])

  const handleMiddleClick = (e) => {
    if (e.button === 1) { e.preventDefault(); closeFile(file.id) }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0 h-full">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, file.id)}
        onDragOver={(e) => onDragOver(e, file.id)}
        onDrop={(e) => onDrop(e, file.id)}
        onClick={() => setActiveFile(file.id)}
        onMouseDown={handleMiddleClick}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        className="flex items-center gap-1.5 px-3 h-full text-[13px] cursor-pointer select-none group transition-colors"
        style={{
          background: isActive ? 'var(--bg-tab-active)' : 'var(--bg-tab-inactive)',
          color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)',
          borderRight: '1px solid var(--border)',
          borderTop: isActive ? `2px solid var(--accent)` : '2px solid transparent',
          minWidth: 80,
          maxWidth: 200,
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-tab-inactive)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
      >
        <FileIcon path={file.path} />
        {file.modified && (
          <Circle size={7} className="text-[#e8c07d] fill-[#e8c07d] flex-shrink-0" />
        )}
        <span className="truncate flex-1">{file.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); closeFile(file.id) }}
          className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <X size={11} />
        </button>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 rounded shadow-xl py-1 text-[13px]"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 180, background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
        >
          {[
            ['Close', () => closeFile(file.id)],
            ['Close Others', () => useIDEStore.getState().openFiles.filter(f => f.id !== file.id).forEach(f => closeFile(f.id))],
            ['Close All', () => useIDEStore.getState().openFiles.forEach(f => closeFile(f.id))],
          ].map(([label, action]) => (
            <button
              key={label}
              onClick={() => { setContextMenu(null); action() }}
              className="w-full text-left px-3 py-1 transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-selected)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {label}
            </button>
          ))}
          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
          <button
            onClick={() => { setContextMenu(null); navigator.clipboard.writeText(file.path) }}
            className="w-full text-left px-3 py-1 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-selected)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Copy Path
          </button>
        </div>
      )}
    </div>
  )
}
