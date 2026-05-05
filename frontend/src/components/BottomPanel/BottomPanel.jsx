import React, { useRef, useCallback, useEffect, useState } from 'react'
import { X, Maximize2, Minimize2, AlertCircle, AlertTriangle } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'
import TerminalPanel from './TerminalPanel.jsx'
import ProblemsPanel from './ProblemsPanel.jsx'
import OutputPanel from './OutputPanel.jsx'

const TABS = [
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'problems', label: 'PROBLEMS' },
  { id: 'output', label: 'OUTPUT' },
  { id: 'debug', label: 'DEBUG CONSOLE' },
]

export default function BottomPanel({ markers = [], onGoToLine }) {
  const {
    bottomPanelOpen, bottomPanelHeight, activeBottomTab,
    closeBottomPanel, setBottomTab, setBottomPanelHeight,
  } = useIDEStore()

  const [maximized, setMaximized] = useState(false)
  const [prevHeight, setPrevHeight] = useState(bottomPanelHeight)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const errors = markers.filter(m => m.severity === 8).length
  const warnings = markers.filter(m => m.severity === 4).length

  const onDragStart = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startH.current = bottomPanelHeight
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }, [bottomPanelHeight])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const delta = startY.current - e.clientY
      const maxH = window.innerHeight * 0.6
      setBottomPanelHeight(Math.max(80, Math.min(maxH, startH.current + delta)))
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
  }, [setBottomPanelHeight])

  const toggleMaximize = () => {
    if (maximized) {
      setBottomPanelHeight(prevHeight)
      setMaximized(false)
    } else {
      setPrevHeight(bottomPanelHeight)
      setBottomPanelHeight(window.innerHeight * 0.6)
      setMaximized(true)
    }
  }

  if (!bottomPanelOpen) return null

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-[#1e1e1e] border-t border-[#333] overflow-hidden"
      style={{ height: bottomPanelHeight }}
    >
      {/* Drag handle */}
      <div
        className="h-1 flex-shrink-0 cursor-row-resize hover:bg-[#007acc] transition-colors"
        onMouseDown={onDragStart}
        onDoubleClick={toggleMaximize}
      />

      {/* Tab bar */}
      <div className="flex items-center h-9 bg-[#252526] border-b border-[#333] flex-shrink-0 px-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium tracking-wide border-b-2 transition-colors
              ${activeBottomTab === tab.id
                ? 'text-[#d4d4d4] border-[#007acc]'
                : 'text-[#858585] border-transparent hover:text-[#cccccc]'
              }`}
          >
            {tab.label}
            {tab.id === 'problems' && (errors > 0 || warnings > 0) && (
              <span className="flex items-center gap-0.5 text-[10px]">
                {errors > 0 && <span className="text-red-400 flex items-center gap-0.5"><AlertCircle size={10} />{errors}</span>}
                {warnings > 0 && <span className="text-yellow-400 flex items-center gap-0.5"><AlertTriangle size={10} />{warnings}</span>}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={toggleMaximize}
          className="p-1 rounded text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] transition-colors"
          title={maximized ? 'Restore panel' : 'Maximize panel'}
        >
          {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={closeBottomPanel}
          className="p-1 rounded text-[#858585] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] transition-colors ml-1"
          title="Close panel (Ctrl+J)"
        >
          <X size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeBottomTab === 'terminal' && <TerminalPanel />}
        {activeBottomTab === 'problems' && <ProblemsPanel markers={markers} onGoToLine={onGoToLine} />}
        {activeBottomTab === 'output' && <OutputPanel />}
        {activeBottomTab === 'debug' && (
          <div className="flex items-center justify-center h-full text-xs text-[#555]">
            Debug console — coming soon
          </div>
        )}
      </div>
    </div>
  )
}
