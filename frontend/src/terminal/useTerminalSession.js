/**
 * Hook that manages a single xterm.js terminal instance + WebSocket session.
 * Returns refs and state needed by the Terminal UI.
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { THEMES } from './themes.js'
import { loadSettings } from './settings.js'

const WS_BASE = 'ws://localhost:8000/ws/terminal'
const MAX_RECONNECT = 5
const PING_INTERVAL = 30_000
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

export function useTerminalSession({ settings, theme, cwd, active, onCwdChange, onActivity }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const searchAddonRef = useRef(null)
  const serializeAddonRef = useRef(null)
  const wsRef = useRef(null)
  const sessionIdRef = useRef(uuidv4())
  const mountedRef = useRef(true)
  const pingTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const bracketedPasteRef = useRef(false)
  const oscBufRef = useRef('')

  const [status, setStatus] = useState('connecting')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [currentCwd, setCurrentCwd] = useState(cwd || '')

  // ── Build WS URL ──────────────────────────────────────────────────────────
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ session_id: sessionIdRef.current })
    if (cwd) params.set('cwd', cwd)
    return `${WS_BASE}?${params}`
  }, [cwd])

  // ── Connect WebSocket ─────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const ws = new WebSocket(buildUrl())
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(1000); return }
      setStatus('connected')
      reconnectAttemptRef.current = 0
      setReconnectAttempt(0)

      // Send initial size
      const term = termRef.current
      const fit = fitAddonRef.current
      if (term && fit) {
        try {
          fit.fit()
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        } catch (_) {}
      }

      // Start ping
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL)
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          const data = atob(msg.data)
          const bytes = new Uint8Array(data.length)
          for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i)
          const term = termRef.current
          if (term) {
            // Parse OSC 7 for cwd tracking
            _parseOsc7(new TextDecoder().decode(bytes), (newCwd) => {
              setCurrentCwd(newCwd)
              onCwdChange?.(newCwd)
            })
            term.write(bytes)
            if (!active) onActivity?.()
          }
        } else if (msg.type === 'session') {
          sessionIdRef.current = msg.session_id
        }
        // pong, error — ignore silently
      } catch (_) {}
    }

    ws.onclose = (e) => {
      if (!mountedRef.current) return
      if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null }
      setStatus('disconnected')

      if (e.code === 1000) return // clean close

      const attempt = reconnectAttemptRef.current
      if (attempt < MAX_RECONNECT) {
        const delay = RECONNECT_DELAYS[attempt] ?? 16000
        reconnectAttemptRef.current = attempt + 1
        setReconnectAttempt(attempt + 1)
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      setStatus('disconnected')
    }
  }, [buildUrl, active, onCwdChange, onActivity])

  // ── Send input ────────────────────────────────────────────────────────────
  const sendInput = useCallback((data) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(data)))
    ws.send(JSON.stringify({ type: 'input', data: encoded }))
  }, [])

  // ── Send resize ───────────────────────────────────────────────────────────
  const sendResize = useCallback((cols, rows) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'resize', cols, rows }))
  }, [])

  // ── Initialize xterm ──────────────────────────────────────────────────────
  const initTerm = useCallback(async () => {
    if (!containerRef.current || !mountedRef.current) return

    const [
      { Terminal: XTerm },
      { FitAddon },
      { WebLinksAddon },
      { SearchAddon },
      { SerializeAddon },
      { Unicode11Addon },
    ] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links'),
      import('@xterm/addon-search'),
      import('@xterm/addon-serialize'),
      import('@xterm/addon-unicode11'),
    ])
    await import('@xterm/xterm/css/xterm.css')

    // Dispose previous
    if (termRef.current) {
      try { termRef.current.dispose() } catch (_) {}
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      try { wsRef.current.close(1000) } catch (_) {}
    }

    const s = settings || loadSettings()
    const themeObj = THEMES[s.theme] || THEMES['one-dark']

    const term = new XTerm({
      cursorBlink: s.cursorBlink,
      cursorStyle: s.cursorStyle,
      cursorWidth: 2,
      scrollback: s.scrollback,
      tabStopWidth: 4,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing ?? 0,
      theme: themeObj,
      allowProposedApi: true,
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 4.5,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}\'":;,`|',
      overviewRulerWidth: 10,
      smoothScrollDuration: 100,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon((_, uri) => window.open(uri, '_blank'))
    const searchAddon = new SearchAddon()
    const serializeAddon = new SerializeAddon()
    const unicode11Addon = new Unicode11Addon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(serializeAddon)
    term.loadAddon(unicode11Addon)
    term.unicode.activeVersion = '11'

    containerRef.current.innerHTML = ''
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon
    serializeAddonRef.current = serializeAddon

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch (_) {}
    })

    // Forward input
    term.onData((data) => {
      // Copy-on-select
      if (s.copyOnSelect && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection()).catch(() => {})
      }
      sendInput(data)
    })

    // Track bracketed paste mode
    term.onData((data) => {
      if (data === '\x1b[?2004h') bracketedPasteRef.current = true
      if (data === '\x1b[?2004l') bracketedPasteRef.current = false
    })

    // Bell
    if (s.bell) {
      term.onBell(() => {
        try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play() } catch (_) {}
      })
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!mountedRef.current) return
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
          sendResize(term.cols, term.rows)
        } catch (_) {}
      })
    })
    ro.observe(containerRef.current)
    term._ro = ro

    connect()
  }, [settings, connect, sendInput, sendResize])

  // ── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    initTerm()
    return () => {
      mountedRef.current = false
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        try { wsRef.current.close(1000) } catch (_) {}
      }
      if (termRef.current) {
        if (termRef.current._ro) termRef.current._ro.disconnect()
        try { termRef.current.dispose() } catch (_) {}
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply settings changes live ───────────────────────────────────────────
  useEffect(() => {
    const term = termRef.current
    if (!term || !settings) return
    term.options.fontSize = settings.fontSize
    term.options.fontFamily = settings.fontFamily
    term.options.cursorStyle = settings.cursorStyle
    term.options.cursorBlink = settings.cursorBlink
    term.options.lineHeight = settings.lineHeight
    term.options.scrollback = settings.scrollback
  }, [settings])

  // ── Apply theme changes live ──────────────────────────────────────────────
  useEffect(() => {
    const term = termRef.current
    if (!term || !theme) return
    term.options.theme = theme
  }, [theme])

  // ── Focus when active ─────────────────────────────────────────────────────
  useEffect(() => {
    if (active && termRef.current) {
      termRef.current.focus()
    }
  }, [active])

  return {
    containerRef,
    termRef,
    fitAddonRef,
    searchAddonRef,
    serializeAddonRef,
    wsRef,
    status,
    reconnectAttempt,
    currentCwd,
    sendInput,
    sendResize,
    reconnect: connect,
  }
}

// ── OSC 7 parser ──────────────────────────────────────────────────────────────
function _parseOsc7(text, callback) {
  // OSC 7 format: \033]7;file://hostname/path\007
  const re = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*)\x07/g
  let m
  while ((m = re.exec(text)) !== null) {
    try {
      callback(decodeURIComponent(m[1]))
    } catch (_) {}
  }
}
