import React, { useRef, useEffect, useState } from 'react'
import { FileText, Folder, Globe, AlertTriangle, Terminal, Scissors, Database } from 'lucide-react'

const OPTIONS = [
  { id: 'file',      icon: FileText,      label: '@file',      desc: 'Attach a file from workspace' },
  { id: 'folder',    icon: Folder,        label: '@folder',    desc: 'Attach entire folder contents' },
  { id: 'web',       icon: Globe,         label: '@web',       desc: 'Fetch and attach a URL' },
  { id: 'git',       icon: Database,      label: '@git',       desc: 'Attach git diff / log' },
  { id: 'problems',  icon: AlertTriangle, label: '@problems',  desc: 'Attach current errors/warnings' },
  { id: 'terminal',  icon: Terminal,      label: '@terminal',  desc: 'Attach terminal output' },
  { id: 'selection', icon: Scissors,      label: '@selection', desc: 'Attach current editor selection' },
  { id: 'codebase',  icon: Database,      label: '@codebase',  desc: 'Attach full codebase summary' },
  { id: 'docs',      icon: FileText,      label: '@docs',      desc: 'Attach markdown/docs files' },
]

export default function ContextPicker({ onSelect, onClose, filter = '' }) {
  const ref = useRef(null)
  const [selected, setSelected] = useState(0)

  const filtered = OPTIONS.filter(o =>
    !filter || o.id.includes(filter.toLowerCase()) || o.label.includes(filter.toLowerCase())
  )

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
      className="absolute bottom-full left-0 mb-1 w-64 bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden z-50"
    >
      <div className="px-3 py-1.5 border-b border-[#333] text-[10px] text-[#555] uppercase tracking-wider">
        Add Context
      </div>
      {filtered.map((opt, i) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
            i === selected ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
          }`}
        >
          <opt.icon size={13} className={i === selected ? 'text-white' : 'text-[#858585]'} />
          <div>
            <div className="font-medium">{opt.label}</div>
            <div className={`text-[10px] ${i === selected ? 'text-[#aaa]' : 'text-[#555]'}`}>{opt.desc}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
