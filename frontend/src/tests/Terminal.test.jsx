/**
 * Frontend unit tests for Terminal component.
 * Run: cd frontend && npx vitest run
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mock xterm and addons ─────────────────────────────────────────────────────
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
  focus: vi.fn(),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onBell: vi.fn(() => ({ dispose: vi.fn() })),
  loadAddon: vi.fn(),
  options: {
    fontSize: 14,
    fontFamily: 'monospace',
    cursorStyle: 'block',
    cursorBlink: true,
    lineHeight: 1.2,
    scrollback: 10000,
    theme: {},
  },
  cols: 80,
  rows: 24,
  unicode: { activeVersion: '11' },
  _ro: null,
}

const mockFitAddon = {
  fit: vi.fn(),
  proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
}

const mockSearchAddon = {
  findNext: vi.fn(),
  findPrevious: vi.fn(),
}

const mockSerializeAddon = {
  serialize: vi.fn(() => ''),
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal),
}))
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon),
}))
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(() => ({ dispose: vi.fn() })),
}))
vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn(() => mockSearchAddon),
}))
vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: vi.fn(() => mockSerializeAddon),
}))
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn(() => ({ dispose: vi.fn() })),
}))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

// ── Mock WebSocket ────────────────────────────────────────────────────────────
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = WebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.sent = []
    MockWebSocket.instances.push(this)
    // Auto-open
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.({ type: 'open' })
    }, 10)
  }
  send(data) { this.sent.push(data) }
  close(code) {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ code: code || 1000, type: 'close' })
  }
  static instances = []
  static reset() { MockWebSocket.instances = [] }
}
MockWebSocket.CONNECTING = 0
MockWebSocket.OPEN = 1
MockWebSocket.CLOSING = 2
MockWebSocket.CLOSED = 3

global.WebSocket = MockWebSocket

// ── Mock uuid ─────────────────────────────────────────────────────────────────
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}))

// ── Mock ResizeObserver ───────────────────────────────────────────────────────
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ── Mock clipboard ────────────────────────────────────────────────────────────
global.navigator.clipboard = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve('pasted text')),
}

// ── Import component after mocks ──────────────────────────────────────────────
// We import lazily to ensure mocks are set up first
async function renderTerminal(props = {}) {
  const { default: Terminal } = await import('../components/Terminal.jsx')
  return render(<Terminal {...props} />)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Terminal Component', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    uuidCounter = 0
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test 1
  it('renders without crash', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Terminal container should exist
    const container = document.querySelector('[aria-label="Terminal"]')
    expect(container).toBeTruthy()
  })

  // Test 2
  it('loads settings from localStorage', async () => {
    localStorage.setItem('terminal_settings', JSON.stringify({
      fontSize: 18,
      theme: 'dracula',
    }))
    const { loadSettings } = await import('../terminal/settings.js')
    const s = loadSettings()
    expect(s.fontSize).toBe(18)
    expect(s.theme).toBe('dracula')
  })

  // Test 3
  it('new tab button creates a tab', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Initially 1 tab
    const tabsBefore = document.querySelectorAll('[draggable="true"]')
    expect(tabsBefore.length).toBe(1)

    // Click "+" button
    const addBtn = document.querySelector('button[title*="New tab"]')
    expect(addBtn).toBeTruthy()
    await act(async () => {
      fireEvent.click(addBtn)
    })

    const tabsAfter = document.querySelectorAll('[draggable="true"]')
    expect(tabsAfter.length).toBe(2)
  })

  // Test 4
  it('close tab removes tab', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Add a tab first
    const addBtn = document.querySelector('button[title*="New tab"]')
    await act(async () => { fireEvent.click(addBtn) })

    const tabsBefore = document.querySelectorAll('[draggable="true"]')
    expect(tabsBefore.length).toBe(2)

    // Close first tab (find close button inside first tab)
    const closeBtns = document.querySelectorAll('[draggable="true"] button')
    await act(async () => { fireEvent.click(closeBtns[0]) })

    const tabsAfter = document.querySelectorAll('[draggable="true"]')
    expect(tabsAfter.length).toBe(1)
  })

  // Test 5
  it('search bar toggles on Ctrl+F', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Search bar should not be visible
    expect(document.querySelector('input[placeholder*="Find"]')).toBeNull()

    // Fire Ctrl+F
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    })
    expect(document.querySelector('input[placeholder*="Find"]')).toBeTruthy()

    // Fire Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(document.querySelector('input[placeholder*="Find"]')).toBeNull()
  })

  // Test 6
  it('settings panel toggles on gear click', async () => {
    await act(async () => {
      await renderTerminal()
    })
    expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull()

    const gearBtn = document.querySelector('button[title="Settings"]')
    expect(gearBtn).toBeTruthy()
    await act(async () => { fireEvent.click(gearBtn) })

    expect(screen.getByRole('dialog', { name: /settings/i })).toBeTruthy()
  })

  // Test 7
  it('font size setting applies to terminal options', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Open settings
    const gearBtn = document.querySelector('button[title="Settings"]')
    await act(async () => { fireEvent.click(gearBtn) })

    // Change font size slider
    const slider = document.querySelector('input[type="range"]')
    expect(slider).toBeTruthy()
    await act(async () => {
      fireEvent.change(slider, { target: { value: '20' } })
    })

    // Settings should update (check localStorage)
    const saved = JSON.parse(localStorage.getItem('terminal_settings') || '{}')
    expect(saved.fontSize).toBe(20)
  })

  // Test 8
  it('theme change applies correct background', async () => {
    await act(async () => {
      await renderTerminal()
    })
    const gearBtn = document.querySelector('button[title="Settings"]')
    await act(async () => { fireEvent.click(gearBtn) })

    // Click Dracula theme swatch
    const themeButtons = document.querySelectorAll('[role="dialog"] button')
    const draculaBtn = Array.from(themeButtons).find(b => b.textContent.includes('Dracula'))
    expect(draculaBtn).toBeTruthy()
    await act(async () => { fireEvent.click(draculaBtn) })

    const saved = JSON.parse(localStorage.getItem('terminal_settings') || '{}')
    expect(saved.theme).toBe('dracula')

    const { THEMES } = await import('../terminal/themes.js')
    expect(THEMES['dracula'].background).toBe('#282a36')
  })

  // Test 9
  it('reconnect overlay shows on disconnect', async () => {
    await act(async () => {
      await renderTerminal()
    })
    // Wait for WS to open
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    // Simulate unexpected close
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    await act(async () => {
      ws.readyState = WebSocket.CLOSED
      ws.onclose?.({ code: 1006, type: 'close' })
    })

    // Overlay should appear
    await waitFor(() => {
      const overlay = document.querySelector('.backdrop-blur-sm')
      expect(overlay).toBeTruthy()
    }, { timeout: 2000 })
  })

  // Test 10
  it('copy-on-select calls clipboard.writeText when enabled', async () => {
    localStorage.setItem('terminal_settings', JSON.stringify({ copyOnSelect: true }))
    await act(async () => {
      await renderTerminal()
    })

    // Simulate selection
    mockTerminal.hasSelection.mockReturnValue(true)
    mockTerminal.getSelection.mockReturnValue('selected text')

    // Trigger onData callback (simulates user typing)
    const onDataCb = mockTerminal.onData.mock.calls[0]?.[0]
    if (onDataCb) {
      await act(async () => { onDataCb('a') })
    }

    // clipboard.writeText should have been called
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('selected text')
  })
})
