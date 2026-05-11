import React, { useState, useCallback, useRef } from 'react'
import MenuDropdown from './MenuDropdown.jsx'

export default function MenuBar({ menus }) {
  const [openMenu, setOpenMenu] = useState(null)
  const barRef = useRef(null)

  const handleMenuClick = useCallback((idx) => {
    setOpenMenu(prev => prev === idx ? null : idx)
  }, [])

  const handleMenuHover = useCallback((idx) => {
    if (openMenu !== null && openMenu !== idx) setOpenMenu(idx)
  }, [openMenu])

  const handleClose = useCallback(() => setOpenMenu(null), [])

  return (
    <div
      ref={barRef}
      className="ide-menubar flex items-center h-8 px-2 flex-shrink-0 select-none z-40"
      style={{ fontSize: 13 }}
    >
      <span className="text-xs mr-3 font-semibold tracking-wide" style={{ color: 'var(--accent)' }}>
        Coide
      </span>

      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative">
          <button
            className="px-2.5 py-0.5 rounded text-[13px] transition-colors"
            style={{
              background: openMenu === idx ? 'var(--bg-selected)' : 'transparent',
              color: openMenu === idx ? 'var(--text-bright)' : 'var(--text-primary)',
            }}
            onClick={() => handleMenuClick(idx)}
            onMouseEnter={(e) => {
              handleMenuHover(idx)
              if (openMenu !== idx) e.currentTarget.style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={(e) => {
              if (openMenu !== idx) e.currentTarget.style.background = 'transparent'
            }}
          >
            {menu.label}
          </button>

          {openMenu === idx && (
            <MenuDropdown menu={menu} onClose={handleClose} />
          )}
        </div>
      ))}
    </div>
  )
}
