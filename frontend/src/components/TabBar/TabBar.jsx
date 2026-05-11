import React, { useRef, useState } from 'react'
import { useIDEStore } from '../../store/useIDEStore.js'
import Tab from './Tab.jsx'

export default function TabBar() {
  const { openFiles, activeFileId } = useIDEStore()
  const [dragSrc, setDragSrc] = useState(null)
  const scrollRef = useRef(null)

  const onDragStart = (e, id) => {
    setDragSrc(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e, id) => { e.preventDefault() }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragSrc || dragSrc === targetId) { setDragSrc(null); return }
    const store = useIDEStore.getState()
    const files = [...store.openFiles]
    const fromIdx = files.findIndex(f => f.id === dragSrc)
    const toIdx = files.findIndex(f => f.id === targetId)
    const [moved] = files.splice(fromIdx, 1)
    files.splice(toIdx, 0, moved)
    useIDEStore.setState({ openFiles: files })
    setDragSrc(null)
  }

  return (
    <div
      ref={scrollRef}
      className="ide-tabbar flex h-9 flex-shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none"
    >
      {openFiles.map(file => (
        <Tab
          key={file.id}
          file={file}
          isActive={file.id === activeFileId}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
      {/* Fill remaining space */}
      <div className="flex-1" style={{ background: 'var(--bg-tab-inactive)' }} />
    </div>
  )
}
