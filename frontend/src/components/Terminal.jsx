
/**
 * Terminal.jsx — Multi-tab terminal using imperative TerminalInstance.
 *
 * Architecture:
 * - Each tab owns a TerminalInstance (xterm + WebSocket), created once.
 * - Switching tabs calls instance.mount(domEl) / instance.unmount().
 * - The xterm DOM node physically moves between containers — never re-created.
 * - Terminal history is always preserved, exactly like VS Code / iTerm.
 */
import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X } from 'lucide-react'
import TerminalTabs from './terminal/TerminalTabs.jsx'
import TerminalToolbar from './terminal/TerminalToolbar.jsx'
import TerminalPane from './terminal/TerminalPane.jsx'
import TerminalSearch from './terminal/TerminalSearch.jsx'
import TerminalSettings from './terminal/TerminalSettings.jsx'
import { TerminalInstance } from '../terminal/TerminalInstance.js'
import { loadSettings, saveSettings } from '../terminal/settings.js'
import { THEMES } from '../terminal/themes.js'

function makeTabId() { return uuidv4() }

function commandForFile(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  const escaped = `"${path.replace(/"/g, '\\"')}"`
  if (ext === 'py') return `python ${escaped}`
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return `node ${escaped}`
  if (ext === 'ts') return `npx tsx ${escaped}`
  if (ext === 'sh') return `bash ${escaped}`
  return null
}

