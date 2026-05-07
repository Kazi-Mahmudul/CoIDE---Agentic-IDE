import React, { useState, useEffect, useRef } from 'react'
import { FileText, Search } from 'lucide-react'

export default function FilePicker({ tree = [], onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)

  // Flatten tree
  const allFiles = []
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'file') allFiles.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(tree)

  const filtered = query
    ? allFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
    : allFiles.slice(0, 20)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [])

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) onSelect(filtered[selected]) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [filtered, selected, onSelect, onClose])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1 w-72 bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden z-50"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#333]">
        <Search size={12} className="text-[#555]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(0) }}
          placeholder="Search files…"
          className="flex-1 bg-transparent text-xs text-[#d4d4d4] placeholder-[#555] outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-[#555]">No files found</div>
        ) : filtered.map((f, i) => (
          <button
            key={f.path}
            onClick={() => onSelect(f)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              i === selected ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
            }`}
          >
            <FileText size={11} className={i === selected ? 'text-white' : 'text-[#858585]'} />
            <div className="min-w-0">
              <div className="font-medium truncate">{f.name}</div>
              <div className={`text-[10px] truncate ${i === selected ? 'text-[#aaa]' : 'text-[#555]'}`}>{f.path}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
