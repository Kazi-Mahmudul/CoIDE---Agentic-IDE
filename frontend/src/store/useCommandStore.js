import { create } from 'zustand'

// Command registry — populated at app startup via registerCommands()
export const useCommandStore = create((set, get) => ({
  commands: [],

  register: (cmds) => set({ commands: cmds }),

  run: (id) => {
    const cmd = get().commands.find(c => c.id === id)
    if (cmd?.action) {
      try { cmd.action() } catch (e) { console.error('Command error:', e) }
      // Track recently used
      const recent = JSON.parse(localStorage.getItem('recentCommands') || '[]')
      const updated = [id, ...recent.filter(r => r !== id)].slice(0, 20)
      localStorage.setItem('recentCommands', JSON.stringify(updated))
    }
  },

  getRecent: () => {
    const recent = JSON.parse(localStorage.getItem('recentCommands') || '[]')
    const { commands } = get()
    return recent.map(id => commands.find(c => c.id === id)).filter(Boolean)
  },
}))
