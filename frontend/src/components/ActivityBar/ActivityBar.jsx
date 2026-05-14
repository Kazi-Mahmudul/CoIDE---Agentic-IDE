import React from 'react'
import { Files, Search, GitBranch, Blocks, User, Settings, MessageSquare } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'

const TOP_ITEMS = [
  { id: 'explorer',   icon: Files,         label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search',     icon: Search,        label: 'Search (Ctrl+Shift+F)' },
  { id: 'git',        icon: GitBranch,     label: 'Source Control' },
  { id: 'extensions', icon: Blocks,        label: 'Extensions (Ctrl+Shift+X)' },
  { id: 'chat',       icon: MessageSquare, label: 'Agent Chat' },
]

const BOTTOM_ITEMS = [
  { id: 'accounts', icon: User,     label: 'Accounts' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function ActivityBar() {
  const {
    activeActivityTab, sidePanelOpen,
    setActivityTab, toggleSidePanel, openSidePanel,
    setRightTab, openRightPanel,
    openCommandPalette,
  } = useIDEStore()

  const handleClick = (id) => {
    if (id === 'settings') {
      openCommandPalette('>')
      return
    }
    if (id === 'accounts') return
    if (id === 'chat') {
      setRightTab('chat')
      openRightPanel()
      return
    }

    if (activeActivityTab === id && sidePanelOpen) {
      toggleSidePanel()
    } else {
      setActivityTab(id)
      openSidePanel()
    }
  }

  return (
    <div
      className="ide-activitybar w-12 flex-shrink-0 flex flex-col items-center py-1"
    >
      {/* Top icons */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        {TOP_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activeActivityTab === id && sidePanelOpen
          return (
            <button
              key={id}
              onClick={() => handleClick(id)}
              title={label}
              className="relative w-10 h-10 flex items-center justify-center rounded transition-colors"
              style={{ color: isActive ? 'var(--text-bright)' : 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            </button>
          )
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-0.5 pb-1">
        {BOTTOM_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleClick(id)}
            title={label}
            className="w-10 h-10 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <Icon size={22} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  )
}
