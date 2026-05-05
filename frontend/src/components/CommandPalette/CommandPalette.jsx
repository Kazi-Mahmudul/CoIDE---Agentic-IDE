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
      <span className="text-[#007acc] font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

export default function CommandPalette({ openFiles, onOpenFile }) {
  const { commandPaletteOpen, commandPalettePrefix, closeCommandPalette } = useIDEStore()
  const { commands, run, getRecent } = useCommandStore()

  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Reset when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setInput(commandPalettePrefix === '>' ? '>' : commandPalettePrefix || '')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [commandPaletteOpen, commandPalettePrefix])

  const mode = useMemo(() => {
    if (input.startsWith('>')) return 'command'
    if (input.startsWith('@')) return 'symbol'
    if (input.startsWith(':')) return 'line'
    return 'file'
  }, [input])

  const query = useMemo(() => {
    if (mode === 'command') return input.slice(1).trim()
    if (mode === 'symbol' || mode === 'line') return input.slice(1).trim()
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
      return openFiles
        .filter(f => !query || f.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20)
        .map(f => ({ id: f.id, label: f.label, description: f.path, _file: f }))
    }
    return []
  }, [mode, query, commands, openFiles, getRecent])

  useEffect(() => {
    setSelected(0)
  }, [items.length, query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const execute = useCallback((item) => {
    closeCommandPalette()
    if (mode === 'command') {
      run(item.id)
    } else if (mode === 'file' && item._file) {
      onOpenFile?.(item._file)
    } else if (mode === 'line') {
      const lineNum = parseInt(query)
      if (!isNaN(lineNum)) onOpenFile?.({ _goToLine: lineNum })
    }
  }, [mode, query, run, closeCommandPalette, onOpenFile])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (items[selected]) execute(items[selected])
      return
    }
  }

  if (!commandPaletteOpen) return null

  const placeholder = mode === 'command' ? 'Type a command…'
    : mode === 'file' ? 'Type a file name…'
    : mode === 'symbol' ? 'Type a symbol…'
    : 'Go to line…'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={closeCommandPalette}>
      <div
        className="w-[600px] max-w-[90vw] bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'palette-in 100ms ease' }}
      >
        {/* Input */}
        <div className="flex items-center px-3 py-2 border-b border-[#333]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13px] text-[#d4d4d4] placeholder-[#555] outline-none"
          />
        </div>

        {/* Mode hint */}
        {!query && mode === 'command' && (
          <div className="px-3 py-1 text-[11px] text-[#555] border-b border-[#333]">
            Type to search commands · <kbd className="bg-[#3a3a3a] px-1 rounded">↑↓</kbd> navigate · <kbd className="bg-[#3a3a3a] px-1 rounded">Enter</kbd> run · <kbd className="bg-[#3a3a3a] px-1 rounded">Esc</kbd> close
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {items.length === 0 && query && (
            <div className="px-4 py-3 text-[13px] text-[#555]">No results for "{query}"</div>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => execute(item)}
              className={`w-full flex items-center justify-between px-4 py-2 text-[13px] text-left transition-colors
                ${i === selected ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
            >
              <span className="flex-1 truncate">
                {highlight(item.label, query)}
              </span>
              {item.shortcut && (
                <span className={`text-[11px] ml-4 flex-shrink-0 ${i === selected ? 'text-[#aaa]' : 'text-[#858585]'}`}>
                  {item.shortcut}
                </span>
              )}
              {item.description && (
                <span className={`text-[11px] ml-4 flex-shrink-0 truncate max-w-[200px] ${i === selected ? 'text-[#aaa]' : 'text-[#555]'}`}>
                  {item.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
