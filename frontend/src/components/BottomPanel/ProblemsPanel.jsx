import React, { useState } from 'react'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

export default function ProblemsPanel({ markers = [], onGoToLine }) {
  const [filter, setFilter] = useState('all')

  const filtered = markers.filter(m => {
    if (filter === 'errors') return m.severity === 8
    if (filter === 'warnings') return m.severity === 4
    return true
  })

  const errors = markers.filter(m => m.severity === 8).length
  const warnings = markers.filter(m => m.severity === 4).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-[#333] flex-shrink-0">
        <button
          onClick={() => setFilter('all')}
          className="text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{
            background: filter === 'all' ? 'var(--bg-selected)' : 'transparent',
            color: filter === 'all' ? 'var(--text-bright)' : 'var(--text-secondary)',
          }}
        >All</button>
        <button
          onClick={() => setFilter('errors')}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{
            background: filter === 'errors' ? 'var(--bg-selected)' : 'transparent',
            color: filter === 'errors' ? 'var(--text-bright)' : 'var(--text-secondary)',
          }}
        >
          <AlertCircle size={11} className="text-red-400" /> {errors}
        </button>
        <button
          onClick={() => setFilter('warnings')}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{
            background: filter === 'warnings' ? 'var(--bg-selected)' : 'transparent',
            color: filter === 'warnings' ? 'var(--text-bright)' : 'var(--text-secondary)',
          }}
        >
          <AlertTriangle size={11} className="text-yellow-400" /> {warnings}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>
            No problems detected
          </div>
        ) : (
          filtered.map((m, i) => (
            <button
              key={i}
              onClick={() => onGoToLine?.(m.resource?.path, m.startLineNumber)}
              className="w-full flex items-start gap-2 px-3 py-1.5 text-xs text-left transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {m.severity === 8
                ? <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                : m.severity === 4
                  ? <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  : <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ color: 'var(--text-primary)' }}>{m.message}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  {m.resource?.path?.split('/').pop()} Ln {m.startLineNumber}, Col {m.startColumn}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
