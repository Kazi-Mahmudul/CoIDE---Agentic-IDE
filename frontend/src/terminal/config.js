import { BASE } from '../api.js'

export function getTerminalWsBase() {
  if (import.meta.env.VITE_TERMINAL_WS_BASE) return import.meta.env.VITE_TERMINAL_WS_BASE
  const url = new URL(BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${url.origin}/ws/terminal`
}

