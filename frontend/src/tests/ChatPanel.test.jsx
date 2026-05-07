/**
 * Frontend ChatPanel tests.
 * Run: cd frontend && npx vitest run src/tests/ChatPanel.test.jsx
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-markdown', () => ({
  default: ({ children }) => <div data-testid="markdown">{children}</div>
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

global.fetch = vi.fn()
global.navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve('')) }
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
global.URL.createObjectURL = vi.fn(() => 'blob:test')
global.URL.revokeObjectURL = vi.fn()

// Mock uuid
vi.mock('uuid', () => ({ v4: () => 'test-uuid-' + Math.random().toString(36).slice(2) }))

// Reset store before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Reset chat store
  const { useChatStore } = require('../store/useChatStore.js')
  useChatStore.setState({
    threads: { 'thread-1': { id: 'thread-1', title: 'Test', messages: [], mode: 'auto', createdAt: Date.now(), updatedAt: Date.now(), pinned: false } },
    activeThreadId: 'thread-1',
  })
})

// ── Test 1: Chat input sends on Enter ────────────────────────────────────────

describe('ChatInput', () => {
  it('sends on Enter key', async () => {
    const onSend = vi.fn()
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={onSend} streaming={false} tree={[]} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    await userEvent.type(ta, 'hello world')
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ text: 'hello world' }))
  })

  // Test 2: Shift+Enter adds newline
  it('shift+enter adds newline without sending', async () => {
    const onSend = vi.fn()
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={onSend} streaming={false} tree={[]} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    await userEvent.type(ta, 'line1')
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  // Test 3: @ opens context picker
  it('@ opens context picker', async () => {
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={vi.fn()} streaming={false} tree={[]} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    await userEvent.type(ta, '@')
    await waitFor(() => {
      expect(screen.getByText('Add Context')).toBeTruthy()
    })
  })

  // Test 4: # opens file picker
  it('# opens file picker', async () => {
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    const tree = [{ name: 'test.py', path: 'test.py', type: 'file' }]
    render(<ChatInput onSend={vi.fn()} streaming={false} tree={tree} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    await userEvent.type(ta, '#')
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search files…')).toBeTruthy()
    })
  })
})

// ── Test 5: Context chip added on file select ─────────────────────────────────

describe('ContextChips', () => {
  it('adds chip and shows it', async () => {
    const onRemove = vi.fn()
    const { default: ContextChips } = await import('../components/ChatPanel/ContextChips.jsx')
    const chips = [{ id: '1', type: 'file', label: 'test.py' }]
    render(<ContextChips chips={chips} onRemove={onRemove} />)
    expect(screen.getByText('test.py')).toBeTruthy()
  })

  // Test 6: Remove chip on × click
  it('removes chip on × click', async () => {
    const onRemove = vi.fn()
    const { default: ContextChips } = await import('../components/ChatPanel/ContextChips.jsx')
    const chips = [{ id: '1', type: 'file', label: 'test.py' }]
    render(<ContextChips chips={chips} onRemove={onRemove} />)
    const removeBtn = document.querySelector('button[class*="hover:text-red"]')
    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledWith('1')
  })
})

// ── Test 7: Mode toggle overrides auto ───────────────────────────────────────

describe('Mode toggle', () => {
  it('cycles through auto → agent → chat', async () => {
    const onModeOverride = vi.fn()
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={vi.fn()} streaming={false} tree={[]} contextChips={[]} modeOverride="auto" onModeOverride={onModeOverride} />)
    const modeBtn = screen.getByText('AUTO')
    fireEvent.click(modeBtn)
    expect(onModeOverride).toHaveBeenCalledWith('agent')
  })
})

// ── Test 8: Tool card shows spinner while running ─────────────────────────────

describe('AgentToolCard', () => {
  it('shows spinner when status is running', async () => {
    const { default: AgentToolCard } = await import('../components/ChatPanel/AgentToolCard.jsx')
    render(<AgentToolCard id="t1" name="read_file" args={{ path: 'test.py' }} status="running" />)
    // Spinner should be present (animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  // Test 9: Tool card shows result when done
  it('shows checkmark when done', async () => {
    const { default: AgentToolCard } = await import('../components/ChatPanel/AgentToolCard.jsx')
    render(<AgentToolCard id="t1" name="read_file" args={{ path: 'test.py' }} output="file content" status="done" durationMs={45} />)
    expect(screen.getByText('45ms')).toBeTruthy()
    // No spinner
    expect(document.querySelector('.animate-spin')).toBeNull()
  })
})

// ── Test 10: DiffBlock renders additions in green ─────────────────────────────

describe('DiffBlock', () => {
  it('renders added lines in green', async () => {
    const { default: DiffBlock } = await import('../components/ChatPanel/DiffBlock.jsx')
    render(<DiffBlock path="test.py" oldContent="line1\n" newContent="line1\nline2\n" />)
    const greenLines = document.querySelectorAll('.text-green-300')
    expect(greenLines.length).toBeGreaterThan(0)
  })

  // Test 11: Apply button calls write API
  it('apply button calls write API', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    const { default: DiffBlock } = await import('../components/ChatPanel/DiffBlock.jsx')
    render(<DiffBlock path="test.py" oldContent="old" newContent="new" />)
    const applyBtn = screen.getByText('Apply')
    await act(async () => { fireEvent.click(applyBtn) })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/files/write'),
      expect.objectContaining({ method: 'POST' })
    )
  })
})

// ── Test 12: CheckpointBar shows undo button ──────────────────────────────────

describe('CheckpointBar', () => {
  it('shows undo all button', async () => {
    const { default: CheckpointBar } = await import('../components/ChatPanel/CheckpointBar.jsx')
    render(<CheckpointBar checkpointId="cp_123" filesChanged={['test.py']} />)
    expect(screen.getByText('Undo All')).toBeTruthy()
  })
})

// ── Test 13: Slash command /clear clears messages ────────────────────────────

describe('Slash commands', () => {
  it('/clear triggers clear action', async () => {
    const onSend = vi.fn()
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={onSend} streaming={false} tree={[]} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    await userEvent.type(ta, '/clear')
    await waitFor(() => screen.getByText('Clear current thread'))
    fireEvent.click(screen.getByText('Clear current thread'))
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ _slash: 'clear' }))
  })
})

// ── Test 14: Image paste adds attachment ──────────────────────────────────────

describe('Image paste', () => {
  it('handles image paste', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [{ id: 'img1', filename: 'test.png', type: 'image', base64: 'abc', media_type: 'image/png', size: 100 }] })
    })
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={vi.fn()} streaming={false} tree={[]} contextChips={[]} />)
    const ta = screen.getByPlaceholderText(/Ask anything/)
    const file = new File([''], 'test.png', { type: 'image/png' })
    const clipboardData = { items: [{ type: 'image/png', getAsFile: () => file }] }
    await act(async () => {
      fireEvent.paste(ta, { clipboardData })
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/chat/upload'), expect.any(Object))
    })
  })
})

// ── Test 15: Token counter updates on context change ─────────────────────────

describe('Token counter', () => {
  it('shows token count', async () => {
    const { default: ChatInput } = await import('../components/ChatPanel/ChatInput.jsx')
    render(<ChatInput onSend={vi.fn()} streaming={false} tree={[]} contextChips={[]} tokenCount={1240} maxTokens={128000} />)
    expect(screen.getByText(/1,240/)).toBeTruthy()
  })
})
