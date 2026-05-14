import { create } from 'zustand'
import { applyTheme } from '../themes.js'

const STORAGE_KEY = 'coide-ide-state'

const PERSISTED = [
  'sidePanelOpen', 'sidePanelWidth', 'activeActivityTab',
  'bottomPanelOpen', 'bottomPanelHeight', 'activeBottomTab',
  'rightPanelOpen', 'rightPanelWidth', 'activeRightTab',
  'panelVisibility',
  'theme', 'fontSize',
]

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return Object.fromEntries(PERSISTED.map(k => [k, parsed[k]]).filter(([, v]) => v !== undefined))
  } catch { return {} }
}

function savePersisted(state) {
  try {
    const data = Object.fromEntries(PERSISTED.map(k => [k, state[k]]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const defaults = {
  sidePanelOpen: true,
  sidePanelWidth: 240,
  activeActivityTab: 'explorer',
  bottomPanelOpen: true,
  bottomPanelHeight: 220,
  activeBottomTab: 'terminal',
  rightPanelOpen: true,
  rightPanelWidth: 320,
  activeRightTab: 'chat',
  panelVisibility: {
    explorer: true,
    terminal: true,
    chat: true,
    preview: false,
    settings: false,
  },
  openFiles: [],
  activeFileId: null,
  commandPaletteOpen: false,
  commandPalettePrefix: '>',
  notifications: [],
  theme: 'dark',
  fontSize: 13,
  externalRoot: null,
}

export const useIDEStore = create((set, get) => {
  const saved = loadPersisted()
  const initial = {
    ...defaults,
    ...saved,
    panelVisibility: {
      ...defaults.panelVisibility,
      ...(saved.panelVisibility || {}),
    },
  }

  // Apply saved theme immediately on store creation
  applyTheme(initial.theme || 'dark')

  const persist = (fn) => {
    fn()
    savePersisted(get())
  }

  return {
    ...initial,

    // ── Side panel ──────────────────────────────────────────────────────────
    toggleSidePanel: () => persist(() => set(s => {
      const next = !s.sidePanelOpen
      return { sidePanelOpen: next, panelVisibility: { ...s.panelVisibility, explorer: next } }
    })),
    openSidePanel: () => persist(() => set(s => ({ sidePanelOpen: true, panelVisibility: { ...s.panelVisibility, explorer: true } }))),
    closeSidePanel: () => persist(() => set(s => ({ sidePanelOpen: false, panelVisibility: { ...s.panelVisibility, explorer: false } }))),
    setSidePanelWidth: (w) => persist(() => set({ sidePanelWidth: Math.max(160, Math.min(480, w)) })),
    setActivityTab: (tab) => persist(() => set({ activeActivityTab: tab })),

    // ── Bottom panel ────────────────────────────────────────────────────────
    toggleBottomPanel: () => persist(() => set(s => {
      const next = !s.bottomPanelOpen
      return { bottomPanelOpen: next, panelVisibility: { ...s.panelVisibility, terminal: next } }
    })),
    openBottomPanel: () => persist(() => set(s => ({ bottomPanelOpen: true, panelVisibility: { ...s.panelVisibility, terminal: true } }))),
    closeBottomPanel: () => persist(() => set(s => ({ bottomPanelOpen: false, panelVisibility: { ...s.panelVisibility, terminal: false } }))),
    setBottomTab: (tab) => persist(() => set(s => ({ activeBottomTab: tab, bottomPanelOpen: true, panelVisibility: { ...s.panelVisibility, terminal: true } }))),
    setBottomPanelHeight: (h) => persist(() => set({ bottomPanelHeight: Math.max(80, h) })),

    // ── Right panel ─────────────────────────────────────────────────────────
    toggleRightPanel: () => persist(() => set(s => ({ rightPanelOpen: !s.rightPanelOpen }))),
    openRightPanel: () => persist(() => set({ rightPanelOpen: true })),
    closeRightPanel: () => persist(() => set({ rightPanelOpen: false })),
    setRightPanelWidth: (w) => persist(() => set({ rightPanelWidth: Math.max(260, Math.min(700, w)) })),
    setRightTab: (tab) => persist(() => set(s => ({
      activeRightTab: tab,
      rightPanelOpen: true,
      panelVisibility: { ...s.panelVisibility, [tab]: true },
    }))),

    togglePanelVisibility: (panel) => persist(() => set((s) => {
      const nextVisibility = { ...s.panelVisibility }
      if (!(panel in nextVisibility)) {
        return {}
      }
      nextVisibility[panel] = !nextVisibility[panel]
      if (panel === 'explorer') {
        return { panelVisibility: nextVisibility, sidePanelOpen: nextVisibility.explorer }
      }
      if (panel === 'terminal') {
        return { panelVisibility: nextVisibility, bottomPanelOpen: nextVisibility.terminal }
      }
        if (panel === 'chat' || panel === 'preview' || panel === 'settings') {
          const rightTabs = ['chat', 'preview', 'settings']
          const anyRightVisible = rightTabs.some((t) => nextVisibility[t])
          let nextTab = s.activeRightTab
          if (!nextVisibility[nextTab] && anyRightVisible) {
            nextTab = rightTabs.find((t) => nextVisibility[t]) || nextTab
          }
          return {
            panelVisibility: nextVisibility,
            rightPanelOpen: anyRightVisible,
            activeRightTab: anyRightVisible ? nextTab : s.activeRightTab,
          }
        }
      return { panelVisibility: nextVisibility }
    })),

    // ── Editor files ────────────────────────────────────────────────────────
    openFile: (file) => set(s => {
      // file: { id, path, label, content, language, modified, externalRoot? }
      const exists = s.openFiles.find(f => f.id === file.id || f.path === file.path)
      if (exists) {
        return { activeFileId: exists.id }
      }
      const newFile = { modified: false, ...file, id: file.id || file.path }
      return { openFiles: [...s.openFiles, newFile], activeFileId: newFile.id }
    }),
    closeFile: (id) => set(s => {
      const files = s.openFiles.filter(f => f.id !== id)
      let activeFileId = s.activeFileId
      if (activeFileId === id) {
        const idx = s.openFiles.findIndex(f => f.id === id)
        const next = files[Math.min(idx, files.length - 1)]
        activeFileId = next?.id ?? null
      }
      return { openFiles: files, activeFileId }
    }),
    setActiveFile: (id) => set({ activeFileId: id }),
    markFileModified: (id, modified = true) => set(s => ({
      openFiles: s.openFiles.map(f => f.id === id ? { ...f, modified } : f)
    })),
    updateFileContent: (id, content) => set(s => ({
      openFiles: s.openFiles.map(f => f.id === id ? { ...f, content } : f)
    })),
    closeActiveTab: () => {
      const { activeFileId, closeFile } = get()
      if (activeFileId) closeFile(activeFileId)
    },
    nextTab: () => set(s => {
      if (!s.openFiles.length) return {}
      const idx = s.openFiles.findIndex(f => f.id === s.activeFileId)
      const next = s.openFiles[(idx + 1) % s.openFiles.length]
      return { activeFileId: next.id }
    }),
    prevTab: () => set(s => {
      if (!s.openFiles.length) return {}
      const idx = s.openFiles.findIndex(f => f.id === s.activeFileId)
      const prev = s.openFiles[(idx - 1 + s.openFiles.length) % s.openFiles.length]
      return { activeFileId: prev.id }
    }),

    // ── External folder ─────────────────────────────────────────────────────
    setExternalRoot: (root) => set({ externalRoot: root }),

    // ── Command palette ─────────────────────────────────────────────────────
    openCommandPalette: (prefix = '>') => set({ commandPaletteOpen: true, commandPalettePrefix: prefix }),
    closeCommandPalette: () => set({ commandPaletteOpen: false }),

    // ── Notifications ───────────────────────────────────────────────────────
    addNotification: (n) => set(s => ({
      notifications: [...s.notifications, { id: Date.now(), ...n }]
    })),
    removeNotification: (id) => set(s => ({
      notifications: s.notifications.filter(n => n.id !== id)
    })),

    // ── Theme ───────────────────────────────────────────────────────────────
    toggleTheme: () => persist(() => set(s => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return { theme: next }
    })),
    setTheme: (t) => persist(() => set(() => {
      applyTheme(t)
      return { theme: t }
    })),

    // ── Font size ───────────────────────────────────────────────────────────
    zoomIn: () => persist(() => set(s => ({ fontSize: Math.min(24, s.fontSize + 1) }))),
    zoomOut: () => persist(() => set(s => ({ fontSize: Math.max(8, s.fontSize - 1) }))),
    resetZoom: () => persist(() => set({ fontSize: 13 })),
  }
})
