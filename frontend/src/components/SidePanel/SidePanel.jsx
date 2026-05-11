import React, { useRef, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'
import FileTree from '../FileTree.jsx'
import SearchPanel from './SearchPanel.jsx'
import ExtensionsPanel from './ExtensionsPanel.jsx'
import GitPanel from './GitPanel.jsx'

const PANEL_TITLES = {
  explorer:   'EXPLORER',
  search:     'SEARCH',
  git:        'SOURCE CONTROL',
  extensions: 'EXTENSIONS',
  chat:       'AGENT CHAT',
}

export default function SidePanel({ tree, activeFilePath, externalRoot, onFileOpen, onRefresh, onOpenFolder }) {
  const { sidePanelOpen, sidePanelWidth, activeActivityTab, closeSidePanel, setSidePanelWidth } = useIDEStore()

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
      setSidePanelWidth(startW.current + (e.clientX - startX.current))
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
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
        return <SearchPanel onFileOpen={(path, line) => onFileOpen(path, line)} />
      case 'git':
        return <GitPanel onFileOpen={onFileOpen} />
      case 'extensions':
        return <ExtensionsPanel />
      case 'chat':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Agent chat is in the right panel</div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="ide-sidepanel flex-shrink-0 flex flex-col overflow-hidden relative"
      style={{ width: sidePanelWidth }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-9 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {PANEL_TITLES[activeActivityTab] || 'PANEL'}
        </span>
        <button
          onClick={closeSidePanel}
          className="p-0.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          title="Close (Ctrl+B)"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors"
        style={{ background: 'transparent' }}
        onMouseDown={onDragStart}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      />
    </div>
  )
}
