import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as TerminalIcon, RotateCcw } from 'lucide-react'

export default function Terminal({ cwd }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState('connecting') // connecting | connected | disconnected

  // Build WebSocket URL — pass cwd as query param if provided
  const buildWsUrl = useCallback(() => {
    const base = 'ws://localhost:8000/ws/terminal'
    if (cwd) return `${base}?cwd=${encodeURIComponent(cwd)}`
    return base
  }, [cwd])

  const connectWs = useCallback((term, fitAddon) => {
    if (!mountedRef.current) return
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    const ws = new WebSocket(buildWsUrl())
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'
    setStatus('connecting')

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      setStatus('connected')
      // Send initial terminal size
      try {
        const dims = fitAddon.proposeDimensions()
        if (dims && dims.cols > 0 && dims.rows > 0) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      } catch (_) {}
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data))
        } else {
          term.write(event.data)
        }
      } catch (_) {}
    }

    ws.onclose = (e) => {
      if (!mountedRef.current) return
      setStatus('disconnected')
      // Only auto-reconnect on unexpected close (not clean close code 1000)
      if (e.code !== 1000) {
        term.write('\r\n\x1b[33m[Reconnecting in 3s…]\x1b[0m\r\n')
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connectWs(term, fitAddon)
        }, 3000)
      }
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setStatus('disconnected')
      term.write('\r\n\x1b[31m[Connection error — backend may not be running]\x1b[0m\r\n')
    }

    // Forward keystrokes / paste to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    return ws
  }, [buildWsUrl])

  const initTerminal = useCallback(async () => {
    if (!containerRef.current || !mountedRef.current) return

    // Lazy-load xterm
    const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
      import('xterm'),
      import('xterm-addon-fit'),
    ])
    await import('xterm/css/xterm.css')

    // Dispose previous instance
    if (termRef.current) {
      try { termRef.current.dispose() } catch (_) {}
    }
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent reconnect loop on manual dispose
      try { wsRef.current.close(1000) } catch (_) {}
    }

    const term = new XTerm({
      theme: {
        background: '#141414',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        cursorAccent: '#141414',
        selectionBackground: 'rgba(38, 79, 120, 0.7)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: false,
      scrollback: 10000,
      convertEol: false,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Clear container and mount
    containerRef.current.innerHTML = ''
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Initial fit
    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch (_) {}
    })

    // Connect WebSocket
    connectWs(term, fitAddon)

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!mountedRef.current) return
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
          const dims = fitAddon.proposeDimensions()
          if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
          }
        } catch (_) {}
      })
    })
    ro.observe(containerRef.current)
    term._ro = ro
  }, [connectWs])

  // Init on mount
  useEffect(() => {
    mountedRef.current = true
    initTerminal()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        try { wsRef.current.close(1000) } catch (_) {}
      }
      if (termRef.current) {
        if (termRef.current._ro) termRef.current._ro.disconnect()
        try { termRef.current.dispose() } catch (_) {}
      }
    }
  }, []) // only on mount/unmount

  // Re-init when cwd changes (new folder opened)
  useEffect(() => {
    if (termRef.current) {
      // Close existing WS cleanly and reconnect with new cwd
      if (wsRef.current) {
        wsRef.current.onclose = null
        try { wsRef.current.close(1000) } catch (_) {}
      }
      if (termRef.current && fitAddonRef.current) {
        termRef.current.write('\r\n\x1b[36m[Switching to: ' + (cwd || 'workspace') + ']\x1b[0m\r\n')
        connectWs(termRef.current, fitAddonRef.current)
      }
    }
  }, [cwd]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReconnect = useCallback(() => {
    if (termRef.current) {
      termRef.current.write('\r\n\x1b[33m[Reconnecting…]\x1b[0m\r\n')
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      try { wsRef.current.close(1000) } catch (_) {}
    }
    if (termRef.current && fitAddonRef.current) {
      connectWs(termRef.current, fitAddonRef.current)
    }
  }, [connectWs])

  const statusColor = {
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
    disconnected: 'text-red-500',
  }[status]

  const statusDot = {
    connecting: '◌',
    connected: '●',
    disconnected: '○',
  }[status]

  return (
    <div className="h-full flex flex-col bg-[#141414]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] border-b border-[#333] flex-shrink-0">
        <TerminalIcon size={12} className="text-[#858585]" />
        <span className="text-xs text-[#858585]">Terminal</span>
        {cwd && (
          <span className="text-xs text-[#555] truncate max-w-[200px]" title={cwd}>
            — {cwd.split(/[/\\]/).pop() || cwd}
          </span>
        )}
        <div className="flex-1" />
        <span className={`text-[10px] ${statusColor}`} title={status}>
          {statusDot}
        </span>
        <button
          onClick={handleReconnect}
          className="p-1 rounded hover:bg-[#3a3a3a] text-[#555] hover:text-[#858585] transition-colors"
          title="Reconnect"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        style={{ padding: '4px 6px', background: '#141414' }}
      />
    </div>
  )
}
