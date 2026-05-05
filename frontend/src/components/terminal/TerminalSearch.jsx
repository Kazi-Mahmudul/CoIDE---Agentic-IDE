/**
 * TerminalSearch — floating search bar with case/word/regex toggles.
 * NOTE: This component renders a plain card with no absolute positioning.
 * The parent (Terminal.jsx) wraps it in an absolute-positioned div inside
 * the pane area, so it always appears inside the terminal panel.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'

export default function TerminalSearch({ onSearch, onClose }) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const opts = { caseSensitive, wholeWord, regex }

  const findNext = useCallback(() => {
    if (query) onSearch(query, opts, 'next')
  }, [query, opts, onSearch])

  const findPrev = useCallback(() => {
    if (query) onSearch(query, opts, 'prev')
  }, [query, opts, onSearch])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext() }
    if (e.key === 'Escape') onClose()
  }

  const ToggleBtn = ({ active, onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
        active ? 'bg-[#007acc] text-white' : 'text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a]'
      }`}
    >
      {children}
    </button>
  )

  // Plain card — no absolute wrapper. Parent positions this.
  return (
    <div className="bg-[#252526] border border-[#555] rounded-lg shadow-2xl w-72 p-2">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in terminal…"
          className="flex-1 bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 text-xs text-[#d4d4d4] placeholder-[#555] focus:outline-none focus:border-[#007acc]"
        />
        <ToggleBtn active={caseSensitive} onClick={() => setCaseSensitive(v => !v)} title="Match case">Aa</ToggleBtn>
        <ToggleBtn active={wholeWord} onClick={() => setWholeWord(v => !v)} title="Whole word">W</ToggleBtn>
        <ToggleBtn active={regex} onClick={() => setRegex(v => !v)} title="Use regex">.*</ToggleBtn>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex gap-1">
          <button onClick={findPrev} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4]" title="Previous (Shift+Enter)">
            <ChevronUp size={13} />
          </button>
          <button onClick={findNext} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4]" title="Next (Enter)">
            <ChevronDown size={13} />
          </button>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4]" title="Close (Escape)">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
