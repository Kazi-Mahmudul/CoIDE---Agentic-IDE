import React, { useRef, useState } from 'react'
import { useIDEStore } from '../../store/useIDEStore.js'
import Tab from './Tab.jsx'

export default function TabBar() {
  const { openFiles, activeFileId } = useIDEStore()
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const scrollRef = useRef(null)

  const onDragStart = (e, id) => {
    setDragSrc(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e, id) => {
    e.preventDefault()
    setDragOver(id)
  }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragSrc || dragSrc === targetId) { setDragOver(null); return }
    const store = useIDEStore.getState()
    const files = [...store.openFiles]
    const fromIdx = files.findIndex(f => f.id === dragSrc)
    const toIdx = files.findIndex(f => f.id === targetId)
    const [moved] = files.splice(fromIdx, 1)
    files.splice(toIdx, 0, moved)
    useIDEStore.setState({ openFiles: files })
    setDragSrc(null)
    setDragOver(null)
  }

  if (openFiles.length === 0) {
    return <div className="h-9 bg-[#252526] border-b border-[#333] flex-shrink-0" />
  }

  return (
    <div
      ref={scrollRef}
      className="flex h-9 bg-[#252526] border-b border-[#333] flex-shrink-0 overflow-x-auto overflow-y-hidden"
      style={{ scrollbarWidth: 'none' }}
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
    </div>
  )
}
