import React, { useEffect, useRef, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { Save, Circle } from 'lucide-react'

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  json: 'json',
  md: 'markdown',
  css: 'css', scss: 'scss',
  html: 'html',
  sh: 'shell', bash: 'shell',
  yml: 'yaml', yaml: 'yaml',
  toml: 'ini',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c', cpp: 'cpp', h: 'c',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
  xml: 'xml',
  txt: 'plaintext',
}

function getLanguage(path) {
  if (!path) return 'plaintext'
  const ext = path.split('.').pop()?.toLowerCase()
  return LANG_MAP[ext] || 'plaintext'
}

export default function Editor({ activeFile, content, unsaved, onChange, onSave }) {
  const editorRef = useRef(null)

  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Ctrl+S / Cmd+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave()
    })

    // Configure editor options
    editor.updateOptions({
      fontSize: 13,
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
    })
  }, [onSave])

  // When active file changes, update editor content
  useEffect(() => {
    if (editorRef.current && content !== undefined) {
      const model = editorRef.current.getModel()
      if (model && model.getValue() !== content) {
        model.setValue(content)
      }
    }
  }, [activeFile?.path]) // only reset on file change, not every keystroke

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-[#555] text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">⌨️</div>
          <div>Open a file from the explorer</div>
          <div className="text-xs mt-1 text-[#444]">or ask the agent to create one</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex items-center bg-[#252526] border-b border-[#333] px-2 h-9 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1e1e1e] rounded-t text-xs text-[#d4d4d4] border border-b-0 border-[#333]">
          {unsaved && (
            <Circle size={8} className="text-[#e8c07d] fill-[#e8c07d]" />
          )}
          <span className="max-w-[200px] truncate" title={activeFile.path}>
            {activeFile.path.split('/').pop()}
          </span>
        </div>
        <div className="flex-1 text-xs text-[#555] px-3 truncate">
          {activeFile.path}
        </div>
        <button
          onClick={onSave}
          disabled={!unsaved}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
            ${unsaved
              ? 'text-[#d4d4d4] hover:bg-[#3a3a3a] cursor-pointer'
              : 'text-[#444] cursor-default'
            }`}
          title="Save (Ctrl+S)"
        >
          <Save size={12} />
          <span>Save</span>
        </button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language={getLanguage(activeFile.path)}
          value={content}
          theme="vs-dark"
          onChange={onChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
