import React, { useState, useRef, useCallback } from 'react'
import { Settings, MessageSquare } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../../store/useChatStore.js'
import { authHeaders, BASE, writeFile } from '../../api.js'
import ChatMessages from './ChatMessages.jsx'
import ChatInput from './ChatInput.jsx'
import ChatThread from './ChatThread.jsx'
import ChatSettings from './ChatSettings.jsx'

function estimateTokens(text) { return Math.ceil((text || '').length / 4) }

/**
 * Trim message history to reduce token usage.
 * - Keep last 6 messages max
 * - Strip large content from older messages (keep only first 200 chars)
 * - Never strip the most recent 2 messages
 */
function buildLLMHistory(messages, newUserContent, newUserImages = []) {
  const recent = messages.slice(-6)
  const trimmed = recent.map((m, i) => {
    const isOld = i < recent.length - 2
    const content = m.content || ''
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      // Trim old messages to save tokens — keep first 200 chars + ellipsis
      content: isOld && content.length > 200
        ? content.slice(0, 200) + '… [truncated]'
        : content,
      images: m.role === 'user' ? (m.images || []).slice(0, 4) : [],
    }
  })
  trimmed.push({ role: 'user', content: newUserContent, images: newUserImages.slice(0, 6) })
  return trimmed
}

