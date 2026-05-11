import React, { useState, useEffect } from 'react'
import { GitBranch, AlertCircle, AlertTriangle, Bell, Palette } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore.js'

export default function StatusBar({ cursorPosition, language, markers = [], onOpenThemePicker }) {
  const { openFiles, activeFileId } = useIDEStore()
  const [branch, setBranch] = useState(null)

  const errors   = markers.filter(m => m.severity === 8).length
  const warnings = markers.filter(m => m.severity === 4).length

  useEffect(() => {
    fetch('http://localhost:8000/git/branch')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.branch && setBranch(d.branch))
      .catch(() => {})
  }, [])

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 2,
    padding: '0 6px', height: '100%', borderRadius: 2,
    cursor: 'pointer', transition: 'background 0.15s',
    background: 'transparent',
  }

  const Btn = ({ onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      style={btnStyle}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )

  return (
    <div
      className="ide-statusbar flex items-center h-[22px] px-1 flex-shrink-0 text-[11px] select-none"
      style={{ background: 'var(--statusbar-bg)', color: 'var(--statusbar-text)' }}
    >
      {/* Left */}
      <div className="flex items-center flex-1 h-full">
        {branch && (
          <Btn title="Git branch">
            <GitBranch size={12} />
            <span>{branch}</span>
          </Btn>
        )}
        {errors > 0 && (
          <Btn title={`${errors} error${errors !== 1 ? 's' : ''}`}>
            <AlertCircle size={11} />
            <span>{errors}</span>
          </Btn>
        )}
        {warnings > 0 && (
          <Btn title={`${warnings} warning${warnings !== 1 ? 's' : ''}`}>
            <AlertTriangle size={11} />
            <span>{warnings}</span>
          </Btn>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center h-full">
        {cursorPosition && (
          <Btn title="Go to line">
            Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
          </Btn>
        )}
        <Btn title="Indentation">Spaces: 2</Btn>
        <Btn title="File encoding">UTF-8</Btn>
        <Btn title="Line endings">LF</Btn>
        {language && (
          <Btn title="Language mode">
            <span className="capitalize">{language}</span>
          </Btn>
        )}
        {onOpenThemePicker && (
          <Btn onClick={onOpenThemePicker} title="Color Theme">
            <Palette size={11} />
          </Btn>
        )}
        <Btn title="Notifications">
          <Bell size={11} />
        </Btn>
      </div>
    </div>
  )
}
