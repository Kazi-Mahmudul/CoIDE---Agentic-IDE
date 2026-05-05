import React, { useRef, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function OutputPanel() {
  const [lines, setLines] = useState(['[Output] Ready.'])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, autoScroll])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-[#333] flex-shrink-0">
        <select className="bg-[#3c3c3c] border border-[#555] rounded px-2 py-0.5 text-[11px] text-[#d4d4d4] focus:outline-none">
          <option>Tasks</option>
          <option>Git</option>
          <option>Extensions</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setAutoScroll(v => !v)}
          className={`text-[11px] px-2 py-0.5 rounded ${autoScroll ? 'text-[#007acc]' : 'text-[#858585]'} hover:text-[#d4d4d4]`}
          title="Toggle auto-scroll"
        >Auto</button>
        <button
          onClick={() => setLines([])}
          className="p-1 rounded text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a]"
          title="Clear"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] text-[#cccccc]">
        {lines.map((l, i) => <div key={i}>{l}</div>)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
