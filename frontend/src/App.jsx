
/**
 * App.jsx — VS Code / Cursor-style IDE shell
 */
import React, { useRef, useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import { useIDEStore } from './store/useIDEStore.js'
import { registerCommands } from './components/CommandPalette/commands.js'
import { buildMenus } from './components/MenuBar/menus.js'
import { useKeyboard } from './hooks/useKeyboard.js'
import { useFileTree } from './hooks/useFileTree.js'
import {
  readFile,
  readExternalFile,
  writeFile,
  writeExternalFile,
  createFile,
  createExternalFile,
  getAuthToken,
  getCurrentUser,
  setAuthToken,
} from './api.js'
import { applyTheme, THEMES } from './themes.js'

import MenuBar from './components/MenuBar/MenuBar.jsx'
import TabBar from './components/TabBar/TabBar.jsx'
import ActivityBar from './components/ActivityBar/ActivityBar.jsx'
import SidePanel from './components/SidePanel/SidePanel.jsx'
import Editor from './components/Editor/Editor.jsx'
import BottomPanel from './components/BottomPanel/BottomPanel.jsx'
import StatusBar from './components/StatusBar/StatusBar.jsx'
import CommandPalette from './components/CommandPalette/CommandPalette.jsx'
import RightPanel from './components/RightPanel/RightPanel.jsx'
import ConfigModal from './components/ConfigModal.jsx'
import FolderPicker from './components/FolderPicker.jsx'
import ThemePicker from './components/ThemePicker.jsx'
import AuthModal from './components/AuthModal.jsx'
import QuickInputModal from './components/QuickInputModal.jsx'

export default function App() {
  const store = useIDEStore()
  const {
    openFiles, activeFileId, openFile, setActiveFile, closeFile,
    externalRoot, setExternalRoot,
    openCommandPalette, closeCommandPalette,
    theme, bottomPanelOpen, openBottomPanel,
  } = store

  const editorRef = useRef(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [quickInput, setQuickInput] = useState({ open: false, title: '', placeholder: '', value: '', submitLabel: 'Create' })
  const [cursorPosition, setCursorPosition] = useState(null)
  const [markers, setMarkers] = useState([])
  const quickInputResolverRef = useRef(null)

  const requestInput = useCallback(({ title, placeholder = '', initialValue = '', submitLabel = 'Create' }) => {
    return new Promise((resolve) => {
      quickInputResolverRef.current = resolve
      setQuickInput({ open: true, title, placeholder, value: initialValue, submitLabel })
    })
  }, [])

  const closeQuickInput = useCallback(() => {
    setQuickInput((prev) => ({ ...prev, open: false }))
    if (quickInputResolverRef.current) {
      quickInputResolverRef.current(null)
      quickInputResolverRef.current = null
    }
  }, [])

  const submitQuickInput = useCallback((value) => {
    setQuickInput((prev) => ({ ...prev, open: false }))
    if (quickInputResolverRef.current) {
      quickInputResolverRef.current(value)
      quickInputResolverRef.current = null
    }
  }, [])

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
    registerCommands({ editorRef, openCommandPalette, onOpenThemePicker: () => setThemePickerOpen(true) })
  }, [openCommandPalette])

  // ── Listen for keyboard shortcuts modal event ───────────────────────────
  useEffect(() => {
    const handler = () => setShortcutsOpen(true)
    window.addEventListener('coide:show-shortcuts', handler)
    return () => window.removeEventListener('coide:show-shortcuts', handler)
  }, [])

  // ── Show config modal on first load ─────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('modelConfig')) setConfigOpen(true)
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setAuthOpen(true)
      setAuthReady(true)
      return
    }
    getCurrentUser()
      .then((u) => {
        localStorage.setItem('coide_user', JSON.stringify(u))
        setAuthOpen(false)
      })
      .catch(() => {
        setAuthToken('')
        localStorage.removeItem('coide_user')
        setAuthOpen(true)
      })
      .finally(() => setAuthReady(true))
  }, [])

  // ── Apply theme to document ─────────────────────────────────────────────
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // ── Open file handler ───────────────────────────────────────────────────
  const handleFileOpen = useCallback(async (fileOrPath, goToLine) => {
    const path = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath?.path
    if (!path) return

    // Handle go-to-line only (no path)
    if (fileOrPath?._goToLine) {
      editorRef.current?.goToLine(fileOrPath._goToLine)
      return
    }

    // Check if already open
    const existing = openFiles.find(f => f.path === path)
    if (existing) {
      setActiveFile(existing.id)
      if (goToLine) setTimeout(() => editorRef.current?.goToLine(goToLine), 50)
      return
    }

    try {
      let content = fileOrPath?.content
      const extRoot = fileOrPath?.externalRoot || externalRoot

      if (content === undefined || content === '') {
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

      if (goToLine) setTimeout(() => editorRef.current?.goToLine(goToLine), 100)
    } catch (e) {
      toast.error(`Cannot open file: ${e.message}`)
    }
  }, [openFiles, openFile, setActiveFile, externalRoot])

  // ── New file — prompts for name and creates in workspace ───────────────
  const handleNewFile = useCallback(async (suggestedName) => {
    const name = suggestedName || await requestInput({
      title: 'Create New File',
      placeholder: 'e.g. src/main.py',
      submitLabel: 'Create File',
    })
    if (!name?.trim()) return
    const filename = name.trim()
    try {
      if (externalRoot) {
        await createExternalFile(externalRoot, filename, false)
      } else {
        await createFile(filename, false)
      }
      openFile({
        id: externalRoot ? `${externalRoot}/${filename}` : filename,
        path: filename,
        label: filename.split('/').pop() || filename,
        content: '',
        language: filename.split('.').pop()?.toLowerCase() || 'plaintext',
        externalRoot: externalRoot || null,
        modified: false,
      })
      refresh()
      toast.success(`Created ${filename}`)
    } catch (e) {
      toast.error(`Create failed: ${e.message}`)
    }
  }, [openFile, refresh, externalRoot, requestInput])

  // ── Save All open files ─────────────────────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    const modified = openFiles.filter(f => f.modified && !f.isUntitled)
    if (modified.length === 0) { toast('All files saved'); return }
    let saved = 0
    for (const file of modified) {
      try {
        if (file.externalRoot) {
          await writeExternalFile(file.externalRoot, file.path, file.content || '')
        } else {
          await writeFile(file.path, file.content || '')
        }
        useIDEStore.getState().markFileModified(file.id, false)
        saved++
      } catch (e) {
        toast.error(`Failed to save ${file.label}: ${e.message}`)
      }
    }
    if (saved > 0) toast.success(`Saved ${saved} file${saved !== 1 ? 's' : ''}`)
  }, [openFiles])

  // ── Open file from disk (file input) ────────────────────────────────────
  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.py,.js,.ts,.jsx,.tsx,.html,.css,.json,.md,.txt,.yaml,.yml,.toml,.env,.sh,.rs,.go,.java,.cpp,.c,.h,.rb,.php,.sql,.xml,.csv,.ini,.cfg,.conf,.gitignore,.dockerfile'
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || [])
      for (const file of files) {
        try {
          const content = await file.text()
          const filename = file.name
          // Write to workspace (or external root if set)
          if (externalRoot) {
            await writeExternalFile(externalRoot, filename, content)
          } else {
            await writeFile(filename, content)
          }
          openFile({
            id: externalRoot ? `${externalRoot}/${filename}` : filename,
            path: filename,
            label: filename,
            content,
            language: filename.split('.').pop()?.toLowerCase() || 'plaintext',
            externalRoot: externalRoot || null,
            modified: false,
          })
          refresh()
          toast.success(`Opened ${filename}`)
        } catch (err) {
          toast.error(`Failed to open ${file.name}: ${err.message}`)
        }
      }
    }
    input.click()
  }, [openFile, refresh, externalRoot])
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
    if (prefix === 'new-file') { handleNewFile(); return }
    if (prefix === 'open-file') { handleOpenFile(); return }
    if (prefix === 'save-all') { handleSaveAll(); return }
    openCommandPalette(prefix)
  }, [openCommandPalette, handleNewFile, handleOpenFile, handleSaveAll])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useKeyboard(editorRef, handleOpenCommandPalette)

  // ── Build menus ─────────────────────────────────────────────────────────
  const menus = buildMenus({
    store,
    editorRef,
    openCommandPalette: handleOpenCommandPalette,
    toast,
    onOpenThemePicker: () => setThemePickerOpen(true),
    onSaveAll: handleSaveAll,
    onOpenFile: handleOpenFile,
  })

  // ── Go to line from problems panel ─────────────────────────────────────
  const handleGoToLine = useCallback((path, line) => {
    handleFileOpen(path, line)
  }, [handleFileOpen])

  // ── Collect all workspace files for command palette file search ─────────
  const allWorkspaceFiles = useCallback(() => {
    const files = []
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'file') files.push(n)
        if (n.children) walk(n.children)
      }
    }
    walk(tree)
    return files
  }, [tree])

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13 }}
    >
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: { background: 'var(--bg-panel)', color: 'var(--text-bright)', border: '1px solid var(--border-light)', fontSize: '13px' },
          error: { style: { background: '#3b1a1a', color: '#f87171', border: '1px solid #7f1d1d' } },
        }}
      />

      {/* Modals */}
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      <AuthModal
        open={authOpen}
        onAuthenticated={() => {
          setAuthOpen(false)
          refresh()
          toast.success('Workspace unlocked')
        }}
      />
      <ThemePicker open={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
      <QuickInputModal
        open={quickInput.open}
        title={quickInput.title}
        placeholder={quickInput.placeholder}
        initialValue={quickInput.value}
        submitLabel={quickInput.submitLabel}
        onSubmit={submitQuickInput}
        onClose={closeQuickInput}
      />
      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={handleFolderSelect}
      />
      <CommandPalette
        openFiles={openFiles}
        workspaceFiles={allWorkspaceFiles()}
        onOpenFile={handleFileOpen}
      />

      {!authReady && (
        <div className="fixed inset-0 z-[110]" style={{ background: 'var(--bg-overlay)' }} />
      )}

      {/* Keyboard Shortcuts Modal */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="w-[640px] max-h-[80vh] flex flex-col rounded-lg overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>Keyboard Shortcuts</span>
              <button onClick={() => setShortcutsOpen(false)} className="text-lg leading-none" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {[['Navigation','Ctrl+P — Go to File','Ctrl+Shift+P — Command Palette','Ctrl+G — Go to Line','Ctrl+Shift+E — Explorer','Ctrl+Shift+F — Search','Ctrl+Shift+X — Extensions','Ctrl+B — Toggle Sidebar','Ctrl+J — Toggle Terminal'],
                ['Editing','Ctrl+S — Save','Ctrl+K S — Save All','Ctrl+Z — Undo','Ctrl+Y — Redo','Ctrl+/ — Toggle Comment','Shift+Alt+F — Format Document','Ctrl+F — Find','Ctrl+H — Find & Replace'],
                ['Terminal','Ctrl+` — Focus Terminal','Ctrl+Shift+` — New Terminal','Ctrl+Shift+5 — Split Terminal','Ctrl+Shift+T — New Tab','Ctrl+Shift+W — Close Tab'],
                ['View','Ctrl+= — Zoom In','Ctrl+- — Zoom Out','Ctrl+0 — Reset Zoom','F11 — Full Screen','Ctrl+K Ctrl+T — Color Theme'],
              ].map(([section, ...shortcuts]) => (
                <div key={section} className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>{section}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {shortcuts.map(s => {
                      const [key, ...desc] = s.split(' — ')
                      return (
                        <div key={s} className="flex items-center justify-between gap-2 py-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{desc.join(' — ')}</span>
                          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                            style={{ background: 'var(--bg-input)', color: 'var(--text-bright)', border: '1px solid var(--border-light)' }}>
                            {key}
                          </kbd>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Menu bar */}
      <MenuBar menus={menus} />

      {/* Tab bar */}
      <TabBar />

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar />

        {/* Side panel */}
        <SidePanel
          tree={tree}
          activeFilePath={activeFile?.path}
          externalRoot={externalRoot}
          onFileOpen={handleFileOpen}
          onRefresh={refresh}
          onOpenFolder={() => setFolderPickerOpen(true)}
          onRequestInput={requestInput}
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
          {!bottomPanelOpen && (
            <div
              className="flex-shrink-0 h-6 flex items-center px-3 border-t cursor-pointer hover:bg-[var(--bg-hover)]"
              style={{ background: 'var(--bg-app)', borderColor: 'var(--border)' }}
              onClick={openBottomPanel}
            >
              <span className="text-[10px] transition-colors" style={{ color: 'var(--text-muted)' }}>
                ▲ Terminal
              </span>
            </div>
          )}
        </div>

        <RightPanel
          activeFile={activeFile}
          tree={tree}
          markers={markers}
          onFileOpen={handleFileOpen}
          onFileWrite={handleAgentFileWrite}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        cursorPosition={cursorPosition}
        language={language}
        markers={markers}
        onOpenThemePicker={() => setThemePickerOpen(true)}
      />
    </div>
  )
}
