import React, { useState, useCallback } from 'react'
import { Search, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { searchWorkspace } from '../../api.js'

export default function SearchPanel({ onFileOpen }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [expanded, setExpanded] = useState({})

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const data = await searchWorkspace(q, { caseSensitive, wholeWord, useRegex })
      setResults(data.results || [])
      // Auto-expand all files
      const exp = {}
      ;(data.results || []).forEach(r => { exp[r.file] = true })
      setExpanded(exp)
    } catch (e) {
      toast.error(`Search failed: ${e.message}`)
      setResults([])
    } finally { setLoading(false) }
  }, [caseSensitive, wholeWord, useRegex])

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  const ToggleBtn = ({ active, onClick, title, children }) => (
    <button onClick={onClick} title={title}
      className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
      style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1 rounded px-2 py-1"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-light)'}>
          <Search size={12} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            placeholder="Search (Enter to search)"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-bright)' }} />
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <ToggleBtn active={caseSensitive} onClick={() => setCaseSensitive(v => !v)} title="Match Case">Aa</ToggleBtn>
          <ToggleBtn active={wholeWord} onClick={() => setWholeWord(v => !v)} title="Whole Word">W</ToggleBtn>
          <ToggleBtn active={useRegex} onClick={() => setUseRegex(v => !v)} title="Use Regex">.*</ToggleBtn>
          <div className="flex-1" />
          {results.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{results.length} results</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</div>}
        {!loading && Object.keys(grouped).length === 0 && query && (
          <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No results for "{query}"</div>
        )}
        {Object.entries(grouped).map(([file, matches]) => (
          <div key={file}>
            <button
              onClick={() => setExpanded(p => ({ ...p, [file]: !p[file] }))}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs text-left transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {expanded[file] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span className="truncate flex-1">{file.split('/').pop()}</span>
              <span className="text-[10px] ml-1" style={{ color: 'var(--text-secondary)' }}>{matches.length}</span>
            </button>
            {expanded[file] && matches.map((m, i) => (
              <button key={i}
                onClick={() => onFileOpen?.(file, m.line)}
                className="w-full flex items-start gap-2 px-4 py-0.5 text-[11px] text-left transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="flex-shrink-0 w-8 text-right" style={{ color: 'var(--text-muted)' }}>{m.line}</span>
                <span className="truncate">{m.text?.trim()}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
