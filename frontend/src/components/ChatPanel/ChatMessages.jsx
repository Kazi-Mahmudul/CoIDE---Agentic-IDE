import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage.jsx'

export default function ChatMessages({ messages, streamingMessage, activeFilePath, onFileOpen, onApplied, onRegenerate, onEdit }) {
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingMessage?.content?.length])

  const isEmpty = messages.length === 0 && !streamingMessage

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full text-center select-none">
          <div className="text-4xl mb-3 opacity-30">⚡</div>
          <div className="text-sm text-[#555] font-medium">Agentic IDE Assistant</div>
          <div className="text-xs text-[#444] mt-2 space-y-1 max-w-[220px]">
            <div>Ask anything or give a task</div>
            <div className="text-[#333]">Type <kbd className="bg-[#2d2d2d] px-1 rounded text-[#555]">@</kbd> to add context</div>
            <div className="text-[#333]">Type <kbd className="bg-[#2d2d2d] px-1 rounded text-[#555]">#</kbd> to reference files</div>
          </div>
          <div className="mt-4 space-y-1.5 w-full max-w-[240px]">
            {[
              'Create a FastAPI REST endpoint',
              'Explain this code',
              'Fix the bug in the current file',
            ].map(s => (
              <button
                key={s}
                onClick={() => onEdit?.({ _suggestion: s })}
                className="w-full text-left px-3 py-1.5 text-xs bg-[#1a1a1a] hover:bg-[#252526] border border-[#333] hover:border-[#444] text-[#555] hover:text-[#858585] rounded-lg transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id || i}
              message={msg}
              activeFilePath={activeFilePath}
              onFileOpen={onFileOpen}
              onApplied={onApplied}
              onRegenerate={i === messages.length - 1 && msg.role === 'assistant' ? onRegenerate : undefined}
              onEdit={onEdit}
            />
          ))}

          {/* Streaming message */}
          {streamingMessage && (
            <ChatMessage
              message={streamingMessage}
              streaming={true}
              activeFilePath={activeFilePath}
              onFileOpen={onFileOpen}
              onApplied={onApplied}
            />
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
