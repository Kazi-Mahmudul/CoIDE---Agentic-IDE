import React, { useState } from 'react'
import { Check, X, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { writeFile } from '../../api.js'

function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n')
  const newLines = (newText || '').split('\n')
  const result = []
  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length)
  let added = 0, removed = 0
  // Use LCS-based approach for better diffs
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  // Simple: show removed then added
  for (const line of oldLines) {
    if (!newLines.includes(line)) {
      result.push({ type: 'removed', text: line })
      removed++
    }
  }
  for (const line of newLines) {
    if (!oldLines.includes(line)) {
      result.push({ type: 'added', text: line })
      added++
    }
  }
  // If no diff detected (same content), show as context
  if (result.length === 0) {
    newLines.slice(0, 5).forEach(l => result.push({ type: 'context', text: l }))
  }
  return { lines: result, added, removed }
}

export default function DiffBlock({ path, oldContent, newContent, onOpenFile, onApplied }) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(true)

  if (dismissed) return null

  const { lines, added, removed } = computeDiff(oldContent, newContent)
  const filename = path ? path.split('/').pop() : 'file'

  const handleApply = async () => {
    if (!path || !newContent) return
    setApplying(true)
    try {
      await writeFile(path, newContent)
      setApplied(true)
      toast.success(`Applied changes to ${filename}`)
      onApplied?.(path, newContent)
    } catch (e) {
      toast.error(`Apply failed: ${e.message}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="my-2 rounded border border-[#333] overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] border-b border-[#333]">
        <button onClick={() => setExpanded(e => !e)} className="text-[#555] hover:text-[#858585]">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <span className="font-mono text-[#cccccc] flex-1 truncate">{path || 'unknown'}</span>
        <span className="text-green-400">+{added}</span>
        <span className="text-red-400 ml-1">-{removed}</span>
        <div className="flex items-center gap-1 ml-2">
          {!applied ? (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1 px-2 py-0.5 bg-green-700/40 hover:bg-green-700/60 text-green-300 rounded transition-colors disabled:opacity-50"
            >
              {applying ? <span className="animate-spin">⟳</span> : <Check size={10} />}
              Apply
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 text-green-400">
              <Check size={10} /> Applied
            </span>
          )}
          {onOpenFile && (
            <button
              onClick={() => onOpenFile(path)}
              className="p-0.5 text-[#555] hover:text-[#858585] transition-colors"
              title="Open in editor"
            >
              <ExternalLink size={11} />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 text-[#555] hover:text-red-400 transition-colors"
            title="Dismiss"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Diff lines */}
      {expanded && (
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`px-3 py-0 font-mono text-[11px] leading-5 whitespace-pre ${
                line.type === 'added' ? 'bg-green-950/40 text-green-300' :
                line.type === 'removed' ? 'bg-red-950/40 text-red-300' :
                'text-[#555]'
              }`}
            >
              <span className="select-none mr-2 text-[#444]">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