export default function ChatPanel({ activeFile, tree = [], markers = [], onFileOpen, onFileWrite }) {
  const {
    activeThreadId, addMessage, clearThread,
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
    + messages.slice(-6).reduce((sum, m) => sum + estimateTokens(m.content), 0)
    + estimateTokens(activeFile?.content?.slice(0, 8000))

  const getModelConfig = () => JSON.parse(localStorage.getItem('modelConfig') || '{}')
  const getChatSettings = () => JSON.parse(localStorage.getItem('chat_settings') || '{}')

  const handleSend = useCallback(async ({ text, images = [], contextChips: chips = [], webSearchEnabled = false, brainModeEnabled = false, _slash, _suggestion }) => {
    // ── Slash commands ────────────────────────────────────────────────────
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
      const a = document.createElement('a')
      a.href = url; a.download = `${t.title.replace(/[^a-z0-9]/gi, '_')}.md`; a.click()
      URL.revokeObjectURL(url)
      return
    }

    const content = _suggestion || text
    if (!content && images.length === 0) return

    // Cancel any in-progress stream
    if (streaming) abortRef.current?.abort()

    const modelConfig = getModelConfig()
    if (!modelConfig.base_url || !modelConfig.model) {
      toast.error('Configure your model first (click the model badge)')
      setShowSettings(true)
      return
    }

    const settings = getChatSettings()

    // ── Add user message to store ─────────────────────────────────────────
    // Give it a stable id now — addMessage will preserve it
    const userMsgId = uuidv4()
    addMessage(activeThreadId, {
      id: userMsgId,
      role: 'user',
      content,
      images,
      contextChips: chips,
    })

    // ── Build context (capped to save tokens) ─────────────────────────────
    const maxFileChars = Math.min((settings.max_context_lines || 200) * 40, 8000)
    const context = {
      active_file: activeFile?.path || null,
      active_file_content: settings.auto_include_file !== false
        ? (activeFile?.content?.slice(0, maxFileChars) || null)
        : null,
      selection: null,
      diagnostics: settings.auto_include_diagnostics !== false
        ? markers.slice(0, 10).map(m => ({
            file: m.resource?.path || activeFile?.path,
            startLineNumber: m.startLineNumber,
            message: m.message,
            severity: m.severity,
          }))
        : [],
      git_branch: null,
      codebase_summary: null,
      attached_files: chips
        .filter(c => c.type === 'file' || c.type === 'folder')
        .map(c => ({ path: c.path || c.label, content: (c.content || '').slice(0, 4000) })),
      attached_images: images,
      web_urls: chips.filter(c => c.type === 'web').map(c => ({ url: c.url, content: c.content })),
      terminal_output: chips.find(c => c.type === 'terminal')?.content?.slice(-2000) || null,
    }

    // ── Build trimmed LLM history ─────────────────────────────────────────
    // Use messages BEFORE the user message we just added (it's added via buildLLMHistory)
    const history = buildLLMHistory(messages, content, images)

    // ── Create streaming message with a UNIQUE id ─────────────────────────
    // This id is only used during streaming — it will NOT be the same as the
    // final persisted message id, preventing the duplicate key error.
    const streamingId = `streaming_${uuidv4()}`
    const finalMsgId = uuidv4()  // the id the message will have when persisted

    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    setStreamingMsg({
      id: streamingId,   // temporary id for React key during streaming
      role: 'assistant',
      content: '',
      mode: null,
      toolCalls: [],
      diffs: [],
      thinking: null,
      suggestions: [],
      checkpoint: null,
      tokensUsed: null,
    })

    const toolCallMap = {}

    try {
      const res = await fetch(`${BASE}/chat/message`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        signal: controller.signal,
        body: JSON.stringify({
          thread_id: activeThreadId,
          session_id: activeThreadId,
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
            max_iterations: brainModeEnabled ? Math.max(settings.max_iterations || 20, 35) : (settings.max_iterations || 20),
            auto_apply: settings.auto_apply || false,
            web_search_enabled: webSearchEnabled || settings.web_search_enabled || false,
            brain_mode: brainModeEnabled || settings.brain_mode || false,
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
                toolCallMap[event.id] = {
                  id: event.id, name: event.name, args: event.args,
                  status: 'running', output: null,
                }
                next.toolCalls = Object.values(toolCallMap)
                // Emit to debug console
                window.dispatchEvent(new CustomEvent('coide:debug', { detail: {
                  type: 'tool_start', name: event.name, args: event.args,
                  message: `${event.name}(${Object.keys(event.args || {}).join(', ')})`,
                }}))
                break
              case 'tool_output':
                if (toolCallMap[event.id]) {
                  toolCallMap[event.id] = {
                    ...toolCallMap[event.id],
                    output: event.output,
                    durationMs: event.duration_ms,
                    status: 'done',
                  }
                }
                next.toolCalls = Object.values(toolCallMap)
                // Emit to debug console
                window.dispatchEvent(new CustomEvent('coide:debug', { detail: {
                  type: 'tool_output', name: event.name,
                  output: event.output, duration_ms: event.duration_ms,
                  message: event.output?.slice(0, 120),
                }}))
                if (['write_file', 'edit_file', 'create_file'].includes(event.name)) {
                  const path = toolCallMap[event.id]?.args?.path
                  if (path) setTimeout(() => onFileWrite?.(path), 100)
                }
                break
              case 'diff':
                next.diffs = [...(next.diffs || []), { path: event.path, old: event.old, new: event.new }]
                if (getChatSettings().auto_apply && event.path && event.new) {
                  writeFile(event.path, event.new).then(() => onFileWrite?.(event.path)).catch(() => {})
                }
                break
              case 'suggestions':
                next.suggestions = event.items || []
                break
              case 'done':
                next.tokensUsed = event.tokens_used
                break
              case 'error':
                toast.error(event.message || 'Unknown error')
                window.dispatchEvent(new CustomEvent('coide:debug', { detail: {
                  type: 'error', message: event.message,
                }}))
                break
              case 'checkpoint':
                next.checkpoint = { id: event.id, filesChanged: event.files_changed || [] }
                // Store globally for /undo command
                window.__coide_last_checkpoint_id = event.id
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
      // Persist the final message with a STABLE id (not the streaming id)
      setStreamingMsg(prev => {
        if (prev) {
          addMessage(activeThreadId, {
            ...prev,
            id: finalMsgId,  // use the pre-generated final id, not the streaming id
          })
        }
        return null
      })
      setContextChips([])
    }
  }, [streaming, activeThreadId, messages, activeFile, markers, modeOverride,
      addMessage, clearThread, newThread, getActiveThread, setThreadMode, onFileWrite])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    fetch(`${BASE}/chat/abort/${activeThreadId}`, { method: 'POST', headers: authHeaders() }).catch(() => {})
  }, [activeThreadId])

  const handleEdit = useCallback((msg) => {
    if (msg._suggestion) handleSend({ text: msg._suggestion })
  }, [handleSend])

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) handleSend({ text: lastUser.content })
  }, [messages, handleSend])

  const addChip = useCallback((chip) => {
    setContextChips(prev => prev.find(c => c.id === chip.id) ? prev : [...prev, chip])
  }, [])

  const removeChip = useCallback((id) => {
    setContextChips(prev => prev.filter(c => c.id !== id))
  }, [])

  return (
    <div className="flex flex-col h-full relative overflow-hidden ide-chatpanel">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider flex-1 truncate"
          style={{ color: 'var(--text-secondary)' }}>
          {thread?.title && thread.title !== 'New Chat'
            ? <span style={{ color: 'var(--text-primary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{thread.title}</span>
            : 'Chat'}
        </span>
        <button
          onClick={() => setShowThreads(true)}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title="Threads"
        >
          <MessageSquare size={13} />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
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
        onApplied={(path) => onFileWrite?.(path)}
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
        threadId={activeThreadId}
        tokenCount={tokenCount}
        maxTokens={getChatSettings().max_tokens || 128000}
      />

      {showThreads && <ChatThread onClose={() => setShowThreads(false)} />}
      <ChatSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
