// Terminal settings — load/save from localStorage

export const DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, monospace',
  cursorStyle: 'block',       // block | underline | bar
  cursorBlink: true,
  scrollback: 10000,
  lineHeight: 1.2,
  theme: 'one-dark',
  copyOnSelect: false,
  bell: false,
  letterSpacing: 0,
}

const STORAGE_KEY = 'terminal_settings'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}
