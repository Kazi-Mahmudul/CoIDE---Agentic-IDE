import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Paperclip, AtSign, Hash, Globe, Brain, Zap, MessageSquare } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ContextPicker from './ContextPicker.jsx'
import FilePicker from './FilePicker.jsx'
import ContextChips from './ContextChips.jsx'
import ImagePreview from './ImagePreview.jsx'

const BASE = 'http://localhost:8000'
const SLASH_COMMANDS = [
  { cmd: '/clear',   desc: 'Clear current thread' },
  { cmd: '/new',     desc: 'New thread' },
  { cmd: '/model',   desc: 'Open model config' },
  { cmd: '/undo',    desc: 'Undo last agent checkpoint' },
  { cmd: '/export',  desc: 'Export thread as markdown' },
  { cmd: '/help',    desc: 'Show all commands' },
]

export default function ChatInput({
  onSend,
  onStop,
  streaming,
  tree = [],
  activeFilePath,
  activeFileContent,
  selection,
  diagnostics = [],
  contextChips,
  onAddChip,
  onRemoveChip,
  onOpenSettings,
  modeOverride,
  onModeOverride,
  tokenCount = 0,
  maxTokens = 128000,
}) {
  const [input, setInput] = useState('')
  const [images, setImages] = useState([])
  const [showContextPicker, setShowContextPicker] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [showSlash, setShowSlash] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [atFilter, setAtFilter] = useState('')
  const [hashFilter, setHashFilter] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  // Focus on mount
  useEffect(() => { textareaRef.current?.focus() }, [])

  const handleKeyDown = useCallback((e) => {
    if (isComposing) return

    // Ctrl+Enter always sends
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
      return
    }

    // Enter sends (unless shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showSlash || showContextPicker || showFilePicker) return
      e.preventDefault()
      handleSend()
      return
    }

    // Escape closes pickers
    if (e.key === 'Escape') {
      setShowContextPicker(false)
      setShowFilePicker(false)
      setShowSlash(false)
      return
    }

    // Up arrow when empty → edit last message (handled by parent via onEdit)
  }, [isComposing, showSlash, showContextPicker, showFilePicker, input])

  const handleChange = (e) => {
    const val = e.target.value
    setInput(val)

    // Detect @ trigger
    const lastAt = val.lastIndexOf('@')
    const lastHash = val.lastIndexOf('#')
    const lastSlash = val.lastIndexOf('/')
    const cursor = e.target.selectionStart

    if (lastAt >= 0 && cursor > lastAt && !val.slice(lastAt + 1, cursor).includes(' ')) {
      setAtFilter(val.slice(lastAt + 1, cursor))
      setShowContextPicker(true)
      setShowFilePicker(false)
      setShowSlash(false)
    } else if (lastHash >= 0 && cursor > lastHash && !val.slice(lastHash + 1, cursor).includes(' ')) {
      setHashFilter(val.slice(lastHash + 1, cursor))
      setShowFilePicker(true)
      setShowContextPicker(false)
      setShowSlash(false)
    } else if (lastSlash === 0 && cursor > 0) {
      setSlashFilter(val.slice(1, cursor))
      setShowSlash(true)
      setShowContextPicker(false)
      setShowFilePicker(false)
    } else {
      setShowContextPicker(false)
      setShowFilePicker(false)
      setShowSlash(false)
    }
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text && images.length === 0) return
    if (streaming) return
    onSend({ text, images, contextChips })
    setInput('')
    setImages([])
    setShowContextPicker(false)
    setShowFilePicker(false)
    setShowSlash(false)
  }, [input, images, contextChips, streaming, onSend])

  // Handle @ context selection
  const handleContextSelect = async (option) => {
    setShowContextPicker(false)
    // Remove the @ trigger from input
    const lastAt = input.lastIndexOf('@')
    setInput(input.slice(0, lastAt))

    switch (option.id) {
      case 'file': setShowFilePicker(true); break
      case 'problems':
        onAddChip?.({
          id: 'problems', type: 'problems', label: `Problems (${diagnostics.length})`,
          content: diagnostics.map(d => `${d.file}:${d.startLineNumber}: ${d.message}`).join('\n'),
        })
        break
      case 'selection':
        if (selection) {
          onAddChip?.({ id: 'selection', type: 'selection', label: 'Selection', content: selection })
        } else {
          toast('No text selected in editor', { icon: 'ℹ️' })
        }
        break
      case 'codebase':
        try {
          const res = await fetch(`${BASE}/files/tree`)
          const data = await res.json()
          onAddChip?.({ id: 'codebase', type: 'folder', label: 'Codebase', content: JSON.stringify(data.tree) })
        } catch { toast.error('Failed to load codebase') }
        break
      case 'git':
        try {
          const res = await fetch(`${BASE}/chat/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'git status' }], context: {}, model_config: {}, mode: 'agent' })
          })
          onAddChip?.({ id: 'git', type: 'file', label: 'Git status', content: 'git status attached' })
        } catch {}
        break
      case 'web':
        const url = prompt('Enter URL to fetch:')
        if (url) {
          try {
            const res = await fetch(`${BASE}/files/read?path=.`)
            onAddChip?.({ id: `web_${Date.now()}`, type: 'web', label: url.slice(0, 30), content: `URL: ${url}`, url })
          } catch {}
        }
        break
      case 'terminal': {
        // Capture terminal scrollback from the terminal component
        const termEl = document.querySelector('[aria-label="Terminal"] .xterm-screen')
        const termText = termEl?.textContent || ''
        if (termText.trim()) {
          onAddChip?.({
            id: 'terminal', type: 'terminal', label: 'Terminal output',
            content: termText.trim().slice(-3000),
          })
        } else {
          toast('No terminal output available', { icon: 'ℹ️' })
        }
        break
      }
      case 'docs': {
        // Attach all markdown files from the workspace
        try {
          const res = await fetch(`${BASE}/files/search?q=`)
          const treeRes = await fetch(`${BASE}/files/tree`)
          const treeData = await treeRes.json()
          const mdFiles = []
          const findMd = (nodes) => {
            for (const n of nodes) {
              if (n.type === 'file' && /\.(md|txt|rst)$/i.test(n.name)) mdFiles.push(n)
              if (n.children) findMd(n.children)
            }
          }
          findMd(treeData.tree || [])
          if (mdFiles.length === 0) { toast('No documentation files found', { icon: 'ℹ️' }); break }
          for (const f of mdFiles.slice(0, 5)) {
            const fRes = await fetch(`${BASE}/files/read?path=${encodeURIComponent(f.path)}`)
            const fData = await fRes.json()
            onAddChip?.({
              id: `doc_${f.path}`, type: 'file', label: f.name,
              content: fData.content?.slice(0, 4000) || '', path: f.path,
            })
          }
          toast.success(`Attached ${Math.min(mdFiles.length, 5)} doc file(s)`)
        } catch (e) { toast.error('Failed to load docs') }
        break
      }
      default:
        toast(`@${option.id} context attached`, { icon: '📎' })
    }
  }

  // Handle # file selection
  const handleFileSelect = async (file) => {
    setShowFilePicker(false)
    const lastHash = input.lastIndexOf('#')
    setInput(input.slice(0, lastHash))
    try {
      const res = await fetch(`${BASE}/files/read?path=${encodeURIComponent(file.path)}`)
      const data = await res.json()
      onAddChip?.({
        id: `file_${file.path}`,
        type: 'file',
        label: file.name,
        content: data.content,
        path: file.path,
        tooltip: file.path,
      })
    } catch (e) {
      toast.error(`Cannot read ${file.name}: ${e.message}`)
    }
  }

  // Handle slash command
  const handleSlashCommand = (cmd) => {
    setShowSlash(false)
    setInput('')
    switch (cmd) {
      case '/clear': onSend?.({ _slash: 'clear' }); break
      case '/new': onSend?.({ _slash: 'new' }); break
      case '/model': onOpenSettings?.(); break
      case '/export': onSend?.({ _slash: 'export' }); break
      case '/help': toast('Commands: /clear /new /model /export /undo', { duration: 4000 }); break
      case '/undo': {
        // Restore last checkpoint via backend API
        try {
          // Get the last checkpoint from the streaming messages
          const lastCheckpoint = window.__coide_last_checkpoint_id
          if (!lastCheckpoint) {
            toast('No checkpoint to undo', { icon: 'ℹ️' })
            break
          }
          const res = await fetch(`${BASE}/chat/checkpoint/${lastCheckpoint}/restore`, { method: 'POST' })
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          toast.success(`Restored ${data.restored_files?.length || 0} file(s)`)
          window.__coide_last_checkpoint_id = null
        } catch (e) {
          toast.error(`Undo failed: ${e.message}`)
        }
        break
      }
      default: toast(`${cmd} — use /help for commands`, { icon: 'ℹ️' })
    }
  }

  // File upload
  const handleFileUpload = async (files) => {
    const formData = new FormData()
    for (const f of Array.from(files).slice(0, 10)) formData.append('files', f)
    try {
      const res = await fetch(`${BASE}/chat/upload`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      for (const f of data.files) {
        if (f.type === 'image') {
          setImages(prev => [...prev, f])
        } else if (f.type === 'text') {
          onAddChip?.({ id: f.id, type: 'file', label: f.filename, content: f.content, tooltip: `${f.line_count} lines` })
        } else {
          toast(f.content, { icon: '⚠️' })
        }
      }
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`)
    }
  }

  // Paste image
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) handleFileUpload([file])
    }
  }

  const modelConfig = JSON.parse(localStorage.getItem('modelConfig') || '{}')
  const modelName = modelConfig.model || 'No model'
  const tokenPct = maxTokens > 0 ? tokenCount / maxTokens : 0
  const tokenWarning = tokenPct > 0.8

  const filteredSlash = SLASH_COMMANDS.filter(c => c.cmd.includes(slashFilter))

  return (
    <div ref={containerRef} className="flex-shrink-0 border-t border-[#333] relative">
      {/* Context chips */}
      <ContextChips chips={contextChips} onRemove={onRemoveChip} />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 px-3 pt-2 flex-wrap">
          {images.map(img => (
            <ImagePreview key={img.id} file={img} onRemove={() => setImages(prev => prev.filter(i => i.id !== img.id))} />
          ))}
        </div>
      )}

      {/* Model badge */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button
          onClick={onOpenSettings}
          className="text-[10px] px-2 py-0.5 bg-[#2d2d2d] border border-[#444] rounded-full text-[#555] hover:text-[#858585] hover:border-[#555] transition-colors truncate max-w-[140px]"
          title="Click to change model"
        >
          {modelName}
        </button>
        {tokenWarning && (
          <span className="text-[10px] text-yellow-500">Context large</span>
        )}
      </div>

      {/* Textarea */}
      <div className="px-3 pt-1.5 pb-1">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onPaste={handlePaste}
          placeholder="Ask anything, @ to add context, # to reference files…"
          disabled={streaming}
          rows={1}
          className="w-full bg-transparent text-sm text-[#d4d4d4] placeholder-[#444] resize-none outline-none leading-relaxed disabled:opacity-60"
          style={{ minHeight: '24px', maxHeight: '160px' }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 pb-2">
        {/* File attach */}
        <input ref={fileInputRef} type="file" multiple className="hidden"
          accept=".py,.js,.ts,.jsx,.tsx,.html,.css,.json,.md,.txt,.yaml,.yml,.toml,.env,.sh,.rs,.go,.java,.cpp,.c,.h,.rb,.php,.sql,.png,.jpg,.jpeg,.gif,.webp,.svg"
          onChange={e => handleFileUpload(e.target.files)} />
        <button onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded text-[#555] hover:text-[#858585] hover:bg-[#2d2d2d] transition-colors" title="Attach file">
          <Paperclip size={14} />
        </button>

        {/* @ context */}
        <button onClick={() => { setShowContextPicker(true); setInput(input + '@') }}
          className="p-1.5 rounded text-[#555] hover:text-[#858585] hover:bg-[#2d2d2d] transition-colors" title="Add context (@)">
          <AtSign size={14} />
        </button>

        {/* # file */}
        <button onClick={() => { setShowFilePicker(true); setInput(input + '#') }}
          className="p-1.5 rounded text-[#555] hover:text-[#858585] hover:bg-[#2d2d2d] transition-colors" title="Reference file (#)">
          <Hash size={14} />
        </button>

        {/* Web search toggle */}
        <button
          className="p-1.5 rounded text-[#555] hover:text-[#858585] hover:bg-[#2d2d2d] transition-colors" title="Web search">
          <Globe size={14} />
        </button>

        {/* Thinking toggle */}
        <button
          className="p-1.5 rounded text-[#555] hover:text-[#858585] hover:bg-[#2d2d2d] transition-colors" title="Extended thinking">
          <Brain size={14} />
        </button>

        {/* Mode toggle */}
        <button
          onClick={() => onModeOverride?.(modeOverride === 'agent' ? 'chat' : modeOverride === 'chat' ? 'auto' : 'agent')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ml-0.5 ${
            modeOverride === 'agent' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
            modeOverride === 'chat' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
            'bg-[#2d2d2d] text-[#555] border border-[#444]'
          }`}
          title="Toggle mode (auto → agent → chat)"
        >
          {modeOverride === 'agent' ? <><Zap size={9} /> AGENT</> :
           modeOverride === 'chat' ? <><MessageSquare size={9} /> CHAT</> :
           'AUTO'}
        </button>

        <div className="flex-1" />

        {/* Token counter */}
        <span className={`text-[10px] mr-2 ${tokenWarning ? 'text-yellow-500' : 'text-[#444]'}`}>
          ~{tokenCount.toLocaleString()} / {(maxTokens / 1000).toFixed(0)}k
        </span>

        {/* Stop / Send */}
        {streaming ? (
          <button
            onClick={onStop}
            className="p-1.5 bg-red-700/40 hover:bg-red-700/60 text-red-300 rounded transition-colors"
            title="Stop"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() && images.length === 0}
            className="p-1.5 bg-[#007acc] hover:bg-[#0098ff] disabled:bg-[#2d2d2d] disabled:text-[#444] text-white rounded transition-colors"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>

      {/* Pickers */}
      {showContextPicker && (
        <div className="absolute bottom-full left-3 mb-1 z-50">
          <ContextPicker
            filter={atFilter}
            onSelect={handleContextSelect}
            onClose={() => setShowContextPicker(false)}
          />
        </div>
      )}
      {showFilePicker && (
        <div className="absolute bottom-full left-3 mb-1 z-50">
          <FilePicker
            tree={tree}
            onSelect={handleFileSelect}
            onClose={() => setShowFilePicker(false)}
          />
        </div>
      )}

      {/* Slash commands */}
      {showSlash && filteredSlash.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-56 bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden z-50">
          <div className="px-3 py-1 border-b border-[#333] text-[10px] text-[#555] uppercase tracking-wider">Commands</div>
          {filteredSlash.map(c => (
            <button key={c.cmd} onClick={() => handleSlashCommand(c.cmd)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[#cccccc] hover:bg-[#094771] transition-colors">
              <span className="font-mono text-[#007acc]">{c.cmd}</span>
              <span className="text-[#555]">{c.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
