import React, { useRef, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'
import FileTree from '../FileTree.jsx'
import SearchPanel from './SearchPanel.jsx'
import ExtensionsPanel from './ExtensionsPanel.jsx'

const PANEL_TITLES = {
  explorer: 'EXPLORER',
  search: 'SEARCH',
  git: 'SOURCE CONTROL',
  extensions: 'EXTENSIONS',
  chat: 'AGENT CHAT',
}

export default function SidePanel({ tree, activeFilePath, externalRoot, onFileOpen, onRefresh, onOpenFolder }) {
  const {
    sidePanelOpen, sidePanelWidth, activeActivityTab,
    closeSidePanel, setSidePanelWidth,
  } = useIDEStore()

  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onDragStart = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = sidePanelWidth
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [sidePanelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setSidePanelWidth(startW.current + delta)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setSidePanelWidth])

  if (!sidePanelOpen) return null

  const renderContent = () => {
    switch (activeActivityTab) {
      case 'explorer':
        return (
          <FileTree
            tree={tree}
            activeFile={activeFilePath}
            externalRoot={externalRoot}
            rootLabel={externalRoot || null}
            onFileOpen={onFileOpen}
            onRefresh={onRefresh}
            onOpenFolder={onOpenFolder}
          />
        )
      case 'search':
        return <SearchPanel onFileOpen={(path, line) => onFileOpen({ path, content: '' }, line)} />
      case 'git':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-xs text-[#555]">Source control</div>
            <div className="text-[10px] text-[#444] mt-1">Coming soon</div>
          </div>
        )
      case 'extensions':
        return <ExtensionsPanel />
      case 'chat':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-xs text-[#555]">Agent chat is in the right panel</div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-[#1e1e1e] border-r border-[#333] overflow-hidden relative"
      style={{ width: sidePanelWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#333] flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-wider text-[#858585]">
          {PANEL_TITLES[activeActivityTab] || 'PANEL'}
        </span>
        <button
          onClick={closeSidePanel}
          className="p-0.5 rounded text-[#555] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] transition-colors"
          title="Close (Ctrl+B)"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </div>

      {/* Resize handle — right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#007acc] transition-colors z-10"
        onMouseDown={onDragStart}
      />
    </div>
  )
}
