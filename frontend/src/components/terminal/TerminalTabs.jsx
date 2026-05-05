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
      className="fixed z-50 bg-[#2d2d2d] border border-[#555] rounded-lg shadow-xl py-1 min-w-[160px] text-xs"
      style={{ left: x, top: y }}
    >
      <button onClick={() => { onCloseTab(tabId); onClose() }} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771]">Close</button>
      <button onClick={() => { onCloseOthers(tabId); onClose() }} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771]">Close Others</button>
      <button onClick={() => { onCloseAll(); onClose() }} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771]">Close All</button>
      <div className="border-t border-[#444] my-1" />
      <button onClick={() => { onDuplicate(tabId); onClose() }} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771]">Duplicate</button>
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
    <div className="flex items-center bg-[#1a1a1a] border-b border-[#333] h-9 flex-shrink-0 overflow-hidden">
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
              border-r border-[#333] transition-colors relative
              ${tab.id === activeTabId
                ? 'bg-[#0d0d0d] text-[#d4d4d4] border-b-2 border-b-[#007acc]'
                : 'bg-[#1a1a1a] text-[#858585] hover:bg-[#252525] hover:text-[#d4d4d4]'}
              ${dragOver === tab.id ? 'bg-[#094771]' : ''}
            `}
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
                className="bg-transparent border-b border-[#007acc] outline-none w-20 text-xs text-[#d4d4d4]"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="max-w-[120px] truncate">{tab.label}</span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onClose(tab.id) }}
                className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-[#555] text-[#555] hover:text-[#d4d4d4] flex-shrink-0"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Add tab */}
      <button
        onClick={onAdd}
        disabled={tabs.length >= 8}
        className="flex-shrink-0 w-9 h-full flex items-center justify-center text-[#858585] hover:text-[#d4d4d4] hover:bg-[#252525] disabled:opacity-30 transition-colors"
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
