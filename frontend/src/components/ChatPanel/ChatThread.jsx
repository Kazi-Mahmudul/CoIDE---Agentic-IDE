import React, { useState } from 'react'
import { Plus, Trash2, Pin, Download, MessageSquare, Zap } from 'lucide-react'
import { useChatStore } from '../../store/useChatStore.js'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

function exportThread(thread) {
  const lines = [`# ${thread.title}`, `*${new Date(thread.createdAt).toLocaleString()}*`, '']
  for (const msg of thread.messages) {
    if (msg.role === 'user') lines.push(`**You:** ${msg.content}`, '')
    else if (msg.role === 'assistant') lines.push(`**Assistant:** ${msg.content || ''}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${thread.title.replace(/[^a-z0-9]/gi, '_')}.md`
  a.click(); URL.revokeObjectURL(url)
}

export default function ChatThread({ onClose }) {
  const { threads, activeThreadId, newThread, switchThread, deleteThread, renameThread, pinThread, getSortedThreads } = useChatStore()
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')

  const sorted = getSortedThreads()

  return (
    <div className="absolute inset-0 z-30 bg-[#1e1e1e] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] flex-shrink-0">
        <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Threads</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { newThread(); onClose() }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#007acc] hover:bg-[#0098ff] text-white rounded transition-colors"
          >
            <Plus size={11} /> New
          </button>
          <button onClick={onClose} className="p-1 text-[#555] hover:text-[#d4d4d4] transition-colors text-lg leading-none">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.map(thread => (
          <div
            key={thread.id}
            className={`group flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-[#2a2a2a] transition-colors ${
              thread.id === activeThreadId ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'
            }`}
            onClick={() => { switchThread(thread.id); onClose() }}
          >
            {/* Mode icon */}
            <div className="mt-0.5 flex-shrink-0">
              {thread.mode === 'agent'
                ? <Zap size={12} className="text-orange-400" />
                : <MessageSquare size={12} className="text-blue-400" />
              }
            </div>

            <div className="flex-1 min-w-0">
              {editingId === thread.id ? (
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => { renameThread(thread.id, editVal); setEditingId(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { renameThread(thread.id, editVal); setEditingId(null) } if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="w-full bg-transparent border-b border-[#007acc] outline-none text-xs text-[#d4d4d4]"
                />
              ) : (
                <div
                  className="text-xs text-[#cccccc] truncate"
                  onDoubleClick={e => { e.stopPropagation(); setEditingId(thread.id); setEditVal(thread.title) }}
                >
                  {thread.pinned && <Pin size={9} className="inline mr-1 text-yellow-400" />}
                  {thread.title}
                </div>
              )}
              <div className="text-[10px] text-[#555] mt-0.5">
                {thread.messages.length} messages · {formatTime(thread.updatedAt)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); pinThread(thread.id) }}
                className="p-0.5 text-[#555] hover:text-yellow-400 transition-colors" title="Pin">
                <Pin size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); exportThread(thread) }}
                className="p-0.5 text-[#555] hover:text-[#858585] transition-colors" title="Export">
                <Download size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); deleteThread(thread.id) }}
                className="p-0.5 text-[#555] hover:text-red-400 transition-colors" title="Delete">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
