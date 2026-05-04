import React, { useState, useEffect, useCallback } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import FileTree from './components/FileTree.jsx'
import Editor from './components/Editor.jsx'
import Terminal from './components/Terminal.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ConfigModal from './components/ConfigModal.jsx'
import FolderPicker from './components/FolderPicker.jsx'
import { Settings } from 'lucide-react'
import { useFileTree } from './hooks/useFileTree.js'
import { readFile, writeFile, readExternalFile, writeExternalFile } from './api.js'

export default function App() {
  const [configOpen, setConfigOpen] = useState(false)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)

  // externalRoot: null = workspace mode, string = absolute path of opened folder
  const [externalRoot, setExternalRoot] = useState(null)

  const { tree, refresh, rootPath } = useFileTree(externalRoot)

  // activeFile: { path, content, externalRoot? }
  const [activeFile, setActiveFile] = useState(null)
  const [editorContent, setEditorContent] = useState('')
  const [unsaved, setUnsaved] = useState(false)

  // Terminal height (draggable)
  const [terminalHeight, setTerminalHeight] = useState(220)
  const [isDragging, setIsDragging] = useState(false)

  // Show config modal on first load if no config stored
  useEffect(() => {
    const cfg = localStorage.getItem('modelConfig')
    if (!cfg) setConfigOpen(true)
  }, [])

  // ── File open ───────────────────────────────────────────────────────────────
  const handleFileOpen = useCallback((file) => {
    setActiveFile(file)
    setEditorContent(file.content)
    setUnsaved(false)
  }, [])

  // ── Editor change ───────────────────────────────────────────────────────────
  const handleEditorChange = useCallback((value) => {
    setEditorContent(value ?? '')
    setUnsaved(true)
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activeFile) return
    try {
      if (activeFile.externalRoot) {
        await writeExternalFile(activeFile.externalRoot, activeFile.path, editorContent)
      } else {
        await writeFile(activeFile.path, editorContent)
      }
      setUnsaved(false)
      setActiveFile(prev => prev ? { ...prev, content: editorContent } : prev)
      toast.success('Saved')
    } catch (e) {
      toast.error(`Save failed: ${e.message}`)
    }
  }, [activeFile, editorContent])

  // ── Agent wrote a file → reload if open ────────────────────────────────────
  const handleAgentFileWrite = useCallback(async (path) => {
    if (activeFile && activeFile.path === path) {
      try {
        let data
        if (activeFile.externalRoot) {
          data = await readExternalFile(activeFile.externalRoot, path)
        } else {
          data = await readFile(path)
        }
        setActiveFile(prev => prev ? { ...prev, content: data.content } : prev)
        setEditorContent(data.content)
        setUnsaved(false)
      } catch (_) {}
    }
    refresh()
  }, [activeFile, refresh])

  // ── Open external folder ────────────────────────────────────────────────────
  const handleFolderSelect = useCallback((folderPath) => {
    setFolderPickerOpen(false)
    setExternalRoot(folderPath)
    setActiveFile(null)
    setEditorContent('')
    setUnsaved(false)
    toast.success(`Opened: ${folderPath.split(/[/\\]/).pop() || folderPath}`)
  }, [])

  const handleCloseExternalFolder = useCallback(() => {
    setExternalRoot(null)
    setActiveFile(null)
    setEditorContent('')
    setUnsaved(false)
  }, [])

  // ── Terminal drag resize ────────────────────────────────────────────────────
  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e) => {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const container = document.getElementById('center-panel')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newH = rect.bottom - clientY
      setTerminalHeight(Math.max(80, Math.min(newH, rect.height - 80)))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // Sidebar label
  const sidebarLabel = externalRoot
    ? (externalRoot.split(/[/\\]/).pop() || externalRoot)
    : 'EXPLORER'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]">
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#2d2d2d', color: '#d4d4d4', border: '1px solid #424242', fontSize: '13px' },
          error: { style: { background: '#3b1a1a', color: '#f87171', border: '1px solid #7f1d1d' } },
        }}
      />

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={handleFolderSelect}
      />

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-[#333] bg-[#252526]">
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] min-h-[36px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#858585] truncate">
              {sidebarLabel}
            </span>
            {externalRoot && (
              <button
                onClick={handleCloseExternalFolder}
                className="text-[#555] hover:text-[#d4d4d4] text-[10px] flex-shrink-0"
                title="Close folder (back to workspace)"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => setConfigOpen(true)}
            className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors flex-shrink-0"
            title="Model Settings"
          >
            <Settings size={13} />
          </button>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto">
          <FileTree
            tree={tree}
            activeFile={activeFile?.path}
            externalRoot={externalRoot}
            rootLabel={externalRoot || null}
            onFileOpen={handleFileOpen}
            onRefresh={refresh}
            onOpenFolder={() => setFolderPickerOpen(true)}
          />
        </div>
      </div>

      {/* ── Center: Editor + Terminal ─────────────────────────────────────── */}
      <div id="center-panel" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Editor
            activeFile={activeFile}
            content={editorContent}
            unsaved={unsaved}
            onChange={handleEditorChange}
            onSave={handleSave}
          />
        </div>

        {/* Drag handle */}
        <div
          className={`h-[3px] flex-shrink-0 cursor-row-resize transition-colors
            ${isDragging ? 'bg-[#007acc]' : 'bg-[#333] hover:bg-[#007acc]'}`}
          onMouseDown={handleDragStart}
        />

        {/* Terminal */}
        <div style={{ height: terminalHeight }} className="flex-shrink-0 overflow-hidden">
          <Terminal cwd={externalRoot || rootPath || undefined} />
        </div>
      </div>

      {/* ── Right: Chat ───────────────────────────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 border-l border-[#333] flex flex-col bg-[#252526]">
        <ChatPanel
          activeFile={activeFile}
          tree={tree}
          onFileWrite={handleAgentFileWrite}
        />
      </div>
    </div>
  )
}
