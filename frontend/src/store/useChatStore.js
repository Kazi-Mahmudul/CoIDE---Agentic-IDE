import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'coide-chat-threads'
const MAX_THREADS = 50

function loadThreads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveThreads(threads) {
  try {
    // Keep only last MAX_THREADS
    const keys = Object.keys(threads)
    if (keys.length > MAX_THREADS) {
      const sorted = keys.sort((a, b) => (threads[a].updatedAt || 0) - (threads[b].updatedAt || 0))
      sorted.slice(0, keys.length - MAX_THREADS).forEach(k => delete threads[k])
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  } catch {}
}

function createThread(id = null) {
  return {
    id: id || uuidv4(),
    title: 'New Chat',
    messages: [],
    mode: 'auto',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
  }
}

export const useChatStore = create((set, get) => {
  const savedThreads = loadThreads()
  const threadIds = Object.keys(savedThreads)
  const firstId = threadIds.length > 0 ? threadIds[0] : uuidv4()
  const threads = threadIds.length > 0 ? savedThreads : { [firstId]: createThread(firstId) }
  const activeThreadId = firstId

  const persist = () => saveThreads(get().threads)

  return {
    threads,
    activeThreadId,
    sidebarOpen: false,

    // ── Thread management ─────────────────────────────────────────────────
    newThread: () => {
      const t = createThread()
      set(s => {
        const threads = { ...s.threads, [t.id]: t }
        saveThreads(threads)
        return { threads, activeThreadId: t.id }
      })
      return t.id
    },

    switchThread: (id) => set({ activeThreadId: id }),

    deleteThread: (id) => set(s => {
      const threads = { ...s.threads }
      delete threads[id]
      const ids = Object.keys(threads)
      if (ids.length === 0) {
        const t = createThread()
        threads[t.id] = t
        saveThreads(threads)
        return { threads, activeThreadId: t.id }
      }
      saveThreads(threads)
      const newActive = s.activeThreadId === id ? ids[0] : s.activeThreadId
      return { threads, activeThreadId: newActive }
    }),

    renameThread: (id, title) => set(s => {
      const threads = { ...s.threads, [id]: { ...s.threads[id], title, updatedAt: Date.now() } }
      saveThreads(threads)
      return { threads }
    }),

    pinThread: (id) => set(s => {
      const t = s.threads[id]
      if (!t) return {}
      const threads = { ...s.threads, [id]: { ...t, pinned: !t.pinned } }
      saveThreads(threads)
      return { threads }
    }),

    // ── Messages ──────────────────────────────────────────────────────────
    addMessage: (threadId, message) => set(s => {
      const thread = s.threads[threadId]
      if (!thread) return {}
      const msg = { id: uuidv4(), timestamp: Date.now(), ...message }
      const threads = {
        ...s.threads,
        [threadId]: {
          ...thread,
          messages: [...thread.messages, msg],
          updatedAt: Date.now(),
          // Auto-title from first user message
          title: thread.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 50) + (message.content.length > 50 ? '…' : '')
            : thread.title,
        }
      }
      saveThreads(threads)
      return { threads }
    }),

    updateLastMessage: (threadId, patch) => set(s => {
      const thread = s.threads[threadId]
      if (!thread || thread.messages.length === 0) return {}
      const messages = [...thread.messages]
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch }
      const threads = { ...s.threads, [threadId]: { ...thread, messages, updatedAt: Date.now() } }
      saveThreads(threads)
      return { threads }
    }),

    clearThread: (threadId) => set(s => {
      const thread = s.threads[threadId]
      if (!thread) return {}
      const threads = { ...s.threads, [threadId]: { ...thread, messages: [], updatedAt: Date.now() } }
      saveThreads(threads)
      return { threads }
    }),

    setThreadMode: (threadId, mode) => set(s => {
      const thread = s.threads[threadId]
      if (!thread) return {}
      const threads = { ...s.threads, [threadId]: { ...thread, mode } }
      saveThreads(threads)
      return { threads }
    }),

    toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

    // ── Getters ───────────────────────────────────────────────────────────
    getActiveThread: () => {
      const { threads, activeThreadId } = get()
      return threads[activeThreadId] || null
    },

    getSortedThreads: () => {
      const { threads } = get()
      return Object.values(threads).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
    },
  }
})
