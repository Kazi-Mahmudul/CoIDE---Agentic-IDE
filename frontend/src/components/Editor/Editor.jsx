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

const Editor = forwardRef(function Editor({ onCursorChange, onMarkersChange }, ref) {
  const { openFiles, activeFileId, markFileModified, updateFileContent, fontSize } = useIDEStore()
  const monacoRef = useRef(null)
  const editorRef = useRef(null)

  const activeFile = openFiles.find(f => f.id === activeFileId)

  // Expose imperative API to parent
  useImperativeHandle(ref, () => ({
    save: () => handleSave(),
    trigger: (actionId) => {
      editorRef.current?.trigger('keyboard', actionId, null)
    },
    getAction: (id) => editorRef.current?.getAction(id),
    focus: () => editorRef.current?.focus(),
  }), [activeFile]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!activeFile) return
    try {
      if (activeFile.externalRoot) {
        await writeExternalFile(activeFile.externalRoot, activeFile.path, activeFile.content || '')
      } else {
        await writeFile(activeFile.path, activeFile.content || '')
      }
      markFileModified(activeFile.id, false)
      toast.success('Saved', { duration: 1500 })
    } catch (e) {
      toast.error(`Save failed: ${e.message}`)
    }
  }, [activeFile, markFileModified])

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

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

    // Report markers
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

  // Sync content when active file changes
  useEffect(() => {
    if (!editorRef.current || !activeFile) return
    const model = editorRef.current.getModel()
    if (model && model.getValue() !== (activeFile.content || '')) {
      model.setValue(activeFile.content || '')
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
            Use the Explorer or <kbd className="bg-[#2d2d2d] px-1.5 py-0.5 rounded text-[#858585]">Ctrl+P</kbd> to open a file
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
      theme="vs-dark"
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
