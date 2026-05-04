import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Send, Trash2, ChevronDown, ChevronRight, Loader2, Square } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { streamAgentChat } from '../api.js'

// Tool call card component
function ToolCallCard({ name, args, result }) {
  const [expanded, setExpanded] = useState(false)
  const truncated = result && result.length > 200
  const displayResult = truncated && !expanded ? result.slice(0, 200) + '…' : result

  return (
    <div className="my-1.5 rounded border border-amber-800/50 bg-amber-950/30 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-amber-900/20 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="font-mono font-semibold">{name}</span>
        <span className="text-amber-600 truncate flex-1">
          {Object.entries(args || {}).map(([k, v]) =>
            `${k}=${JSON.stringify(v).slice(0, 40)}`
          ).join(', ')}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-amber-800/30">
          {Object.keys(args || {}).length > 0 && (
            <div className="mt-1.5 mb-1">
              <div className="text-amber-600 text-[10px] uppercase tracking-wider mb-0.5">Input</div>
              <pre className="text-amber-200/80 whitespace-pre-wrap break-all font-mono text-[11px] bg-black/20 rounded p-1.5">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          <div className="mt-1">
            <div className="text-amber-600 text-[10px] uppercase tracking-wider mb-0.5">Result</div>
            <pre className="text-amber-100/70 whitespace-pre-wrap break-all font-mono text-[11px] bg-black/20 rounded p-1.5">
              {displayResult}
            </pre>
            {truncated && (
              <button
                onClick={() => setExpanded(true)}
                className="text-amber-500 hover:text-amber-300 text-[10px] mt-0.5"
              >
                Show full output
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Individual message bubble
function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-[#094771] text-[#d4d4d4] rounded-lg px-3 py-2 text-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'assistant') {
    return (
      <div className="mb-3">
        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.map((tc, i) => (
          <ToolCallCard key={i} name={tc.name} args={tc.args} result={tc.result} />
        ))}
        {/* Text content */}
        {msg.content && (
          <div className="text-sm text-[#d4d4d4] prose-chat">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="mb-3 px-3 py-2 bg-red-950/40 border border-red-800/50 rounded text-red-400 text-xs">
        ⚠ {msg.content}
      </div>
    )
  }

  return null
}

export default function ChatPanel({ activeFile, tree, onFileWrite }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState(null) // current streaming assistant message
  const abortRef = useRef(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const historyRef = useRef([]) // raw messages for LLM

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMsg, scrollToBottom])

  const buildContext = useCallback(() => {
    const parts = []
    if (tree && tree.length > 0) {
      const flatten = (nodes, depth = 0) => {
        let out = ''
        for (const n of nodes) {
          out += '  '.repeat(depth) + (n.type === 'directory' ? '📁 ' : '📄 ') + n.name + '\n'
          if (n.children) out += flatten(n.children, depth + 1)
        }
        return out
      }
      parts.push(`File tree:\n${flatten(tree)}`)
    }
    if (activeFile) {
      const preview = activeFile.content?.slice(0, 3000)
      const truncated = activeFile.content?.length > 3000
      parts.push(`Currently open file: ${activeFile.path}\n\`\`\`\n${preview}${truncated ? '\n... (truncated)' : ''}\n\`\`\``)
    }
    return parts.join('\n\n')
  }, [tree, activeFile])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const cfg = JSON.parse(localStorage.getItem('modelConfig') || '{}')
    if (!cfg.base_url || !cfg.model) {
      toast.error('Configure your model first (gear icon)')
      return
    }

    setInput('')
    setStreaming(true)
    abortRef.current = false

    // Add user message to display
    const userDisplayMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userDisplayMsg])

    // Build LLM messages
    const context = buildContext()
    const systemMsg = {
      role: 'system',
      content: `You are an expert coding assistant in an agentic web IDE. You have access to tools to read, write, and manage files in the workspace, run shell commands, and search code.

${context ? `Current workspace context:\n${context}` : ''}

Guidelines:
- Use tools proactively to accomplish tasks
- When writing files, always write the complete file content
- After writing a file, briefly explain what you did
- Be concise but thorough`,
    }

    const llmMessages = [
      systemMsg,
      ...historyRef.current,
      { role: 'user', content: text },
    ]

    // Streaming state for current assistant message
    let currentText = ''
    let currentToolCalls = []
    const newAssistantMsg = { role: 'assistant', content: '', toolCalls: [] }

    setStreamingMsg({ ...newAssistantMsg })

    try {
      await streamAgentChat(llmMessages, (event) => {
        if (abortRef.current) return

        if (event.type === 'text') {
          currentText += event.content
          setStreamingMsg(prev => ({ ...prev, content: currentText }))
        } else if (event.type === 'tool_call') {
          const tc = { name: event.name, args: event.args || {}, result: event.result || '' }
          currentToolCalls = [...currentToolCalls, tc]
          setStreamingMsg(prev => ({ ...prev, toolCalls: currentToolCalls }))

          // If agent wrote a file, trigger reload
          if (event.name === 'write_file' && event.args?.path) {
            onFileWrite?.(event.args.path)
          }
          if (event.name === 'create_file' && event.args?.path) {
            onFileWrite?.(event.args.path)
          }
        } else if (event.type === 'error') {
          toast.error(event.content)
          setStreamingMsg(null)
          setMessages(prev => [...prev, { role: 'error', content: event.content }])
          setStreaming(false)
          return
        } else if (event.type === 'done') {
          // Finalize message
          const finalMsg = {
            role: 'assistant',
            content: currentText,
            toolCalls: currentToolCalls,
          }
          setMessages(prev => [...prev, finalMsg])
          setStreamingMsg(null)

          // Update history for next turn
          historyRef.current = [
            ...historyRef.current,
            { role: 'user', content: text },
            { role: 'assistant', content: currentText },
          ]
          setStreaming(false)
        }
      })
    } catch (e) {
      toast.error(`Agent error: ${e.message}`)
      setStreamingMsg(null)
      setStreaming(false)
    }
  }, [input, streaming, buildContext, onFileWrite])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleClear = useCallback(() => {
    setMessages([])
    historyRef.current = []
    setStreamingMsg(null)
    setStreaming(false)
    abortRef.current = true
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current = true
    setStreaming(false)
    if (streamingMsg) {
      setMessages(prev => [...prev, streamingMsg])
      setStreamingMsg(null)
    }
  }, [streamingMsg])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#858585]">Agent</span>
          {streaming && (
            <div className="flex items-center gap-1 text-[10px] text-blue-400">
              <Loader2 size={10} className="animate-spin" />
              <span>thinking…</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {streaming && (
            <button
              onClick={handleStop}
              className="p-1 rounded hover:bg-[#3a3a3a] text-red-400 hover:text-red-300 transition-colors"
              title="Stop"
            >
              <Square size={12} />
            </button>
          )}
          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors"
            title="Clear chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0">
        {messages.length === 0 && !streamingMsg && (
          <div className="text-center text-[#555] text-xs mt-8">
            <div className="text-3xl mb-2">🤖</div>
            <div>Ask the agent to help with your code</div>
            <div className="mt-2 text-[#444] space-y-1">
              <div>"Create a Python Flask app"</div>
              <div>"Refactor this to use async/await"</div>
              <div>"Add error handling to this function"</div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {/* Streaming message */}
        {streamingMsg && (
          <div className="mb-3">
            {streamingMsg.toolCalls?.map((tc, i) => (
              <ToolCallCard key={i} name={tc.name} args={tc.args} result={tc.result} />
            ))}
            {streamingMsg.content && (
              <div className="text-sm text-[#d4d4d4] prose-chat">
                <ReactMarkdown>{streamingMsg.content}</ReactMarkdown>
              </div>
            )}
            {streaming && !streamingMsg.content && streamingMsg.toolCalls?.length === 0 && (
              <div className="flex items-center gap-1.5 text-[#555] text-xs">
                <Loader2 size={11} className="animate-spin" />
                <span>Processing…</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[#333] p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            rows={3}
            className="flex-1 bg-[#3c3c3c] border border-[#555] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555] resize-none focus:outline-none focus:border-[#007acc] transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="p-2 bg-[#007acc] hover:bg-[#0098ff] disabled:bg-[#3c3c3c] disabled:text-[#555] text-white rounded transition-colors flex-shrink-0"
            title="Send (Enter)"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-[10px] text-[#444] mt-1">
          {activeFile ? `Context: ${activeFile.path}` : 'No file open'}
        </div>
      </div>
    </div>
  )
}
