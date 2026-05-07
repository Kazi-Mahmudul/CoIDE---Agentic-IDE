import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'

export default function AgentThinkingCard({ content }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return null
  return (
    <div className="my-1.5 rounded border border-purple-800/30 bg-purple-950/20 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
      >
        <Brain size={12} className="text-purple-400 flex-shrink-0" />
        <span className="text-purple-300 font-medium">Thinking</span>
        <span className="flex-shrink-0 text-[#555] ml-auto">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-purple-800/20">
          <p className="mt-1.5 text-[#858585] italic text-[11px] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      )}
    </div>
  )
}