export default function Terminal({ cwd, onClose }) {
  const [settings, setSettings] = useState(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // tabs: [{ id, label, cwd, hasActivity }]
  const [tabs, setTabs] = useState(() => [{ id: makeTabId(), label: 'bash', cwd: cwd || '', hasActivity: false }])
  const [activeTabId, setActiveTabId] = useState(null)

  // instances: Map<tabId, TerminalInstance>
  const instancesRef = useRef(new Map())

  // pane refs: tabId → { searchAddon, sendInput, fit, status, reconnect }
  const paneRefsRef = useRef({})

  // Split
  const [splitMode, setSplitMode] = useState(null)   // null | 'h' | 'v'
  const [splitTabId, setSplitTabId] = useState(null)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef(null)

  // Force re-render when instance status changes
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])

  const activeTheme = useMemo(
    () => THEMES[settings.theme] || THEMES['one-dark'],
    [settings.theme]
  )

  // ── Create a TerminalInstance for a tab ───────────────────────────────────
  const createInstance = useCallback((tabId, tabCwd) => {
    const inst = new TerminalInstance(
      uuidv4(),
      tabCwd || cwd || '',
      settings,
      activeTheme,
      {
        onCwdChange: (newCwd) => {
          setTabs(prev => prev.map(t =>
            t.id === tabId
              ? { ...t, cwd: newCwd, label: newCwd.split('/').slice(-2).join('/') || 'bash' }
              : t
          ))
        },
        onActivity: () => {
          setTabs(prev => prev.map(t =>
            t.id === tabId && t.id !== activeTabId
              ? { ...t, hasActivity: true }
              : t
          ))
        },
        onStatusChange: rerender,
      }
    )
    inst.init()
    instancesRef.current.set(tabId, inst)
    return inst
  }, [cwd, settings, activeTheme, activeTabId, rerender])

  // ── Bootstrap first tab ───────────────────────────────────────────────────
  useEffect(() => {
    const first = tabs[0]
    createInstance(first.id, first.cwd)
    setActiveTabId(first.id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ref to always-current splitH (avoids temporal dead zone) ────────────
  const splitHRef = useRef(null)

  // ── Cleanup all instances on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      instancesRef.current.forEach(inst => inst.destroy())
      instancesRef.current.clear()
      // Remove the holding div
      const holder = document.getElementById('__terminal_holder__')
      if (holder) holder.remove()
    }
  }, [])

  // ── Apply settings to all instances live ─────────────────────────────────
  useEffect(() => {
    instancesRef.current.forEach(inst => inst.applySettings(settings))
  }, [settings])

  // ── Apply theme to all instances live ────────────────────────────────────
  useEffect(() => {
    instancesRef.current.forEach(inst => inst.applyTheme(activeTheme))
  }, [activeTheme])

  // ── Tab management ────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (tabs.length >= 8) return
    const id = makeTabId()
    const tab = { id, label: 'bash', cwd: cwd || '', hasActivity: false }
    createInstance(id, cwd || '')
    setTabs(t => [...t, tab])
    setActiveTabId(id)
    setSplitMode(null)
    setSplitTabId(null)
  }, [tabs.length, cwd, createInstance])

  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      if (prev.length === 1) return prev
      const idx = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      // Destroy instance
      const inst = instancesRef.current.get(tabId)
      if (inst) { inst.destroy(); instancesRef.current.delete(tabId) }
      delete paneRefsRef.current[tabId]
      // Switch if needed
      if (activeTabId === tabId) {
        const newActive = next[Math.min(idx, next.length - 1)]
        setActiveTabId(newActive.id)
        setSplitMode(null)
        setSplitTabId(null)
      }
      return next
    })
  }, [activeTabId])

  const renameTab = useCallback((tabId, label) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, label } : t))
  }, [])

  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId)
    setSplitMode(null)
    setSplitTabId(null)
    // Clear activity indicator
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, hasActivity: false } : t))
  }, [])

  // ── Split management ──────────────────────────────────────────────────────
  const splitH = useCallback(() => {
    if (splitMode) return
    const id = makeTabId()
    const tab = { id, label: 'bash', cwd: cwd || '', hasActivity: false }
    createInstance(id, cwd || '')
    setTabs(t => [...t, tab])
    setSplitMode('h')
    setSplitTabId(id)
  }, [splitMode, cwd, createInstance])

  // Keep ref current so the event listener below always calls the latest splitH
  splitHRef.current = splitH

  // Register the external split-terminal event listener here, after splitH is defined
  useEffect(() => {
    const handler = () => splitHRef.current?.()
    window.addEventListener('coide:split-terminal', handler)
    return () => window.removeEventListener('coide:split-terminal', handler)
  }, []) // empty deps — uses ref, never stale

  const splitV = useCallback(() => {
    if (splitMode) return
    const id = makeTabId()
    const tab = { id, label: 'bash', cwd: cwd || '', hasActivity: false }
    createInstance(id, cwd || '')
    setTabs(t => [...t, tab])
    setSplitMode('v')
    setSplitTabId(id)
  }, [splitMode, cwd, createInstance])

  const closeSecondPane = useCallback(() => {
    if (splitTabId) {
      const inst = instancesRef.current.get(splitTabId)
      if (inst) { inst.destroy(); instancesRef.current.delete(splitTabId) }
      setTabs(prev => prev.filter(t => t.id !== splitTabId))
      delete paneRefsRef.current[splitTabId]
    }
    setSplitMode(null)
    setSplitTabId(null)
  }, [splitTabId])

  // ── Split drag ────────────────────────────────────────────────────────────
  const onSplitDragStart = useCallback((e) => {
    e.preventDefault()
    splitDragging.current = true
    const onMove = (ev) => {
      if (!splitDragging.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      if (splitMode === 'h') {
        setSplitRatio(Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width)))
      } else {
        setSplitRatio(Math.max(0.2, Math.min(0.8, (ev.clientY - rect.top) / rect.height)))
      }
    }
    const onUp = () => {
      splitDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Re-fit both panes after drag
      if (activeTabId) instancesRef.current.get(activeTabId)?.fit()
      if (splitTabId) instancesRef.current.get(splitTabId)?.fit()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [splitMode, activeTabId, splitTabId])

  // ── Search ────────────────────────────────────────────────────────────────
  const toggleSearch = useCallback(() => setSearchOpen(o => !o), [])

  const doSearch = useCallback((query, opts, direction) => {
    const ref = paneRefsRef.current[activeTabId]
    if (!ref?.searchAddon) return
    const searchOpts = {
      caseSensitive: opts.caseSensitive,
      wholeWord: opts.wholeWord,
      regex: opts.regex,
      decorations: {
        matchBackground: 'var(--text-warning)',
        matchBorder: 'var(--text-warning)',
        matchOverviewRuler: 'var(--text-warning)',
        activeMatchBackground: 'var(--accent)',
        activeMatchBorder: 'var(--accent)',
        activeMatchColorOverviewRuler: 'var(--accent)',
      },
    }
    if (direction === 'next') ref.searchAddon.findNext(query, searchOpts)
    else ref.searchAddon.findPrevious(query, searchOpts)
  }, [activeTabId])

  // ── Settings ──────────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      if (ctrl && shift && e.key === 'T') { e.preventDefault(); addTab(); return }
      if (ctrl && shift && e.key === 'W') { e.preventDefault(); closeTab(activeTabId); return }
      if (ctrl && !shift && e.key === 'Tab') {
        e.preventDefault()
        const idx = tabs.findIndex(t => t.id === activeTabId)
        switchTab(tabs[(idx + 1) % tabs.length].id)
        return
      }
      if (ctrl && shift && e.key === 'Tab') {
        e.preventDefault()
        const idx = tabs.findIndex(t => t.id === activeTabId)
        switchTab(tabs[(idx - 1 + tabs.length) % tabs.length].id)
        return
      }
      if (ctrl && shift && e.key === 'H') { e.preventDefault(); splitH(); return }
      if (ctrl && shift && e.key === 'F') { e.preventDefault(); toggleSearch(); return }
      if (ctrl && !shift && e.key === 'f') { e.preventDefault(); toggleSearch(); return }
      if (e.key === 'Escape' && searchOpen) { e.preventDefault(); setSearchOpen(false); return }
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) }); return
      }
      if (ctrl && e.key === '-') {
        e.preventDefault(); updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) }); return
      }
      if (ctrl && e.key === '0') { e.preventDefault(); updateSettings({ fontSize: 14 }); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addTab, closeTab, switchTab, splitH, toggleSearch, searchOpen, tabs, activeTabId, settings.fontSize, updateSettings])

  // ── External IDE events (run file, clear terminal) ───────────────────────
  useEffect(() => {
    const onRunFile = (e) => {
      const filePath = e?.detail?.path
      if (!filePath || !activeTabId) return
      const cmd = commandForFile(filePath)
      if (!cmd) {
        instancesRef.current.get(activeTabId)?.sendInput(`echo "No runner for ${filePath}"\r`)
        return
      }
      instancesRef.current.get(activeTabId)?.sendInput(`${cmd}\r`)
    }
    const onClear = () => {
      if (!activeTabId) return
      instancesRef.current.get(activeTabId)?.sendInput('\x0c')
    }
    window.addEventListener('coide:run-file', onRunFile)
    window.addEventListener('coide:clear-terminal', onClear)
    return () => {
      window.removeEventListener('coide:run-file', onRunFile)
      window.removeEventListener('coide:clear-terminal', onClear)
    }
  }, [activeTabId])

  // ── Paste ─────────────────────────────────────────────────────────────────
  const handlePaste = useCallback(async (tabId) => {
    try {
      const text = await navigator.clipboard.readText()
      const lines = text.split('\n')
      if (lines.length > 2) {
        const ok = window.confirm(
          `Paste ${lines.length} lines?\n\nPreview:\n${lines.slice(0, 5).join('\n')}${lines.length > 5 ? '\n…' : ''}`
        )
        if (!ok) return
      }
      instancesRef.current.get(tabId)?.sendInput(text)
    } catch (_) {}
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeCwd = useMemo(() => {
    return tabs.find(t => t.id === activeTabId)?.cwd || cwd || ''
  }, [tabs, activeTabId, cwd])

  const activeStatus = instancesRef.current.get(activeTabId)?.status || 'connecting'

  if (!activeTabId) return null

  // Which tabs are shown in the pane area
  const primaryTabId = activeTabId
  const secondaryTabId = splitMode ? splitTabId : null

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-editor)' }}
      aria-label="Terminal"
      role="region"
    >
      {/* Tab bar + close button */}
      <div className="flex items-center flex-shrink-0" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0">
          <TerminalTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={switchTab}
            onAdd={addTab}
            onClose={closeTab}
            onRename={renameTab}
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-9 flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="Close terminal panel"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Toolbar */}
      <TerminalToolbar
        cwd={activeCwd}
        status={activeStatus}
        onNewTab={addTab}
        onSplitH={splitH}
        onSplitV={splitV}
        onClear={() => instancesRef.current.get(activeTabId)?.sendInput('\x0c')}
        onSearch={toggleSearch}
        onSettings={() => setSettingsOpen(o => !o)}
      />

      {/* Pane area */}
      <div
        ref={splitContainerRef}
        className={`flex-1 min-h-0 flex overflow-hidden relative ${splitMode === 'v' ? 'flex-col' : 'flex-row'}`}
      >
        {/* Search bar inside pane area */}
        {searchOpen && (
          <div className="absolute top-1 right-2 z-30">
            <TerminalSearch
              onSearch={doSearch}
              onClose={() => setSearchOpen(false)}
            />
          </div>
        )}

        {/* Primary pane (active tab) */}
        <div
          style={splitMode ? { flexBasis: `${splitRatio * 100}%`, flexShrink: 0, flexGrow: 0 } : { flex: 1 }}
          className="relative min-w-0 min-h-0 overflow-hidden"
        >
          <TerminalPane
            key={primaryTabId}
            instance={instancesRef.current.get(primaryTabId)}
            active={true}
            onRef={(ref) => { paneRefsRef.current[primaryTabId] = ref }}
          />
        </div>

        {/* Split divider */}
        {splitMode && (
          <div
            className={`flex-shrink-0 transition-colors ${
              splitMode === 'h' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
            }`}
            style={{ background: 'var(--border-light)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-light)' }}
            onMouseDown={onSplitDragStart}
          />
        )}

        {/* Secondary pane (split) */}
        {splitMode && secondaryTabId && (
          <div
            style={{ flex: 1 }}
            className="relative min-w-0 min-h-0 overflow-hidden"
          >
            <TerminalPane
              key={secondaryTabId}
              instance={instancesRef.current.get(secondaryTabId)}
              active={true}
              onRef={(ref) => { paneRefsRef.current[secondaryTabId] = ref }}
            />
            <button
              className="absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded text-xs transition-colors"
              style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onClick={closeSecondPane}
              title="Close split pane"
            >✕</button>
          </div>
        )}
      </div>

      {/* Settings drawer */}
      <TerminalSettings
        open={settingsOpen}
        settings={settings}
        onUpdate={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
