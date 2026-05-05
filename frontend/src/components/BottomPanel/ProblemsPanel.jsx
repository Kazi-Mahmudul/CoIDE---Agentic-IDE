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
          className={`text-[11px] px-2 py-0.5 rounded ${filter === 'all' ? 'bg-[#3a3a3a] text-[#d4d4d4]' : 'text-[#858585] hover:text-[#d4d4d4]'}`}
        >All</button>
        <button
          onClick={() => setFilter('errors')}
          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${filter === 'errors' ? 'bg-[#3a3a3a] text-[#d4d4d4]' : 'text-[#858585] hover:text-[#d4d4d4]'}`}
        >
          <AlertCircle size={11} className="text-red-400" /> {errors}
        </button>
        <button
          onClick={() => setFilter('warnings')}
          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${filter === 'warnings' ? 'bg-[#3a3a3a] text-[#d4d4d4]' : 'text-[#858585] hover:text-[#d4d4d4]'}`}
        >
          <AlertTriangle size={11} className="text-yellow-400" /> {warnings}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-[#555]">
            No problems detected
          </div>
        ) : (
          filtered.map((m, i) => (
            <button
              key={i}
              onClick={() => onGoToLine?.(m.resource?.path, m.startLineNumber)}
              className="w-full flex items-start gap-2 px-3 py-1.5 text-xs text-left hover:bg-[#2a2d2e]"
            >
              {m.severity === 8
                ? <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                : m.severity === 4
                  ? <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  : <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-[#cccccc] truncate">{m.message}</div>
                <div className="text-[#858585] text-[10px]">
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
