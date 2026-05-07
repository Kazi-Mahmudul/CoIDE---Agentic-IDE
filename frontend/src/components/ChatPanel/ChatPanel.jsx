import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Settings, MessageSquare, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../../store/useChatStore.js'
import ChatMessages from './ChatMessages.jsx'
import ChatInput from './ChatInput.jsx'
import ChatThread from './ChatThread.jsx'
import ChatSettings from './ChatSettings.jsx'

const BASE = 'http://localhost:8000'

function estimateTokens(text) { return Math.ceil((text || '').length / 4) }

export default function ChatPanel({ activeFile, tree = [], markers = [], onFileOpen, onFileWrite }) {
  const {
    threads, activeThreadId, addMessage, updateLastMessage, clearThread,
    newThread, getActiveThread, setThreadMode,
  } = useChatStore()

  const [streaming, setStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState(null)
  const [showThreads, setShowThreads] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [modeOverride, setModeOverride] = useState('auto')
  const [contextChips, setContextChips] = useState([])
  const abortRef = useRef(null)

  const thread = getActiveThread()
  const messages = thread?.messages || []

  // Token count estimate
  const tokenCount = contextChips.reduce((sum, c) => sum + estimateTokens(c.content), 0)
    + messages.slice(-10).reduce((sum, m) => sum + estimateTokens(m.content), 0)
    + estimateTokens(activeFile?.content)

  const modelConfig = JSON.parse(localStorage.getItem('modelConfig') || '{}')
  const chatSettings = JSON.parse(localStorage.getItem('chat_settings') || '{}')

  const handleSend = useCallback(async ({ text, images = [], contextChips: chips = [], _slash, _suggestion }) => {
    // Handle slash commands
    if (_slash === 'clear') { clearThread(activeThreadId); return }
    if (_slash === 'new') { newThread(); return }
    if (_slash === 'export') {
      const t = getActiveThread()
      if (!t) return
      const lines = [`# ${t.title}`, '']
      for (const m of t.messages) {
        lines.push(`**${m.role === 'user' ? 'You' : 'Assistant'}:** ${m.content || ''}`, '')
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${t.title}.md`; a.click()
      URL.revokeObjectURL(url); return
    }

    const content = _suggestion || text
    if (!content && images.length === 0) return
    if (streaming) {
      // Cancel current and start new
      abortRef.current?.abort()
    }

    if (!modelConfig.base_url || !modelConfig.model) {
      toast.error('Configure your model first (click the model badge)')
      setShowSettings(true)
      return
    }

    // Add user message
    const userMsg = {
      role: 'user',
      content,
      images,
      contextChips: chips,
      id: uuidv4(),
    }
    addMessage(activeThreadId, userMsg)

    // Build context
    const settings = JSON.parse(localStorage.getItem('chat_settings') || '{}')
    const context = {
      active_file: activeFile?.path || null,
      active_file_content: settings.auto_include_file !== false ? activeFile?.content?.slice(0, (settings.max_context_lines || 200) * 80) : null,
      selection: settings.auto_include_selection !== false ? null : null,
      diagnostics: settings.auto_include_diagnostics !== false ? markers.map(m => ({
        file: m.resource?.path || activeFile?.path,
        startLineNumber: m.startLineNumber,
        message: m.message,
        severity: m.severity,
      })) : [],
      git_branch: null,
      codebase_summary: null,
      attached_files: chips.filter(c => c.type === 'file' || c.type === 'folder').map(c => ({ path: c.path || c.label, content: c.content })),
      attached_images: images,
      web_urls: chips.filter(c => c.type === 'web').map(c => ({ url: c.url, content: c.content })),
      terminal_output: chips.find(c => c.type === 'terminal')?.content || null,
    }

    // Build message history for LLM (last 20 messages)
    const history = messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || '',
    }))
    history.push({ role: 'user', content })

    // Start streaming
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    const streamMsg = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      mode: null,
      toolCalls: [],
      diffs: [],
      thinking: null,
      suggestions: [],
      checkpoint: null,
      tokensUsed: null,
    }
    setStreamingMsg({ ...streamMsg })

    // Track tool calls by id
    const toolCallMap = {}

    try {
      const res = await fetch(`${BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          thread_id: activeThreadId,
          messages: history,
          context,
          model_config: {
            base_url: modelConfig.base_url,
            model: modelConfig.model,
            api_key: modelConfig.api_key || '',
            max_tokens: settings.max_tokens || 4096,
            temperature: settings.temperature ?? 0.7,
          },
          mode: modeOverride,
          settings: {
            max_iterations: settings.max_iterations || 20,
            auto_apply: settings.auto_apply || false,
            web_search_enabled: settings.web_search_enabled || false,
            confirm_commands: settings.confirm_commands || false,
          },
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Server error ${res.status}: ${errText}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let event
          try { event = JSON.parse(trimmed) } catch { continue }

          setStreamingMsg(prev => {
            if (!prev) return prev
            const next = { ...prev }

            switch (event.type) {
              case 'mode':
                next.mode = event.mode
                setThreadMode(activeThreadId, event.mode)
                break

              case 'thinking':
                next.thinking = event.content
                break

              case 'text':
                next.content = (next.content || '') + event.content
                break

              case 'tool_start':
                toolCallMap[event.id] = { id: event.id, name: event.name, args: event.args, status: 'running', output: null }
                next.toolCalls = Object.values(toolCallMap)
                break

              case 'tool_output':
                if (toolCallMap[event.id]) {
                  toolCallMap[event.id] = { ...toolCallMap[event.id], output: event.output, durationMs: event.duration_ms, status: 'done' }
                }
                next.toolCalls = Object.values(toolCallMap)
                // Trigger file refresh if file was written
                if (event.name === 'write_file' || event.name === 'edit_file' || event.name === 'create_file') {
                  const path = toolCallMap[event.id]?.args?.path
                  if (path) setTimeout(() => onFileWrite?.(path), 100)
                }
                break

              case 'diff':
                next.diffs = [...(next.diffs || []), { path: event.path, old: event.old, new: event.new }]
                // Auto-apply if setting enabled
                if (chatSettings.auto_apply && event.path && event.new) {
                  fetch(`${BASE}/files/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: event.path, content: event.new }),
                  }).then(() => onFileWrite?.(event.path)).catch(() => {})
                }
                break

              case 'suggestions':
                next.suggestions = event.items || []
                break

              case 'checkpoint':
                next.checkpoint = { id: event.id, filesChanged: event.files_changed || [] }
                break

              case 'done':
                next.tokensUsed = event.tokens_used
                break

              case 'error':
                toast.error(event.message || 'Unknown error')
                break
            }

            return next
          })
        }
      }

    } catch (e) {
      if (e.name !== 'AbortError') {
        toast.error(`Chat error: ${e.message}`)
      }
    } finally {
      setStreaming(false)
      setStreamingMsg(prev => {
        if (prev) {
          addMessage(activeThreadId, prev)
        }
        return null
      })
      setContextChips([])
    }
  }, [streaming, activeThreadId, messages, activeFile, markers, modeOverride, modelConfig, addMessage, clearThread, newThread, getActiveThread, setThreadMode, onFileWrite])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    fetch(`${BASE}/chat/abort/${activeThreadId}`, { method: 'POST' }).catch(() => {})
  }, [activeThreadId])

  const handleEdit = useCallback((msg) => {
    if (msg._suggestion) {
      handleSend({ text: msg._suggestion })
    }
  }, [handleSend])

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) handleSend({ text: lastUser.content })
  }, [messages, handleSend])

  const addChip = useCallback((chip) => {
    setContextChips(prev => {
      if (prev.find(c => c.id === chip.id)) return prev
      return [...prev, chip]
    })
  }, [])

  const removeChip = useCallback((id) => {
    setContextChips(prev => prev.filter(c => c.id !== id))
  }, [])

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: '#1e1e1e' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#333] flex-shrink-0 bg-[#252526]">
        <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider flex-1">
          {thread?.title && thread.title !== 'New Chat' ? (
            <span className="text-[#cccccc] normal-case font-normal truncate">{thread.title}</span>
          ) : 'Chat'}
        </span>
        <button
          onClick={() => setShowThreads(true)}
          className="p-1 rounded hover:bg-[#3a3a3a] text-[#555] hover:text-[#d4d4d4] transition-colors"
          title="Threads"
        >
          <MessageSquare size={13} />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1 rounded hover:bg-[#3a3a3a] text-[#555] hover:text-[#d4d4d4] transition-colors"
          title="Settings"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Messages */}
      <ChatMessages
        messages={messages}
        streamingMessage={streamingMsg}
        activeFilePath={activeFile?.path}
        onFileOpen={onFileOpen}
        onApplied={(path, content) => { onFileWrite?.(path); }}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
      />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming}
        tree={tree}
        activeFilePath={activeFile?.path}
        activeFileContent={activeFile?.content}
        diagnostics={markers}
        contextChips={contextChips}
        onAddChip={addChip}
        onRemoveChip={removeChip}
        onOpenSettings={() => setShowSettings(true)}
        modeOverride={modeOverride}
        onModeOverride={setModeOverride}
        tokenCount={tokenCount}
        maxTokens={JSON.parse(localStorage.getItem('chat_settings') || '{}').max_tokens || 128000}
      />

      {/* Thread sidebar overlay */}
      {showThreads && <ChatThread onClose={() => setShowThreads(false)} />}

      {/* Settings drawer overlay */}
      <ChatSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
