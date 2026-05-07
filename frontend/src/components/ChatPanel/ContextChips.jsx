import React from 'react'
import { X, FileText, Folder, Globe, AlertTriangle, Terminal, Scissors } from 'lucide-react'

const CHIP_ICONS = {
  file: FileText,
  folder: Folder,
  web: Globe,
  problems: AlertTriangle,
  terminal: Terminal,
  selection: Scissors,
  image: FileText,
}

const CHIP_COLORS = {
  file: 'text-blue-400',
  folder: 'text-yellow-400',
  web: 'text-green-400',
  problems: 'text-yellow-400',
  terminal: 'text-purple-400',
  selection: 'text-pink-400',
  image: 'text-orange-400',
}

export default function ContextChips({ chips = [], onRemove, onClickChip }) {
  if (chips.length === 0) return null
  return (
    <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none flex-shrink-0 border-b border-[#333]">
      {chips.map(chip => {
        const Icon = CHIP_ICONS[chip.type] || FileText
        const color = CHIP_COLORS[chip.type] || 'text-[#858585]'
        return (
          <div
            key={chip.id}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#2d2d2d] border border-[#444] rounded-full text-[11px] flex-shrink-0 group cursor-pointer hover:border-[#555] transition-colors"
            onClick={() => onClickChip?.(chip)}
            title={chip.tooltip || chip.label}
          >
            <Icon size={10} className={color} />
            <span className="text-[#cccccc] max-w-[120px] truncate">{chip.label}</span>
            <button
              onClick={e => { e.stopPropagation(); onRemove?.(chip.id) }}
              className="text-[#555] hover:text-red-400 transition-colors ml-0.5"
            >
              <X size={9} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
