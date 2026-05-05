/**
 * TerminalSettings — slide-in drawer with all terminal settings.
 */
import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { THEMES, THEME_KEYS } from '../../terminal/themes.js'
import { DEFAULT_SETTINGS } from '../../terminal/settings.js'

const FONT_FAMILIES = [
  'JetBrains Mono, monospace',
  'Fira Code, monospace',
  'Cascadia Code, monospace',
  'Menlo, monospace',
  'Consolas, monospace',
  'monospace',
]

export default function TerminalSettings({ open, settings, onUpdate, onClose }) {
  const drawerRef = useRef(null)

  // Focus trap
  useEffect(() => {
    if (open) drawerRef.current?.focus()
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])

  if (!open) return null

  const Row = ({ label, children }) => (
    <div className="flex items-center justify-between py-2 border-b border-[#333]">
      <span className="text-xs text-[#858585]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative ${value ? 'bg-[#007acc]' : 'bg-[#555]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <div
      ref={drawerRef}
      tabIndex={-1}
      className="absolute right-0 top-0 bottom-0 w-80 bg-[#1e1e1e] border-l border-[#333] z-40 flex flex-col shadow-2xl overflow-hidden"
      role="dialog"
      aria-label="Terminal settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] flex-shrink-0">
        <span className="text-sm font-semibold text-[#d4d4d4]">Terminal Settings</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4]">
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Font size */}
        <Row label={`Font Size: ${settings.fontSize}px`}>
          <input
            type="range" min={8} max={24} value={settings.fontSize}
            onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-24 accent-[#007acc]"
          />
        </Row>

        {/* Font family */}
        <Row label="Font Family">
          <select
            value={settings.fontFamily}
            onChange={e => onUpdate({ fontFamily: e.target.value })}
            className="bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 text-xs text-[#d4d4d4] focus:outline-none focus:border-[#007acc]"
          >
            {FONT_FAMILIES.map(f => (
              <option key={f} value={f}>{f.split(',')[0]}</option>
            ))}
          </select>
        </Row>

        {/* Cursor style */}
        <Row label="Cursor Style">
          <div className="flex gap-1">
            {['block', 'underline', 'bar'].map(s => (
              <button
                key={s}
                onClick={() => onUpdate({ cursorStyle: s })}
                className={`px-2 py-0.5 text-xs rounded capitalize transition-colors ${
                  settings.cursorStyle === s ? 'bg-[#007acc] text-white' : 'bg-[#3c3c3c] text-[#858585] hover:text-[#d4d4d4]'
                }`}
              >{s}</button>
            ))}
          </div>
        </Row>

        {/* Cursor blink */}
        <Row label="Cursor Blink">
          <Toggle value={settings.cursorBlink} onChange={v => onUpdate({ cursorBlink: v })} />
        </Row>

        {/* Line height */}
        <Row label={`Line Height: ${settings.lineHeight.toFixed(1)}`}>
          <input
            type="range" min={10} max={20} value={Math.round(settings.lineHeight * 10)}
            onChange={e => onUpdate({ lineHeight: Number(e.target.value) / 10 })}
            className="w-24 accent-[#007acc]"
          />
        </Row>

        {/* Scrollback */}
        <Row label="Scrollback Lines">
          <select
            value={settings.scrollback}
            onChange={e => onUpdate({ scrollback: Number(e.target.value) })}
            className="bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 text-xs text-[#d4d4d4] focus:outline-none"
          >
            {[1000, 5000, 10000, 50000].map(n => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
        </Row>

        {/* Copy on select */}
        <Row label="Copy on Select">
          <Toggle value={settings.copyOnSelect} onChange={v => onUpdate({ copyOnSelect: v })} />
        </Row>

        {/* Bell */}
        <Row label="Bell">
          <Toggle value={settings.bell} onChange={v => onUpdate({ bell: v })} />
        </Row>

        {/* Theme */}
        <div className="py-2">
          <div className="text-xs text-[#858585] mb-2">Theme</div>
          <div className="grid grid-cols-2 gap-2">
            {THEME_KEYS.map(key => {
              const t = THEMES[key]
              return (
                <button
                  key={key}
                  onClick={() => onUpdate({ theme: key })}
                  className={`flex items-center gap-2 p-2 rounded border transition-colors text-left ${
                    settings.theme === key
                      ? 'border-[#007acc] bg-[#094771]'
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                >
                  {/* Color swatch */}
                  <div
                    className="w-6 h-6 rounded flex-shrink-0 border border-[#555]"
                    style={{ background: t.background }}
                  />
                  <span className="text-[10px] text-[#d4d4d4] truncate">{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#333] flex-shrink-0">
        <button
          onClick={() => onUpdate({ ...DEFAULT_SETTINGS })}
          className="w-full py-1.5 text-xs text-[#858585] hover:text-[#d4d4d4] border border-[#333] hover:border-[#555] rounded transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
