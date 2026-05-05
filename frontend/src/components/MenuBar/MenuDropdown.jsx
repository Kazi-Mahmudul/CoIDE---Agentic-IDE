import React, { useRef, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'

function MenuItem({ item, onClose, depth = 0 }) {
  const [subOpen, setSubOpen] = useState(false)
  const ref = useRef(null)

  if (item.separator) {
    return <div className="my-0.5 border-t border-[#444]" />
  }

  const hasSubmenu = item.submenu && item.submenu.length > 0
  const disabled = item.disabled

  const handleClick = (e) => {
    if (disabled || hasSubmenu) return
    e.stopPropagation()
    onClose()
    item.action?.()
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => hasSubmenu && setSubOpen(true)}
      onMouseLeave={() => hasSubmenu && setSubOpen(false)}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-[3px] text-[13px] text-left rounded-sm
          ${disabled
            ? 'text-[#555] cursor-default'
            : 'text-[#cccccc] hover:bg-[#094771] hover:text-white cursor-pointer'
          }`}
      >
        <span className="flex-1 truncate">{item.label}</span>
        <span className="flex items-center gap-1 ml-4 flex-shrink-0">
          {item.shortcut && (
            <span className="text-[11px] text-[#858585]">{item.shortcut}</span>
          )}
          {hasSubmenu && <ChevronRight size={12} className="text-[#858585]" />}
        </span>
      </button>

      {hasSubmenu && subOpen && (
        <div
          className="absolute top-0 left-full ml-0.5 z-50 min-w-[200px] bg-[#252526] border border-[#454545] rounded shadow-xl py-1"
          style={{ minWidth: 200 }}
        >
          {item.submenu.map((sub, i) => (
            <MenuItem key={i} item={sub} onClose={onClose} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MenuDropdown({ menu, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    // Use mousedown so it fires before click
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 min-w-[220px] bg-[#252526] border border-[#454545] rounded shadow-xl py-1"
      style={{ minWidth: 220 }}
    >
      {menu.items.map((item, i) => (
        <MenuItem key={i} item={item} onClose={onClose} />
      ))}
    </div>
  )
}
