import React, { useState, useCallback, useRef } from 'react'
import MenuDropdown from './MenuDropdown.jsx'

export default function MenuBar({ menus }) {
  const [openMenu, setOpenMenu] = useState(null) // index of open menu
  const barRef = useRef(null)

  const handleMenuClick = useCallback((idx) => {
    setOpenMenu(prev => prev === idx ? null : idx)
  }, [])

  const handleMenuHover = useCallback((idx) => {
    // Only switch if another menu is already open
    if (openMenu !== null && openMenu !== idx) {
      setOpenMenu(idx)
    }
  }, [openMenu])

  const handleClose = useCallback(() => setOpenMenu(null), [])

  return (
    <div
      ref={barRef}
      className="flex items-center h-8 bg-[#1f1f1f] border-b border-[#333] px-2 flex-shrink-0 select-none z-40"
      style={{ fontSize: 13 }}
    >
      {/* App name / logo */}
      <span className="text-[#858585] text-xs mr-3 font-medium tracking-wide">Coide</span>

      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-2.5 py-0.5 rounded text-[13px] transition-colors
              ${openMenu === idx
                ? 'bg-[#094771] text-white'
                : 'text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white'
              }`}
            onClick={() => handleMenuClick(idx)}
            onMouseEnter={() => handleMenuHover(idx)}
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
