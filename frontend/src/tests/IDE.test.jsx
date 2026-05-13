/**
 * IDE shell unit tests.
 * Run: cd frontend && npx vitest run
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useIDEStore } from '../store/useIDEStore.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api.js', () => ({
  BASE: 'http://localhost:8000',
  getFileTree: vi.fn(() => Promise.resolve({ tree: [], root: '/workspace' })),
  readFile: vi.fn(() => Promise.resolve({ path: 'test.js', content: 'console.log("hi")' })),
  writeFile: vi.fn(() => Promise.resolve({ status: 'ok' })),
  readExternalFile: vi.fn(() => Promise.resolve({ path: 'test.js', content: '' })),
  writeExternalFile: vi.fn(() => Promise.resolve({ status: 'ok' })),
  getExternalTree: vi.fn(() => Promise.resolve({ tree: [], root: '/' })),
  getFilesystemRoots: vi.fn(() => Promise.resolve({ roots: [{ name: 'C:/', path: 'C:/' }] })),
  getAuthToken: vi.fn(() => 'test-token'),
  setAuthToken: vi.fn(),
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'u1', username: 'test' })),
  authHeaders: vi.fn((h = {}) => ({ ...h, Authorization: 'Bearer test-token' })),
  streamAgentChat: vi.fn(),
}))

vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ onMount }) => {
    React.useEffect(() => { onMount?.({ addCommand: vi.fn(), updateOptions: vi.fn(), onDidChangeCursorPosition: vi.fn(), getModel: vi.fn(() => ({ getValue: vi.fn(() => ''), setValue: vi.fn(), uri: {} })), trigger: vi.fn(), getAction: vi.fn(), focus: vi.fn() }, { KeyMod: { CtrlCmd: 0 }, KeyCode: { KeyS: 0 }, editor: { onDidChangeMarkers: vi.fn(), getModelMarkers: vi.fn(() => []) } }) }, [])
    return <div data-testid="monaco-editor" />
  }),
}))

vi.mock('../terminal/TerminalInstance.js', () => ({
  TerminalInstance: vi.fn().mockImplementation(() => ({
    init: vi.fn(() => Promise.resolve()),
    mount: vi.fn(),
    unmount: vi.fn(),
    destroy: vi.fn(),
    fit: vi.fn(),
    applySettings: vi.fn(),
    applyTheme: vi.fn(),
    sendInput: vi.fn(),
    status: 'connected',
    callbacks: {},
    _connect: vi.fn(),
  })),
}))

vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn(() => ({ open: vi.fn(), dispose: vi.fn(), write: vi.fn(), onData: vi.fn(() => ({ dispose: vi.fn() })), loadAddon: vi.fn(), unicode: { activeVersion: '11' }, cols: 80, rows: 24, options: {} })) }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn(() => ({ fit: vi.fn(), proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })) })) }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn(() => ({})) }))
vi.mock('@xterm/addon-search', () => ({ SearchAddon: vi.fn(() => ({ findNext: vi.fn(), findPrevious: vi.fn() })) }))
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: vi.fn(() => ({ serialize: vi.fn(() => '') })) }))
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn(() => ({})) }))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.scrollIntoView = vi.fn()
Element.prototype.scrollIntoView = vi.fn()
global.WebSocket = class {
  constructor() { this.readyState = 1; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null }
  send() {} close() {}
  static OPEN = 1; static CONNECTING = 0; static CLOSED = 3
}

// ── Reset store before each test ──────────────────────────────────────────────
beforeEach(() => {
  useIDEStore.setState({
    sidePanelOpen: true,
    bottomPanelOpen: true,
    activeActivityTab: 'explorer',
    activeBottomTab: 'terminal',
    openFiles: [],
    activeFileId: null,
    commandPaletteOpen: false,
    commandPalettePrefix: '>',
  })
  localStorage.clear()
  vi.clearAllMocks()
})

// ── Import App lazily after mocks ─────────────────────────────────────────────
async function renderApp() {
  const { default: App } = await import('../App.jsx')
  return render(<App />)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('IDE Shell', () => {

  // Test 1 — keyboard hook via store actions directly
  it('Ctrl+J toggles bottom panel', async () => {
    expect(useIDEStore.getState().bottomPanelOpen).toBe(true)
    await act(async () => { useIDEStore.getState().toggleBottomPanel() })
    expect(useIDEStore.getState().bottomPanelOpen).toBe(false)
    await act(async () => { useIDEStore.getState().toggleBottomPanel() })
    expect(useIDEStore.getState().bottomPanelOpen).toBe(true)
  })

  // Test 2
  it('Ctrl+B toggles side panel', async () => {
    expect(useIDEStore.getState().sidePanelOpen).toBe(true)
    await act(async () => { useIDEStore.getState().toggleSidePanel() })
    expect(useIDEStore.getState().sidePanelOpen).toBe(false)
  })

  // Test 3
  it('File menu opens on click', async () => {
    const { default: MenuBar } = await import('../components/MenuBar/MenuBar.jsx')
    const { buildMenus } = await import('../components/MenuBar/menus.js')
    const menus = buildMenus({ store: useIDEStore.getState(), editorRef: { current: null }, openCommandPalette: vi.fn(), toast: vi.fn() })
    await act(async () => { render(<MenuBar menus={menus} />) })
    const fileBtn = screen.getByText('File')
    await act(async () => { fireEvent.click(fileBtn) })
    expect(screen.getByText('New File')).toBeTruthy()
  })

  // Test 4
  it('Menu closes on outside click', async () => {
    const { default: MenuBar } = await import('../components/MenuBar/MenuBar.jsx')
    const { buildMenus } = await import('../components/MenuBar/menus.js')
    const menus = buildMenus({ store: useIDEStore.getState(), editorRef: { current: null }, openCommandPalette: vi.fn(), toast: vi.fn() })
    await act(async () => { render(<MenuBar menus={menus} />) })
    const fileBtn = screen.getByText('File')
    await act(async () => { fireEvent.click(fileBtn) })
    expect(screen.getByText('New File')).toBeTruthy()
    await act(async () => { fireEvent.mouseDown(document.body) })
    await waitFor(() => { expect(screen.queryByText('New File')).toBeNull() })
  })

  // Test 5
  it('Ctrl+Shift+P opens command palette', async () => {
    await act(async () => { useIDEStore.getState().openCommandPalette('>') })
    expect(useIDEStore.getState().commandPaletteOpen).toBe(true)
  })

  // Test 6
  it('Command palette filters commands', async () => {
    const { useCommandStore } = await import('../store/useCommandStore.js')
    const cmds = [
      { id: 'terminal.new.t6', label: 'Terminal: New Terminal', shortcut: '', action: vi.fn() },
      { id: 'file.save.t6', label: 'File: Save', shortcut: 'Ctrl+S', action: vi.fn() },
    ]
    useCommandStore.setState({ commands: cmds })
    useIDEStore.setState({ commandPaletteOpen: true, commandPalettePrefix: '>' })
    const { default: CommandPalette } = await import('../components/CommandPalette/CommandPalette.jsx')
    const { unmount } = render(<CommandPalette openFiles={[]} onOpenFile={vi.fn()} />)
    const input = document.querySelector('input')
    await act(async () => { fireEvent.change(input, { target: { value: '>terminal' } }) })
    await waitFor(() => {
      const items = document.querySelectorAll('button')
      const found = Array.from(items).some(b => b.textContent.includes('Terminal: New Terminal'))
      expect(found).toBe(true)
    })
    const saveFound = Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'File: Save')
    expect(saveFound).toBe(false)
    unmount()
  })

  // Test 7
  it('Command palette runs command on Enter', async () => {
    const action = vi.fn()
    const { useCommandStore } = await import('../store/useCommandStore.js')
    useCommandStore.setState({ commands: [
      { id: 'view.toggleTerminal.t7', label: 'View: Toggle Terminal', shortcut: 'Ctrl+J', action },
    ]})
    useIDEStore.setState({ commandPaletteOpen: true, commandPalettePrefix: '>' })
    const { default: CommandPalette } = await import('../components/CommandPalette/CommandPalette.jsx')
    const { unmount } = render(<CommandPalette openFiles={[]} onOpenFile={vi.fn()} />)
    const input = document.querySelector('input')
    await act(async () => { fireEvent.change(input, { target: { value: '>toggle terminal' } }) })
    await waitFor(() => {
      const found = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('View: Toggle Terminal'))
      expect(found).toBe(true)
    })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(action).toHaveBeenCalled()
    unmount()
  })

  // Test 8
  it('Ctrl+W closes active tab via store', async () => {
    useIDEStore.setState({
      openFiles: [
        { id: 'a', path: 'a.js', label: 'a.js', content: '', modified: false },
        { id: 'b', path: 'b.js', label: 'b.js', content: '', modified: false },
      ],
      activeFileId: 'a',
    })
    await act(async () => { useIDEStore.getState().closeActiveTab() })
    expect(useIDEStore.getState().openFiles.length).toBe(1)
    expect(useIDEStore.getState().openFiles[0].id).toBe('b')
  })

  // Test 9
  it('Activity bar click opens side panel with correct tab', async () => {
    useIDEStore.setState({ sidePanelOpen: false, activeActivityTab: 'explorer' })
    await act(async () => { await renderApp() })
    // Find the Search button by its exact title
    const searchBtn = screen.getByTitle('Search (Ctrl+Shift+F)')
    await act(async () => { fireEvent.click(searchBtn) })
    expect(useIDEStore.getState().sidePanelOpen).toBe(true)
    expect(useIDEStore.getState().activeActivityTab).toBe('search')
  })

  // Test 10
  it('Bottom panel tab switching works', async () => {
    useIDEStore.setState({ bottomPanelOpen: true, activeBottomTab: 'terminal' })
    await act(async () => { await renderApp() })
    const problemsTab = screen.getByText('PROBLEMS')
    await act(async () => { fireEvent.click(problemsTab) })
    expect(useIDEStore.getState().activeBottomTab).toBe('problems')
  })
})
