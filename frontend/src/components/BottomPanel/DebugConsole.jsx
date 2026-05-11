import React, { useState, useEffect, useRef } from 'react'
import { Trash2, Bug, ChevronDown, ChevronRight } from 'lucide-react'

// Global event bus for debug console
const debugListeners = new Set()
export function emitDebugEvent(event) {
  debugListeners.forEach(fn => fn(event))
}

export default function DebugConsole() {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('all') // all, tools, errors, info
  const [expandedIds, setExpandedIds] = useState(new Set())
  const bottomRef = useRef(null)

  useEffect(() => {
    const handler = (event) => {
      setEntries(prev => {
        const next = [...prev, { ...event, id: Date.now() + Math.random(), timestamp: new Date() }]
        return next.slice(-200) // Keep last 200 entries
      })
    }
    debugListeners.add(handler)
    return () => debugListeners.delete(handler)
  }, [])

  // Listen for agent events from chat panel
  useEffect(() => {
    const handler = (e) => {
      const { type, detail } = e
      if (detail) {
        emitDebugEvent({
          type: detail.type || 'info',
          name: detail.name || type,
          message: detail.message || detail.output || JSON.stringify(detail).slice(0, 200),
          args: detail.args,
          output: detail.output,
          duration: detail.duration_ms,
        })
      }
    }
    window.addEventListener('coide:debug', handler)
    return () => window.removeEventListener('coide:debug', handler)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = entries.filter(e => {
    if (filter === 'all') return true
    if (filter === 'tools') return e.type === 'tool_start' || e.type === 'tool_output'
    if (filter === 'errors') return e.type === 'error'
    if (filter === 'info') return e.type === 'info' || e.type === 'text'
    return true
  })

  const getTypeColor = (type) => {
    switch (type) {
      case 'tool_start': return '#e8c07d'
      case 'tool_output': return '#73c991'
      case 'error': return '#f87171'
      case 'info': return '#60a5fa'
      default: return 'var(--text-secondary)'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'tool_start': return 'CALL'
      case 'tool_output': return 'RESULT'
      case 'error': return 'ERROR'
      case 'info': return 'INFO'
      default: return type?.toUpperCase() || 'LOG'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-[11px] rounded px-2 py-0.5 outline-none"
          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <option value="all">All</option>
          <option value="tools">Tool Calls</option>
          <option value="errors">Errors</option>
          <option value="info">Info</option>
        </select>
        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{filtered.length} entries</span>
        <button
          onClick={() => setEntries([])}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
          title="Clear"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bug size={24} className="mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Debug console is active</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Agent tool calls and output will appear here
            </div>
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => toggleExpand(entry.id)}
                className="w-full flex items-start gap-1.5 px-2 py-1 text-left transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {expandedIds.has(entry.id) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </span>
                <span
                  className="flex-shrink-0 px-1 rounded text-[9px] font-bold mt-0.5"
                  style={{ background: getTypeColor(entry.type) + '20', color: getTypeColor(entry.type) }}
                >
                  {getTypeLabel(entry.type)}
                </span>
                <span className="flex-shrink-0 text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {entry.name ? `${entry.name}: ` : ''}{(entry.message || '').slice(0, 100)}
                </span>
                {entry.duration != null && (
                  <span className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {entry.duration}ms
                  </span>
                )}
              </button>
              {expandedIds.has(entry.id) && (
                <div className="px-6 pb-2">
                  {entry.args && (
                    <div className="mb-1">
                      <span className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>Input</span>
                      <pre className="mt-0.5 p-1.5 rounded whitespace-pre-wrap break-all text-[10px]"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                        {typeof entry.args === 'string' ? entry.args : JSON.stringify(entry.args, null, 2)}
                      </pre>
                    </div>
                  )}
                  {entry.output && (
                    <div>
                      <span className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>Output</span>
                      <pre className="mt-0.5 p-1.5 rounded whitespace-pre-wrap break-all text-[10px]"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                        {entry.output.slice(0, 2000)}
                      </pre>
                    </div>
                  )}
                  {!entry.args && !entry.output && (
                    <pre className="p-1.5 rounded whitespace-pre-wrap break-all text-[10px]"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                      {entry.message}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
