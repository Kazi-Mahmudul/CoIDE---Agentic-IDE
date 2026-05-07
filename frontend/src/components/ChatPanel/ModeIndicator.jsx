import React from 'react'
import { Zap, MessageSquare } from 'lucide-react'

export default function ModeIndicator({ mode, streaming }) {
  if (!mode) return null
  const isAgent = mode === 'agent'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0
      ${isAgent
        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}
      ${streaming ? 'animate-pulse' : ''}`}
    >
      {isAgent ? <Zap size={9} /> : <MessageSquare size={9} />}
      {mode}
    </span>
  )
}
