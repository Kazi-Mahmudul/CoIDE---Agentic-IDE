import React, { useState, useMemo } from 'react'
import { Blocks, Search, Palette, Check, Star } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'
import { THEMES } from '../../themes.js'

const BUILT_IN_EXTENSIONS = [
  {
    id: 'theme-dark',
    name: 'Dark+ (Default)',
    description: 'The default dark color theme',
    category: 'Themes',
    icon: '🎨',
    themeId: 'dark',
    installed: true,
  },
  {
    id: 'theme-light',
    name: 'Light+',
    description: 'A clean light color theme',
    category: 'Themes',
    icon: '☀️',
    themeId: 'light',
    installed: true,
  },
  {
    id: 'theme-dracula',
    name: 'Dracula Theme',
    description: 'A dark theme for many editors, inspired by Dracula',
    category: 'Themes',
    icon: '🧛',
    themeId: 'dracula',
    installed: true,
    stars: 4.8,
    downloads: '12M',
  },
  {
    id: 'theme-nord',
    name: 'Nord',
    description: 'An arctic, north-bluish clean color theme',
    category: 'Themes',
    icon: '❄️',
    themeId: 'nord',
    installed: true,
    stars: 4.7,
    downloads: '5M',
  },
  {
    id: 'theme-monokai',
    name: 'Monokai Pro',
    description: 'Professional theme with carefully chosen colors',
    category: 'Themes',
    icon: '🎭',
    themeId: 'monokai',
    installed: true,
    stars: 4.9,
    downloads: '8M',
  },
  {
    id: 'theme-solarized',
    name: 'Solarized Dark',
    description: 'Precision colors for machines and people',
    category: 'Themes',
    icon: '🌅',
    themeId: 'solarized-dark',
    installed: true,
    stars: 4.6,
    downloads: '3M',
  },
  {
    id: 'theme-github',
    name: 'GitHub Dark',
    description: 'GitHub\'s dark theme for code editors',
    category: 'Themes',
    icon: '🐙',
    themeId: 'github-dark',
    installed: true,
    stars: 4.8,
    downloads: '6M',
  },
  {
    id: 'theme-tokyo',
    name: 'Tokyo Night',
    description: 'A clean, dark theme celebrating the lights of Tokyo',
    category: 'Themes',
    icon: '🌃',
    themeId: 'tokyo-night',
    installed: true,
    stars: 4.9,
    downloads: '7M',
  },
  {
    id: 'ext-prettier',
    name: 'Prettier',
    description: 'Code formatter using Prettier',
    category: 'Formatters',
    icon: '✨',
    installed: false,
    stars: 4.5,
    downloads: '30M',
  },
  {
    id: 'ext-eslint',
    name: 'ESLint',
    description: 'Integrates ESLint JavaScript into the IDE',
    category: 'Linters',
    icon: '🔍',
    installed: false,
    stars: 4.7,
    downloads: '28M',
  },
  {
    id: 'ext-python',
    name: 'Python',
    description: 'Rich support for the Python language',
    category: 'Languages',
    icon: '🐍',
    installed: false,
    stars: 4.8,
    downloads: '90M',
  },
  {
    id: 'ext-copilot',
    name: 'AI Copilot',
    description: 'AI-powered code completion (built-in via Agent)',
    category: 'AI',
    icon: '🤖',
    installed: true,
    stars: 4.9,
    downloads: '15M',
  },
]

export default function ExtensionsPanel() {
  const { theme, setTheme } = useIDEStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = useMemo(() => {
    const cats = new Set(BUILT_IN_EXTENSIONS.map(e => e.category))
    return ['All', ...Array.from(cats)]
  }, [])

  const filtered = useMemo(() => {
    return BUILT_IN_EXTENSIONS.filter(ext => {
      const matchSearch = !search || ext.name.toLowerCase().includes(search.toLowerCase()) ||
        ext.description.toLowerCase().includes(search.toLowerCase())
      const matchCategory = selectedCategory === 'All' || ext.category === selectedCategory
      return matchSearch && matchCategory
    })
  }, [search, selectedCategory])

  const handleExtClick = (ext) => {
    if (ext.themeId) {
      setTheme(ext.themeId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1 rounded px-2 py-1.5"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
        >
          <Search size={12} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search extensions..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-bright)' }}
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-2 py-0.5 rounded-full text-[10px] transition-colors"
              style={{
                background: selectedCategory === cat ? 'var(--accent)' : 'var(--bg-input)',
                color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedCategory === cat ? 'var(--accent)' : 'var(--border-light)'}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Blocks size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No extensions found</div>
          </div>
        ) : (
          filtered.map(ext => {
            const isActiveTheme = ext.themeId && theme === ext.themeId
            return (
              <button
                key={ext.id}
                onClick={() => handleExtClick(ext)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                style={{ background: isActiveTheme ? 'var(--bg-selected)' : 'transparent' }}
                onMouseEnter={e => { if (!isActiveTheme) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActiveTheme) e.currentTarget.style.background = isActiveTheme ? 'var(--bg-selected)' : 'transparent' }}
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{ext.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-bright)' }}>
                      {ext.name}
                    </span>
                    {isActiveTheme && (
                      <Check size={11} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {ext.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {ext.stars && (
                      <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        <Star size={8} /> {ext.stars}
                      </span>
                    )}
                    {ext.downloads && (
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        ↓ {ext.downloads}
                      </span>
                    )}
                    <span className="text-[9px] px-1 rounded" style={{
                      background: ext.installed ? 'rgba(115,201,145,0.15)' : 'var(--bg-input)',
                      color: ext.installed ? '#73c991' : 'var(--text-muted)',
                    }}>
                      {ext.installed ? 'Installed' : 'Available'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
