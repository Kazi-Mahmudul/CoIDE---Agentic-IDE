import React from 'react'
import Terminal from '../Terminal.jsx'
import { useIDEStore } from '../../store/useIDEStore.js'

export default function TerminalPanel() {
  const { externalRoot } = useIDEStore()
  return (
    <div className="h-full">
      <Terminal cwd={externalRoot || undefined} />
    </div>
  )
}
