import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useIDEStore } from '../../store/useIDEStore.js'
import { useCommandStore } from '../../store/useCommandStore.js'

function highlight(text, query) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

export default function CommandPalette({ openFiles, workspaceFiles = [], onOpenFile }) {
  const { commandPaletteOpen, commandPalettePrefix, closeCommandPalette } = useIDEStore()
  const { commands, run, getRecent } = useCommandStore()

  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (commandPaletteOpen) {
      const prefix = commandPalettePrefix || ''
      setInput(prefix === '>' ? '>' : prefix)
      setSelected(0)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
    }
  }, [commandPaletteOpen, commandPalettePrefix])

  const mode = useMemo(() => {
    if (input.startsWith('>')) return 'command'
    if (input.startsWith('@')) return 'symbol'
    if (input.startsWith(':')) return 'line'
    return 'file'
  }, [input])

  const query = useMemo(() => {
    if (mode !== 'file') return input.slice(1).trim()
    return input.trim()
  }, [input, mode])

  const items = useMemo(() => {
    if (mode === 'command') {
      const recent = getRecent()
      const all = query
        ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
        : [...recent, ...commands.filter(c => !recent.find(r => r.id === c.id))]
      return all.slice(0, 50)
    }
    if (mode === 'file') {
      const openPaths = new Set(openFiles.map(f => f.path))
      const wsItems = workspaceFiles
        .filter(f => !openPaths.has(f.path))
        .map(f => ({ id: f.path, label: f.name || f.path.split('/').pop(), description: f.path, _path: f.path }))
      const openItems = openFiles.map(f => ({ id: f.id, label: f.label, description: f.path, _file: f }))
      const all = [...openItems, ...wsItems]
      return query
        ? all.filter(f => f.label.toLowerCase().includes(query.toLowerCase()) || f.description?.toLowerCase().includes(query.toLowerCase()))
        : all.slice(0, 30)
    }
    if (mode === 'line') {
      const n = parseInt(query)
      if (!isNaN(n) && n > 0) return [{ id: `line:${n}`, label: `Go to line ${n}`, description: '', _line: n }]
      return []
    }
    return []
  }, [mode, query, commands, openFiles, workspaceFiles, getRecent])

  useEffect(() => { setSelected(0) }, [items.length, query])

  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const execute = useCallback((item) => {
    closeCommandPalette()
    if (mode === 'command') run(item.id)
    else if (mode === 'file') { if (item._file) onOpenFile?.(item._file); else if (item._path) onOpenFile?.(item._path) }
    else if (mode === 'line' && item._line) onOpenFile?.({ _goToLine: item._line })
  }, [mode, run, closeCommandPalette, onOpenFile])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); if (items[selected]) execute(items[selected]); return }
  }

  if (!commandPaletteOpen) return null

  const modeHint = mode === 'command' ? '> commands' : mode === 'file' ? 'files' : mode === 'symbol' ? '@ symbols' : ': line'
  const placeholder = mode === 'command' ? 'Type a command…' : mode === 'file' ? 'Type a file name…' : mode === 'symbol' ? 'Type a symbol…' : 'Go to line…'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={closeCommandPalette}
    >
      <div
        className="w-[600px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', animation: 'palette-in 100ms ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{modeHint}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text-bright)' }}
          />
          {items.length > 0 && (
            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{items.length}</span>
          )}
        </div>

        {/* Hint */}
        {!query && mode === 'command' && (
          <div className="px-3 py-1 text-[11px] flex gap-3" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <span><kbd className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>↑↓</kbd> navigate</span>
            <span><kbd className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>Enter</kbd> run</span>
            <span><kbd className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>Esc</kbd> close</span>
            <span className="ml-auto">
              <kbd className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>@</kbd> symbols ·{' '}
              <kbd className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>:</kbd> line
            </span>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {items.length === 0 && query && (
            <div className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>No results for "{query}"</div>
          )}
          {items.length === 0 && !query && mode !== 'command' && (
            <div className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {mode === 'file' ? 'No files open. Open a folder first.' : 'Type to search…'}
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => execute(item)}
              className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-left transition-colors"
              style={{
                background: i === selected ? 'var(--bg-selected)' : 'transparent',
                color: i === selected ? 'var(--text-bright)' : 'var(--text-primary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = i === selected ? 'var(--bg-selected)' : 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = i === selected ? 'var(--bg-selected)' : 'transparent' }}
            >
              <span className="flex-1 truncate min-w-0">{highlight(item.label, query)}</span>
              <span className="text-[11px] ml-4 flex-shrink-0 truncate max-w-[240px] text-right" style={{ color: i === selected ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {item.shortcut || item.description || ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
