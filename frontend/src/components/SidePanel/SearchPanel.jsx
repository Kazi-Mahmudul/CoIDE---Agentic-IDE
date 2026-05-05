import React, { useState, useCallback } from 'react'
import { Search, CaseSensitive, WholeWord, Regex, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useIDEStore } from '../../store/useIDEStore.js'

const BASE = 'http://localhost:8000'

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
      const res = await fetch(`${BASE}/files/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      toast.error(`Search failed: ${e.message}`)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') doSearch(query)
  }

  const toggleFile = (path) => setExpanded(p => ({ ...p, [path]: !p[path] }))

  // Group results by file
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  const ToggleBtn = ({ active, onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors
        ${active ? 'bg-[#007acc] text-white' : 'text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a]'}`}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#333]">
        <div className="flex items-center gap-1 bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 focus-within:border-[#007acc]">
          <Search size={12} className="text-[#858585] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search"
            className="flex-1 bg-transparent text-xs text-[#d4d4d4] placeholder-[#555] outline-none"
          />
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <ToggleBtn active={caseSensitive} onClick={() => setCaseSensitive(v => !v)} title="Match Case">Aa</ToggleBtn>
          <ToggleBtn active={wholeWord} onClick={() => setWholeWord(v => !v)} title="Whole Word">W</ToggleBtn>
          <ToggleBtn active={useRegex} onClick={() => setUseRegex(v => !v)} title="Use Regex">.*</ToggleBtn>
          <div className="flex-1" />
          {results.length > 0 && (
            <span className="text-[10px] text-[#858585]">{results.length} results</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-4 py-3 text-xs text-[#555]">Searching…</div>
        )}
        {!loading && Object.keys(grouped).length === 0 && query && (
          <div className="px-4 py-3 text-xs text-[#555]">No results for "{query}"</div>
        )}
        {Object.entries(grouped).map(([file, matches]) => (
          <div key={file}>
            <button
              onClick={() => toggleFile(file)}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs text-[#cccccc] hover:bg-[#2a2d2e] text-left"
            >
              {expanded[file] !== false ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span className="truncate flex-1">{file.split('/').pop()}</span>
              <span className="text-[#858585] text-[10px] ml-1">{matches.length}</span>
            </button>
            {expanded[file] !== false && matches.map((m, i) => (
              <button
                key={i}
                onClick={() => onFileOpen?.(file, m.line)}
                className="w-full flex items-start gap-2 px-4 py-0.5 text-[11px] text-[#858585] hover:bg-[#2a2d2e] text-left"
              >
                <span className="text-[#555] flex-shrink-0 w-8 text-right">{m.line}</span>
                <span className="truncate">{m.text?.trim()}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
