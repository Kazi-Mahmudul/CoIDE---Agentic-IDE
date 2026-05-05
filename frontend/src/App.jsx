
/**
 * App.jsx — VS Code / Cursor-style IDE shell
 *
 * Layout:
 *   MenuBar (32px)
 *   TabBar  (36px)
 *   [ActivityBar 48px] [SidePanel?] [Editor flex] [ChatPanel 320px]
 *   BottomPanel (collapsible)
 *   StatusBar (22px)
 *
 * CommandPalette overlays everything.
 */
import React, { useRef, useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import { useIDEStore } from './store/useIDEStore.js'
import { useCommandStore } from './store/useCommandStore.js'
import { registerCommands } from './components/CommandPalette/commands.js'
import { buildMenus } from './components/MenuBar/menus.js'
import { useKeyboard } from './hooks/useKeyboard.js'
import { useFileTree } from './hooks/useFileTree.js'
import { readFile, readExternalFile } from './api.js'

import MenuBar from './components/MenuBar/MenuBar.jsx'
import TabBar from './components/TabBar/TabBar.jsx'
import ActivityBar from './components/ActivityBar/ActivityBar.jsx'
import SidePanel from './components/SidePanel/SidePanel.jsx'
import Editor from './components/Editor/Editor.jsx'
import BottomPanel from './components/BottomPanel/BottomPanel.jsx'
import StatusBar from './components/StatusBar/StatusBar.jsx'
import CommandPalette from './components/CommandPalette/CommandPalette.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ConfigModal from './components/ConfigModal.jsx'
import FolderPicker from './components/FolderPicker.jsx'

export default function App() {
  const store = useIDEStore()
  const {
    openFiles, activeFileId, openFile, setActiveFile,
    externalRoot, setExternalRoot,
    openCommandPalette, closeCommandPalette,
    theme,
  } = store

  const editorRef = useRef(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(null)
  const [markers, setMarkers] = useState([])

  // File tree
  const { tree, refresh, rootPath } = useFileTree(externalRoot)

  // Active file object
  const activeFile = openFiles.find(f => f.id === activeFileId) || null

  // Language for status bar
  const language = activeFile
    ? (activeFile.language || activeFile.path?.split('.').pop() || 'plaintext')
    : null

  // ── Register commands once ──────────────────────────────────────────────
  useEffect(() => {
    registerCommands({ editorRef, openCommandPalette })
  }, [openCommandPalette])

  // ── Show config modal on first load ─────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('modelConfig')) setConfigOpen(true)
  }, [])

  // ── Apply theme to document ─────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.style.background = theme === 'light' ? '#ffffff' : '#1e1e1e'
  }, [theme])

  // ── Open file handler ───────────────────────────────────────────────────
  const handleFileOpen = useCallback(async (fileOrPath, goToLine) => {
    // fileOrPath can be { path, content?, externalRoot? } or a string path
    const path = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath?.path
    if (!path) return

    // Check if already open
    const existing = openFiles.find(f => f.path === path)
    if (existing) {
      setActiveFile(existing.id)
      if (goToLine) editorRef.current?.trigger('revealLine:' + goToLine)
      return
    }

    try {
      let content = fileOrPath?.content
      const extRoot = fileOrPath?.externalRoot || externalRoot

      if (content === undefined) {
        if (extRoot) {
          const data = await readExternalFile(extRoot, path)
          content = data.content
        } else {
          const data = await readFile(path)
          content = data.content
        }
      }

      const ext = path.split('.').pop()?.toLowerCase()
      openFile({
        id: path,
        path,
        label: path.split('/').pop() || path,
        content,
        language: ext,
        externalRoot: extRoot || null,
      })
    } catch (e) {
      toast.error(`Cannot open file: ${e.message}`)
    }
  }, [openFiles, openFile, setActiveFile, externalRoot])

  // ── Agent file write handler ────────────────────────────────────────────
  const handleAgentFileWrite = useCallback(async (path) => {
    if (activeFile?.path === path) {
      try {
        const data = externalRoot
          ? await readExternalFile(externalRoot, path)
          : await readFile(path)
        useIDEStore.getState().updateFileContent(activeFileId, data.content)
        useIDEStore.getState().markFileModified(activeFileId, false)
      } catch (_) {}
    }
    refresh()
  }, [activeFile, activeFileId, externalRoot, refresh])

  // ── Folder open ─────────────────────────────────────────────────────────
  const handleFolderSelect = useCallback((folderPath) => {
    setFolderPickerOpen(false)
    setExternalRoot(folderPath)
    toast.success(`Opened: ${folderPath.split(/[/\\]/).pop() || folderPath}`)
  }, [setExternalRoot])

  // ── Command palette open helper ─────────────────────────────────────────
  const handleOpenCommandPalette = useCallback((prefix = '>') => {
    if (prefix === 'open-folder') { setFolderPickerOpen(true); return }
    if (prefix === 'new-file') { toast('New File — not yet implemented', { icon: '🚧' }); return }
    openCommandPalette(prefix)
  }, [openCommandPalette])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useKeyboard(editorRef, handleOpenCommandPalette)

  // ── Build menus ─────────────────────────────────────────────────────────
  const menus = buildMenus({
    store,
    editorRef,
    openCommandPalette: handleOpenCommandPalette,
    toast,
  })

  // ── Go to line from problems panel ─────────────────────────────────────
  const handleGoToLine = useCallback((path, line) => {
    handleFileOpen(path, line)
  }, [handleFileOpen])

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden text-[#cccccc]"
      style={{ background: '#1e1e1e', fontSize: 13 }}
    >
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#2d2d2d', color: '#d4d4d4', border: '1px solid #424242', fontSize: '13px' },
          error: { style: { background: '#3b1a1a', color: '#f87171', border: '1px solid #7f1d1d' } },
        }}
      />

      {/* Modals */}
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={handleFolderSelect}
      />
      <CommandPalette
        openFiles={openFiles}
        onOpenFile={handleFileOpen}
      />

      {/* ── Menu bar ─────────────────────────────────────────────────────── */}
      <MenuBar menus={menus} />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <TabBar />

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar />

        {/* Side panel (collapsible) */}
        <SidePanel
          tree={tree}
          activeFilePath={activeFile?.path}
          externalRoot={externalRoot}
          onFileOpen={handleFileOpen}
          onRefresh={refresh}
          onOpenFolder={() => setFolderPickerOpen(true)}
        />

        {/* Center: Editor + Bottom panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Editor
              ref={editorRef}
              onCursorChange={setCursorPosition}
              onMarkersChange={setMarkers}
            />
          </div>

          {/* Bottom panel */}
          <BottomPanel
            markers={markers}
            onGoToLine={handleGoToLine}
          />

          {/* Reopen bar when bottom panel is closed */}
          {!store.bottomPanelOpen && (
            <div className="flex-shrink-0 h-6 flex items-center px-3 bg-[#1e1e1e] border-t border-[#333]">
              <button
                onClick={() => store.openBottomPanel()}
                className="text-[10px] text-[#555] hover:text-[#858585] transition-colors"
              >
                ▲ Terminal
              </button>
            </div>
          )}
        </div>

        {/* Right: Agent chat */}
        <div className="w-80 flex-shrink-0 border-l border-[#333] flex flex-col bg-[#252526]">
          <ChatPanel
            activeFile={activeFile}
            tree={tree}
            onFileWrite={handleAgentFileWrite}
          />
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar
        cursorPosition={cursorPosition}
        language={language}
        markers={markers}
      />
    </div>
  )
}
