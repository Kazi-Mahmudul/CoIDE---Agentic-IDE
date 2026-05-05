import '@testing-library/jest-dom'

// Suppress xterm CSS import errors in test environment
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
