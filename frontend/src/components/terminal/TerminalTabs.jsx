/**
 * TerminalTabs — tab bar with add, close, rename, drag-reorder, context menu.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'

function TabContextMenu({ x, y, tabId, tabs, onClose, onCloseTab, onCloseOthers, onCloseAll, onDuplicate }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-xl py-1 min-w-[160px] text-xs"
      style={{ left: x, top: y, background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
    >
      <button onClick={() => { onCloseTab(tabId); onClose() }} className="w-full text-left px-3 py-1.5 transition-colors" style={{ color: 'var(--text-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-selected)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Close</button>
      <button onClick={() => { onCloseOthers(tabId); onClose() }} className="w-full text-left px-3 py-1.5 transition-colors" style={{ color: 'var(--text-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-selected)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Close Others</button>
      <button onClick={() => { onCloseAll(); onClose() }} className="w-full text-left px-3 py-1.5 transition-colors" style={{ color: 'var(--text-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-selected)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Close All</button>
      <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
      <button onClick={() => { onDuplicate(tabId); onClose() }} className="w-full text-left px-3 py-1.5 transition-colors" style={{ color: 'var(--text-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-selected)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Duplicate</button>
    </div>
  )
}

export default function TerminalTabs({
  tabs, activeTabId, onSwitch, onAdd, onClose, onRename, onSplitH, onSplitV
}) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [tabOrder, setTabOrder] = useState(() => tabs.map(t => t.id))
  const dragSrc = useRef(null)

  // Keep tabOrder in sync with tabs
  useEffect(() => {
    setTabOrder(prev => {
      const existing = new Set(prev)
      const newIds = tabs.map(t => t.id).filter(id => !existing.has(id))
      const removed = prev.filter(id => tabs.some(t => t.id === id))
      return [...removed, ...newIds]
    })
  }, [tabs])

  const orderedTabs = tabOrder.map(id => tabs.find(t => t.id === id)).filter(Boolean)

  const handleDblClick = (tab) => {
    setEditingId(tab.id)
    setEditValue(tab.label)
  }

  const commitRename = () => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim())
    setEditingId(null)
  }

  const handleContextMenu = (e, tabId) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  const closeOthers = (keepId) => {
    tabs.filter(t => t.id !== keepId).forEach(t => onClose(t.id))
  }

  const closeAll = () => {
    if (tabs.length > 1) tabs.slice(1).forEach(t => onClose(t.id))
  }

  const duplicate = (tabId) => {
    onAdd()
  }

  // Drag reorder
  const onDragStart = (e, id) => { dragSrc.current = id; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (e, id) => { e.preventDefault(); setDragOver(id) }
  const onDrop = (e, id) => {
    e.preventDefault()
    if (!dragSrc.current || dragSrc.current === id) { setDragOver(null); return }
    setTabOrder(prev => {
      const arr = [...prev]
      const from = arr.indexOf(dragSrc.current)
      const to = arr.indexOf(id)
      arr.splice(from, 1)
      arr.splice(to, 0, dragSrc.current)
      return arr
    })
    setDragOver(null)
    dragSrc.current = null
  }

  const visibleTabs = orderedTabs.slice(0, 8)
  const overflowTabs = orderedTabs.slice(8)

  return (
    <div className="flex items-center h-9 flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-end h-full overflow-x-auto flex-1 min-w-0 scrollbar-none">
        {visibleTabs.map(tab => (
          <div
            key={tab.id}
            draggable
            onDragStart={e => onDragStart(e, tab.id)}
            onDragOver={e => onDragOver(e, tab.id)}
            onDrop={e => onDrop(e, tab.id)}
            onDragLeave={() => setDragOver(null)}
            onContextMenu={e => handleContextMenu(e, tab.id)}
            onClick={() => onSwitch(tab.id)}
            onDoubleClick={() => handleDblClick(tab)}
            className={`
              flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer select-none flex-shrink-0
              transition-colors relative
              ${tab.id === activeTabId
                ? ''
                : ''}
              ${dragOver === tab.id ? '' : ''}
            `}
            style={{
              borderRight: '1px solid var(--border)',
              background: tab.id === activeTabId ? 'var(--bg-editor)' : 'var(--bg-panel)',
              color: tab.id === activeTabId ? 'var(--text-bright)' : 'var(--text-secondary)',
              borderBottom: tab.id === activeTabId ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (tab.id !== activeTabId) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-bright)'
              }
            }}
            onMouseLeave={(e) => {
              if (tab.id !== activeTabId) {
                e.currentTarget.style.background = 'var(--bg-panel)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {tab.hasActivity && tab.id !== activeTabId && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
            {editingId === tab.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                className="bg-transparent outline-none w-20 text-xs"
                style={{ borderBottom: '1px solid var(--accent)', color: 'var(--text-bright)' }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="max-w-[120px] truncate">{tab.label}</span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onClose(tab.id) }}
                className="ml-1 w-4 h-4 flex items-center justify-center rounded transition-colors flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Add tab */}
      <button
        onClick={onAdd}
        disabled={tabs.length >= 8}
        className="flex-shrink-0 w-9 h-full flex items-center justify-center disabled:opacity-30 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        title="New tab (Ctrl+Shift+T)"
      >
        <Plus size={14} />
      </button>

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          tabs={tabs}
          onClose={() => setContextMenu(null)}
          onCloseTab={onClose}
          onCloseOthers={closeOthers}
          onCloseAll={closeAll}
          onDuplicate={duplicate}
        />
      )}
    </div>
  )
}
