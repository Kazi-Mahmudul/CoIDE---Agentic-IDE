/**
 * TerminalInstance — manages a single xterm.js terminal + WebSocket entirely
 * outside of React's render cycle.
 *
 * The xterm DOM node is created once and physically moved between containers
 * when tabs switch. This means:
 * - The terminal is NEVER re-initialized on tab switch
 * - Output is never lost
 * - fitAddon always has a real container to measure
 *
 * Usage:
 *   const inst = new TerminalInstance(sessionId, cwd, settings, theme)
 *   inst.mount(domElement)      // attach xterm to a DOM node
 *   inst.unmount()              // detach (keeps xterm alive, WS running)
 *   inst.fit()                  // call after mount or resize
 *   inst.destroy()              // full cleanup on tab close
 */

import { v4 as uuidv4 } from 'uuid'
import { getTerminalWsBase } from './config.js'
import { getAuthToken } from '../api.js'

const WS_BASE = getTerminalWsBase()
const MAX_RECONNECT = 5
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]
const PING_INTERVAL = 30_000

export class TerminalInstance {
  constructor(sessionId, cwd, settings, theme, callbacks = {}) {
    this.sessionId = sessionId || uuidv4()
    this.cwd = cwd || ''
    this.settings = settings
    this.theme = theme
    this.callbacks = callbacks  // { onCwdChange, onActivity, onStatusChange }

    this.term = null
    this.fitAddon = null
    this.searchAddon = null
    this.serializeAddon = null
    this.ws = null
    this.container = null       // the xterm wrapper div (lives outside React)
    this.mountTarget = null     // the React-managed div we're currently inside

    this._pingTimer = null
    this._reconnectTimer = null
    this._reconnectAttempt = 0
    this._destroyed = false
    this._ro = null             // ResizeObserver on mountTarget
    this._status = 'connecting'
    this._initialized = false
  }

