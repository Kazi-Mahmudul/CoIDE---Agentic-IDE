/**
 * TerminalPane — mounts a TerminalInstance into a DOM slot.
 *
 * The TerminalInstance (xterm + WebSocket) is created once per tab and lives
 * in a manager outside React. This component just provides the DOM slot and
 * calls mount()/unmount() when it becomes active/inactive.
 *
 * This means switching tabs NEVER re-initializes xterm — the terminal history
 * is always preserved exactly as in a native IDE.
 */
import React, { useEffect, useRef, useState } from 'react'

export default function TerminalPane({ instance, active, onRef }) {
  const slotRef = useRef(null)
  const [status, setStatus] = useState('connecting')

  // Wire up status callback so parent can read it
  useEffect(() => {
    if (!instance) return
    const prev = instance.callbacks.onStatusChange
    instance.callbacks.onStatusChange = (s) => {
      setStatus(s)
      prev?.(s)
    }
    // Sync current status
    setStatus(instance.status)
  }, [instance])

  // Expose to parent
  useEffect(() => {
    if (onRef && instance) {
      onRef({
        searchAddon: instance.searchAddon,
        sendInput: (d) => instance.sendInput(d),
        fit: () => instance.fit(),
        status,
        reconnect: () => instance._connect(),
      })
    }
  })

  // Mount / unmount the xterm DOM node when active changes
  useEffect(() => {
    if (!instance || !slotRef.current) return
    if (active) {
      instance.mount(slotRef.current)
    } else {
      instance.unmount()
    }
  }, [active, instance])

  // Also mount on first render if active
  useEffect(() => {
    if (active && instance && slotRef.current) {
      instance.mount(slotRef.current)
    }
    // Cleanup: unmount when this pane component unmounts
    return () => {
      if (instance) instance.unmount()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--bg-editor)' }}>
      {/* xterm mounts here imperatively */}
      <div
        ref={slotRef}
        className="h-full w-full"
        style={{ padding: '4px 6px' }}
        aria-label="Terminal output"
      />

      {/* Disconnected overlay */}
      {status === 'disconnected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 backdrop-blur-sm" style={{ background: 'var(--bg-overlay)' }}>
          <div className="text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-secondary)' }} />
            Reconnecting…
          </div>
          <button
            onClick={() => instance?._connect()}
            className="px-3 py-1.5 text-xs rounded transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
          >
            Reconnect now
          </button>
        </div>
      )}
    </div>
  )
}
