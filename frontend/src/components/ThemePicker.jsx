import React from 'react'
import { X, Check } from 'lucide-react'
import { THEMES, THEME_KEYS } from '../themes.js'
import { useIDEStore } from '../store/useIDEStore.js'

// Small color swatch showing the theme's key colors
function ThemeSwatch({ themeKey }) {
  const t = THEMES[themeKey]
  const v = t.vars
  return (
    <div className="flex gap-0.5 rounded overflow-hidden" style={{ width: 48, height: 28 }}>
      <div style={{ background: v['--bg-app'], flex: 1 }} />
      <div style={{ background: v['--bg-panel'], flex: 1 }} />
      <div style={{ background: v['--accent'], width: 6 }} />
    </div>
  )
}

export default function ThemePicker({ open, onClose }) {
  const { theme, setTheme } = useIDEStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-xl shadow-2xl overflow-hidden w-[480px] max-w-[95vw]"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>Color Theme</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Choose an appearance for the IDE</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Theme grid */}
        <div className="p-4 grid grid-cols-2 gap-2">
          {THEME_KEYS.map(key => {
            const t = THEMES[key]
            const isActive = theme === key
            return (
              <button
                key={key}
                onClick={() => { setTheme(key); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                style={{
                  background: isActive ? 'var(--bg-selected)' : 'var(--bg-hover)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-light)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <ThemeSwatch themeKey={key} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: isActive ? 'var(--text-bright)' : 'var(--text-primary)' }}>
                    {t.name}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {t.monacoTheme === 'vs' ? 'Light' : 'Dark'}
                  </div>
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          Theme is saved automatically and restored on next launch.
        </div>
      </div>
    </div>
  )
}
