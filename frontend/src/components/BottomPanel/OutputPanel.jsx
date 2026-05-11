import React, { useRef, useEffect, useState } from 'react'
import { Trash2, Download } from 'lucide-react'

const CHANNEL_LABELS = { tasks: 'Tasks', git: 'Git', extensions: 'Extensions', agent: 'Agent Log' }

export default function OutputPanel() {
  const [channelLines, setChannelLines] = useState({
    tasks: ['[Output] Ready.'],
    git: [],
    extensions: [],
    agent: [],
  })
  const [channel, setChannel] = useState('agent')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef(null)

  // Listen for agent debug events and pipe them to the Agent Log channel
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {}
      const type = detail.type || 'info'
      const name = detail.name ? `[${detail.name}]` : ''
      const msg = detail.message || detail.output || ''
      const timestamp = new Date().toLocaleTimeString()
      const prefix = type === 'error' ? '❌' : type === 'tool_start' ? '⚡' : type === 'tool_output' ? '✅' : 'ℹ️'
      const line = `${timestamp} ${prefix}${name} ${msg}`.trim()
      setChannelLines(prev => ({
        ...prev,
        agent: [...prev.agent.slice(-499), line],
      }))
      // Switch to agent tab on first activity (only if on tasks)
      setChannel(prev => prev === 'tasks' ? 'agent' : prev)
    }
    window.addEventListener('coide:debug', handler)
    return () => window.removeEventListener('coide:debug', handler)
  }, [])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channelLines, channel, autoScroll])

  const lines = channelLines[channel] || []

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <select
          value={channel}
          onChange={e => setChannel(e.target.value)}
          className="rounded px-2 py-0.5 text-[11px] focus:outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
          }}
        >
          {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setAutoScroll(v => !v)}
          className="text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{ color: autoScroll ? 'var(--accent)' : 'var(--text-secondary)' }}
          title="Toggle auto-scroll"
        >Auto</button>
        <button
          onClick={handleCopy}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
          title="Copy output"
        >
          <Download size={12} />
        </button>
        <button
          onClick={() => setChannelLines(prev => ({ ...prev, [channel]: [] }))}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
          title="Clear"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {lines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No output yet.</div>
        ) : (
          lines.map((l, i) => {
            const isError = l.includes('❌')
            const isSuccess = l.includes('✅')
            const isAction = l.includes('⚡')
            return (
              <div key={i} style={{
                color: isError ? '#f87171' : isSuccess ? '#73c991' : isAction ? '#e8c07d' : 'var(--text-secondary)',
                lineHeight: '1.5',
              }}>
                {l}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
