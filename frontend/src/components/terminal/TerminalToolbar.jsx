/**
 * TerminalToolbar — quick-action buttons + cwd breadcrumb + connection status.
 */
import React from 'react'
import { Plus, Search, Settings, Trash2 } from 'lucide-react'

const STATUS_COLOR = {
  connected: '#22c55e',
  connecting: '#eab308',
  disconnected: '#ef4444',
}

function IconBtn({ onClick, title, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] disabled:opacity-30 transition-colors flex-shrink-0"
    >
      {children}
    </button>
  )
}

export default function TerminalToolbar({
  cwd, status, onNewTab, onSplitH, onSplitV, onClear, onSearch, onSettings
}) {
  const dot = STATUS_COLOR[status] || STATUS_COLOR.disconnected
  const shortCwd = cwd
    ? cwd.split('/').filter(Boolean).slice(-2).join('/') || cwd
    : ''

  return (
    <div className="flex items-center gap-1 px-2 h-9 bg-[#1a1a1a] border-b border-[#333] flex-shrink-0">
      <IconBtn onClick={onNewTab} title="New tab (Ctrl+Shift+T)"><Plus size={13} /></IconBtn>

      {/* Split H */}
      <IconBtn onClick={onSplitH} title="Split horizontal (Ctrl+Shift+H)">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
          <rect x="0" y="0" width="5.5" height="13" rx="1" opacity="0.7"/>
          <rect x="7.5" y="0" width="5.5" height="13" rx="1" opacity="0.7"/>
        </svg>
      </IconBtn>

      {/* Split V */}
      <IconBtn onClick={onSplitV} title="Split vertical (Ctrl+Shift+V)">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
          <rect x="0" y="0" width="13" height="5.5" rx="1" opacity="0.7"/>
          <rect x="0" y="7.5" width="13" height="5.5" rx="1" opacity="0.7"/>
        </svg>
      </IconBtn>

      <IconBtn onClick={onClear} title="Clear terminal (Ctrl+L)"><Trash2 size={13} /></IconBtn>
      <IconBtn onClick={onSearch} title="Search (Ctrl+F)"><Search size={13} /></IconBtn>

      {/* CWD breadcrumb */}
      <div className="flex-1 min-w-0 px-2">
        {shortCwd && (
          <span className="text-[10px] text-[#555] truncate block" title={cwd}>
            {shortCwd}
          </span>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dot }}
          title={status}
          aria-label={`Terminal ${status}`}
        />
        <span className="text-[10px] text-[#555] capitalize">{status}</span>
      </div>

      <IconBtn onClick={onSettings} title="Settings"><Settings size={13} /></IconBtn>
    </div>
  )
}
