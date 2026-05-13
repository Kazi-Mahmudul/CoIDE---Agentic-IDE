import React, { useState } from 'react'
import { RotateCcw, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { authHeaders, BASE } from '../../api.js'

export default function CheckpointBar({ checkpointId, filesChanged = [], onRestored, onOpenFile }) {
  const [restoring, setRestoring] = useState(false)
  const [restored, setRestored] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleUndo = async () => {
    if (!checkpointId) return
    setRestoring(true)
    try {
      const res = await fetch(`${BASE}/chat/checkpoint/${checkpointId}/restore`, { method: 'POST', headers: authHeaders() })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRestored(true)
      toast.success(`Reverted ${data.restored_files?.length || 0} files`)
      onRestored?.(data.restored_files)
    } catch (e) {
      toast.error(`Undo failed: ${e.message}`)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="mt-2 rounded border border-[#333] bg-[#1a1a1a] text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Check size={11} className="text-green-400 flex-shrink-0" />
        <span className="text-[#858585]">Checkpoint saved</span>
        <span className="text-[#555]">·</span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[#007acc] hover:underline flex items-center gap-0.5"
        >
          {filesChanged.length} file{filesChanged.length !== 1 ? 's' : ''} changed
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <div className="flex-1" />
        {!restored ? (
          <button
            onClick={handleUndo}
            disabled={restoring}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#cccccc] rounded transition-colors disabled:opacity-50"
          >
            <RotateCcw size={10} className={restoring ? 'animate-spin' : ''} />
            Undo All
          </button>
        ) : (
          <span className="text-green-400 flex items-center gap-1">
            <Check size={10} /> Reverted
          </span>
        )}
      </div>
      {expanded && filesChanged.length > 0 && (
        <div className="px-3 pb-2 border-t border-[#333] flex flex-wrap gap-1 pt-1.5">
          {filesChanged.map(f => (
            <button
              key={f}
              onClick={() => onOpenFile?.(f)}
              className="px-2 py-0.5 bg-[#252526] hover:bg-[#2a2d2e] text-[#007acc] rounded font-mono text-[10px] transition-colors"
            >
              {f.split('/').pop()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
