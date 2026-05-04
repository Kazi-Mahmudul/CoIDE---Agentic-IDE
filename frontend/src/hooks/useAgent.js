import { useState, useCallback, useRef } from 'react'
import { streamAgentChat } from '../api.js'

export function useAgent() {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef(false)

  const sendMessage = useCallback(async (userText, contextInfo, onEvent) => {
    if (streaming) return

    // Build system message with context
    const systemContent = `You are an expert coding assistant in an agentic web IDE. You have access to tools to read, write, and manage files in the workspace, run commands, and search code.

Current workspace context:
${contextInfo || 'No context provided'}

Always be helpful, concise, and use tools proactively to accomplish tasks. When writing files, always write the complete file content.`

    const newUserMsg = { role: 'user', content: userText }
    const updatedMessages = [
      { role: 'system', content: systemContent },
      ...messages.filter(m => m.role !== 'system'),
      newUserMsg,
    ]

    setMessages(prev => [...prev.filter(m => m.role !== 'system'), newUserMsg])
    setStreaming(true)
    abortRef.current = false

    try {
      await streamAgentChat(updatedMessages, (event) => {
        if (abortRef.current) return
        onEvent(event)
      })
    } catch (e) {
      onEvent({ type: 'error', content: e.message })
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming])

  const addAssistantMessage = useCallback((content) => {
    setMessages(prev => [...prev.filter(m => m.role !== 'system'), { role: 'assistant', content }])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const stop = useCallback(() => {
    abortRef.current = true
    setStreaming(false)
  }, [])

  return { messages, streaming, sendMessage, addAssistantMessage, clearMessages, stop }
}