  // ── Initialize (async, call once) ─────────────────────────────────────────
  async init() {
    if (this._initialized) return
    this._initialized = true

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

    const s = this.settings
    const themeObj = this.theme

    this.term = new XTerm({
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

    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()
    this.serializeAddon = new SerializeAddon()
    const webLinksAddon = new WebLinksAddon((_, uri) => window.open(uri, '_blank'))
    const unicode11Addon = new Unicode11Addon()

    this.term.loadAddon(this.fitAddon)
    this.term.loadAddon(webLinksAddon)
    this.term.loadAddon(this.searchAddon)
    this.term.loadAddon(this.serializeAddon)
    this.term.loadAddon(unicode11Addon)
    this.term.unicode.activeVersion = '11'

    // Create a persistent wrapper div that xterm owns
    this.container = document.createElement('div')
    this.container.style.cssText = 'width:100%;height:100%;'

    this.term.open(this.container)

    // Forward input to WS
    this.term.onData((data) => {
      if (s.copyOnSelect && this.term.hasSelection()) {
        navigator.clipboard.writeText(this.term.getSelection()).catch(() => {})
      }
      this._sendInput(data)
    })

    this._connect()
  }

  // ── Mount into a React-managed DOM node ───────────────────────────────────
  mount(targetEl) {
    if (!targetEl || !this.container) return
    this.mountTarget = targetEl

    // Move xterm's container into the target
    targetEl.innerHTML = ''
    targetEl.appendChild(this.container)

    // Observe target for size changes
    this._ro = new ResizeObserver(() => {
      requestAnimationFrame(() => this.fit())
    })
    this._ro.observe(targetEl)

    // Fit immediately after mount
    requestAnimationFrame(() => this.fit())

    this.term?.focus()
  }

  // ── Detach from current target (keeps xterm + WS alive) ──────────────────
  unmount() {
    if (this._ro) {
      this._ro.disconnect()
      this._ro = null
    }
    // Move container to a detached holding div so xterm stays alive
    if (this.container && this.container.parentNode) {
      const holder = document.getElementById('__terminal_holder__') || (() => {
        const d = document.createElement('div')
        d.id = '__terminal_holder__'
        d.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;top:-9999px;left:-9999px;'
        document.body.appendChild(d)
        return d
      })()
      holder.appendChild(this.container)
    }
    this.mountTarget = null
  }

  // ── Fit terminal to current container size ────────────────────────────────
  fit() {
    if (!this.fitAddon || !this.mountTarget) return
    try {
      this.fitAddon.fit()
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'resize',
          cols: this.term.cols,
          rows: this.term.rows,
        }))
      }
    } catch (_) {}
  }

  // ── Apply settings live ───────────────────────────────────────────────────
  applySettings(s) {
    this.settings = s
    if (!this.term) return
    this.term.options.fontSize = s.fontSize
    this.term.options.fontFamily = s.fontFamily
    this.term.options.cursorStyle = s.cursorStyle
    this.term.options.cursorBlink = s.cursorBlink
    this.term.options.lineHeight = s.lineHeight
    this.term.options.scrollback = s.scrollback
    requestAnimationFrame(() => this.fit())
  }

  // ── Apply theme live ──────────────────────────────────────────────────────
  applyTheme(theme) {
    this.theme = theme
    if (this.term) this.term.options.theme = theme
  }

  // ── Send raw text input ───────────────────────────────────────────────────
  sendInput(data) {
    this._sendInput(data)
  }

  // ── Full cleanup ──────────────────────────────────────────────────────────
  destroy() {
    this._destroyed = true
    if (this._pingTimer) clearInterval(this._pingTimer)
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer)
    if (this._ro) this._ro.disconnect()
    if (this.ws) {
      this.ws.onclose = null
      try { this.ws.close(1000) } catch (_) {}
    }
    if (this.term) {
      try { this.term.dispose() } catch (_) {}
    }
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }

  get status() { return this._status }

  // ── Private ───────────────────────────────────────────────────────────────

  _setStatus(s) {
    this._status = s
    this.callbacks.onStatusChange?.(s)
  }

  _sendInput(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(data)))
      this.ws.send(JSON.stringify({ type: 'input', data: encoded }))
    } catch (_) {}
  }

  _connect() {
    if (this._destroyed) return
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    const params = new URLSearchParams({ session_id: this.sessionId })
    const token = getAuthToken()
    if (token) params.set('token', token)
    if (this.cwd) params.set('cwd', this.cwd)
    const url = `${WS_BASE}?${params}`

    const ws = new WebSocket(url)
    this.ws = ws
    this._setStatus('connecting')

    ws.onopen = () => {
      if (this._destroyed) { ws.close(1000); return }
      this._setStatus('connected')
      this._reconnectAttempt = 0

      // Send current size
      if (this.term && this.fitAddon && this.mountTarget) {
        try {
          this.fitAddon.fit()
          ws.send(JSON.stringify({ type: 'resize', cols: this.term.cols, rows: this.term.rows }))
        } catch (_) {}
      }

      // Ping
      if (this._pingTimer) clearInterval(this._pingTimer)
      this._pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, PING_INTERVAL)
    }

    ws.onmessage = (event) => {
      if (this._destroyed) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          const raw = atob(msg.data)
          const bytes = new Uint8Array(raw.length)
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
          const text = new TextDecoder().decode(bytes)
          _parseOsc7(text, (newCwd) => this.callbacks.onCwdChange?.(newCwd))
          this.term?.write(bytes)
          this.callbacks.onActivity?.()
        } else if (msg.type === 'session') {
          this.sessionId = msg.session_id
        }
      } catch (_) {}
    }

    ws.onclose = (e) => {
      if (this._destroyed) return
      if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null }
      this._setStatus('disconnected')
      if (e.code === 1000) return

      if (this._reconnectAttempt < MAX_RECONNECT) {
        const delay = RECONNECT_DELAYS[this._reconnectAttempt] ?? 16000
        this._reconnectAttempt++
        this._reconnectTimer = setTimeout(() => this._connect(), delay)
      }
    }

    ws.onerror = () => {
      this._setStatus('disconnected')
    }
  }
}

function _parseOsc7(text, callback) {
  const re = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*)\x07/g
  let m
  while ((m = re.exec(text)) !== null) {
    try { callback(decodeURIComponent(m[1])) } catch (_) {}
  }
}
