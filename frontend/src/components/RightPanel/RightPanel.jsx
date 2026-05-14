import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Settings2, Globe, MessageSquare } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'
import ChatPanel from '../ChatPanel/ChatPanel.jsx'

const RIGHT_TABS = [
  { id: 'chat', label: 'CHAT', icon: MessageSquare },
  { id: 'preview', label: 'PREVIEW', icon: Globe },
  { id: 'settings', label: 'SETTINGS', icon: Settings2 },
]

const PREVIEW_STORAGE_KEY = 'coide_preview_url'

function PreviewPanel() {
  const [url, setUrl] = useState(() => localStorage.getItem(PREVIEW_STORAGE_KEY) || 'http://localhost:5173')
  const [activeUrl, setActiveUrl] = useState(url)

  useEffect(() => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, activeUrl)
  }, [activeUrl])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setActiveUrl(url.trim()) }}
          className="flex-1 px-2 py-1 text-xs rounded border"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
          placeholder="http://localhost:3000"
        />
        <button
          onClick={() => setActiveUrl(url.trim())}
          className="px-2 py-1 text-xs rounded border"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
        >
          Open
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {activeUrl ? (
          <iframe title="preview" src={activeUrl} className="w-full h-full border-0" />
        ) : (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Enter a preview URL to open.
          </div>
        )}
      </div>
    </div>
  )
}

function LayoutSettingsPanel() {
  const { panelVisibility, togglePanelVisibility } = useIDEStore()
  const items = [
    { id: 'explorer', label: 'Explorer' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'chat', label: 'Chat' },
    { id: 'preview', label: 'Preview' },
    { id: 'settings', label: 'Settings' },
  ]
  return (
    <div className="p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        Layout Panels
      </div>
      {items.map((item) => (
        <label key={item.id} className="flex items-center justify-between py-1 text-xs">
          <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
          <input
            type="checkbox"
            checked={Boolean(panelVisibility[item.id])}
            onChange={() => togglePanelVisibility(item.id)}
          />
        </label>
      ))}
    </div>
  )
}

export default function RightPanel({ activeFile, tree, markers, onFileOpen, onFileWrite }) {
  const {
    rightPanelOpen,
    rightPanelWidth,
    activeRightTab,
    panelVisibility,
    setRightPanelWidth,
    setRightTab,
    closeRightPanel,
    openRightPanel,
  } = useIDEStore()

  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const visibleTabs = useMemo(
    () => RIGHT_TABS.filter((tab) => panelVisibility[tab.id]),
    [panelVisibility],
  )

  useEffect(() => {
    if (!visibleTabs.length) return
    if (!visibleTabs.find((tab) => tab.id === activeRightTab)) {
      setRightTab(visibleTabs[0].id)
    }
  }, [activeRightTab, setRightTab, visibleTabs])

  const onDragStart = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = rightPanelWidth
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [rightPanelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      setRightPanelWidth(startW.current + delta)
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
  }, [setRightPanelWidth])

  if (!visibleTabs.length) return null

  if (!rightPanelOpen) {
    return (
      <button
        className="w-6 border-l flex items-center justify-center"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        onClick={openRightPanel}
        title="Open right panel"
      >
        <ChevronLeft size={14} />
      </button>
    )
  }

  return (
    <div className="relative flex-shrink-0 flex flex-col ide-chatpanel" style={{ width: rightPanelWidth }}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors"
        style={{ background: 'transparent' }}
        onMouseDown={onDragStart}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      />

      <div className="h-9 border-b flex items-center px-2 gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightTab(id)}
            className="px-2 h-7 rounded text-[11px] flex items-center gap-1.5"
            style={{
              color: activeRightTab === id ? 'var(--text-bright)' : 'var(--text-secondary)',
              background: activeRightTab === id ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={closeRightPanel}
          className="p-1 rounded"
          style={{ color: 'var(--text-secondary)' }}
          title="Collapse right panel"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeRightTab === 'chat' && (
          <ChatPanel
            activeFile={activeFile}
            tree={tree}
            markers={markers}
            onFileOpen={onFileOpen}
            onFileWrite={onFileWrite}
          />
        )}
        {activeRightTab === 'preview' && <PreviewPanel />}
        {activeRightTab === 'settings' && <LayoutSettingsPanel />}
      </div>
    </div>
  )
}
