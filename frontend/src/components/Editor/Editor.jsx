import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useIDEStore } from '../../store/useIDEStore.js'
import { writeFile, writeExternalFile } from '../../api.js'
import { toast } from 'react-hot-toast'

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', json: 'json', md: 'markdown',
  css: 'css', scss: 'scss', html: 'html',
  sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
  toml: 'ini', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', rb: 'ruby', php: 'php',
  sql: 'sql', xml: 'xml', txt: 'plaintext',
}

function getLanguage(path) {
  if (!path) return 'plaintext'
  const ext = path.split('.').pop()?.toLowerCase()
  return LANG_MAP[ext] || 'plaintext'
}

// Keep a stable ref to the latest save function to avoid stale closures
const Editor = forwardRef(function Editor({ onCursorChange, onMarkersChange }, ref) {
  const { openFiles, activeFileId, markFileModified, updateFileContent, fontSize } = useIDEStore()
  const monacoRef = useRef(null)
  const editorRef = useRef(null)
  // Always-fresh refs so imperative handle never goes stale
  const activeFileRef = useRef(null)
  const markFileModifiedRef = useRef(markFileModified)
  markFileModifiedRef.current = markFileModified

  const activeFile = openFiles.find(f => f.id === activeFileId) || null
  activeFileRef.current = activeFile

  const handleSave = useCallback(async () => {
    const file = activeFileRef.current
    if (!file) return
    try {
      if (file.externalRoot) {
        await writeExternalFile(file.externalRoot, file.path, file.content || '')
      } else {
        await writeFile(file.path, file.content || '')
      }
      markFileModifiedRef.current(file.id, false)
      toast.success('Saved', { duration: 1500 })
    } catch (e) {
      toast.error(`Save failed: ${e.message}`)
    }
  }, []) // stable — uses refs

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    save: handleSave,
    // Trigger a Monaco editor action by ID
    trigger: (actionId) => {
      if (!editorRef.current) return
      // Some actions need the editor focused first
      editorRef.current.focus()
      editorRef.current.trigger('menu', actionId, null)
    },
    getAction: (id) => editorRef.current?.getAction(id),
    focus: () => editorRef.current?.focus(),
    // Go to a specific line number
    goToLine: (lineNumber) => {
      if (!editorRef.current || !lineNumber) return
      editorRef.current.revealLineInCenter(lineNumber)
      editorRef.current.setPosition({ lineNumber, column: 1 })
      editorRef.current.focus()
    },
  }), [handleSave])

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Ctrl+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave)

    editor.updateOptions({
      fontSize,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      automaticLayout: true,
    })

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.({ lineNumber: e.position.lineNumber, column: e.position.column })
    })

    // Report markers for Problems panel
    monaco.editor.onDidChangeMarkers(() => {
      const model = editor.getModel()
      if (model) {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        onMarkersChange?.(markers)
      }
    })
  }, [handleSave, fontSize, onCursorChange, onMarkersChange])

  // Update font size live
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize })
  }, [fontSize])

  // Sync Monaco theme with IDE theme
  const { theme } = useIDEStore()
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark')
    }
  }, [theme])

  // Sync content when active file changes
  useEffect(() => {
    if (!editorRef.current || !activeFile) return
    const model = editorRef.current.getModel()
    const current = model?.getValue()
    if (model && current !== (activeFile.content || '')) {
      model.setValue(activeFile.content || '')
    }
    // Update language model
    if (monacoRef.current && model) {
      monacoRef.current.editor.setModelLanguage(model, getLanguage(activeFile.path))
    }
  }, [activeFileId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((value) => {
    if (!activeFileId) return
    updateFileContent(activeFileId, value ?? '')
    markFileModified(activeFileId, true)
  }, [activeFileId, updateFileContent, markFileModified])

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-[#555] text-sm select-none">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-20">⌨</div>
          <div className="text-[#555]">Open a file to start editing</div>
          <div className="text-xs mt-2 text-[#444]">
            Use the Explorer or{' '}
            <kbd className="bg-[#2d2d2d] px-1.5 py-0.5 rounded text-[#858585]">Ctrl+P</kbd>{' '}
            to open a file
          </div>
        </div>
      </div>
    )
  }

  return (
    <MonacoEditor
      height="100%"
      language={getLanguage(activeFile.path)}
      value={activeFile.content || ''}
      theme={theme === 'light' ? 'vs' : 'vs-dark'}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
      }}
    />
  )
})

export default Editor
