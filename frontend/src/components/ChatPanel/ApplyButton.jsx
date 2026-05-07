import React, { useState } from 'react'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'

const BASE = 'http://localhost:8000'

export default function ApplyButton({ code, targetFile, activeFilePath, onApplied }) {
  const [state, setstate] = useState('idle') // idle | applying | done
  const [prevContent, setPrevContent] = useState(null)
  const [undoTimer, setUndoTimer] = useState(null)

  const filePath = targetFile || activeFilePath
  if (!filePath || !code) return null

  const handleApply = async () => {
    setstate('applying')
    try {
      // Read current content for undo
      const readRes = await fetch(`${BASE}/files/read?path=${encodeURIComponent(filePath)}`)
      if (readRes.ok) {
        const data = await readRes.json()
        setPrevContent(data.content)
      }
      // Write new content
      const res = await fetch(`${BASE}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: code }),
      })
      if (!res.ok) throw new Error(await res.text())
      setstate('done')
      toast.success(`Applied to ${filePath.split('/').pop()}`)
      onApplied?.(filePath, code)
      // Auto-reset undo after 10s
      const t = setTimeout(() => { setstate('idle'); setPrevContent(null) }, 10000)
      setUndoTimer(t)
    } catch (e) {
      toast.error(`Apply failed: ${e.message}`)
      setstate('idle')
    }
  }

  const handleUndo = async () => {
    if (!prevContent) return
    clearTimeout(undoTimer)
    try {
      await fetch(`${BASE}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: prevContent }),
      })
      toast.success('Undone')
      setstate('idle')
      setPrevContent(null)
      onApplied?.(filePath, prevContent)
    } catch (e) {
      toast.error(`Undo failed: ${e.message}`)
    }
  }

  const label = filePath ? `Apply to ${filePath.split('/').pop()}` : 'Apply to active file'

  if (state === 'done') {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-green-400 text-[10px]">
          <Check size={10} /> Applied
        </span>
        {prevContent && (
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 text-[10px] text-[#858585] hover:text-[#d4d4d4] transition-colors ml-1"
          >
            <RotateCcw size={9} /> Undo
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleApply}
      disabled={state === 'applying'}
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#007acc]/20 hover:bg-[#007acc]/40 text-[#007acc] border border-[#007acc]/30 rounded transition-colors disabled:opacity-50"
    >
      {state === 'applying' ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
      {label}
    </button>
  )
}
