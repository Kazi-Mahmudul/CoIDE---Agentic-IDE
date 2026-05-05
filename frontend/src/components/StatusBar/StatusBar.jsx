import React, { useState, useEffect } from 'react'
import { GitBranch, AlertCircle, AlertTriangle, Bell } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'

export default function StatusBar({ cursorPosition, language, markers = [] }) {
  const { theme, openFiles, activeFileId } = useIDEStore()
  const [branch, setBranch] = useState(null)

  const errors = markers.filter(m => m.severity === 8).length
  const warnings = markers.filter(m => m.severity === 4).length

  useEffect(() => {
    fetch('http://localhost:8000/git/branch')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.branch && setBranch(d.branch))
      .catch(() => {})
  }, [])

  const activeFile = openFiles.find(f => f.id === activeFileId)

  return (
    <div
      className="flex items-center h-[22px] px-2 flex-shrink-0 text-white text-[11px] select-none"
      style={{ background: '#007acc' }}
    >
      {/* Left */}
      <div className="flex items-center gap-3 flex-1">
        {branch && (
          <button className="flex items-center gap-1 hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
            <GitBranch size={12} />
            <span>{branch}</span>
          </button>
        )}
        {(errors > 0 || warnings > 0) && (
          <button className="flex items-center gap-2 hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
            {errors > 0 && (
              <span className="flex items-center gap-0.5">
                <AlertCircle size={11} /> {errors}
              </span>
            )}
            {warnings > 0 && (
              <span className="flex items-center gap-0.5">
                <AlertTriangle size={11} /> {warnings}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {cursorPosition && (
          <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
            Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
          </button>
        )}
        <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
          Spaces: 2
        </button>
        <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
          UTF-8
        </button>
        <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
          LF
        </button>
        {language && (
          <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors capitalize">
            {language}
          </button>
        )}
        <button className="hover:bg-[#0098ff] px-1.5 py-0.5 rounded transition-colors">
          <Bell size={11} />
        </button>
      </div>
    </div>
  )
}
