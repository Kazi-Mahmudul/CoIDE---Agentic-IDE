import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage.jsx'

export default function ChatMessages({
  messages,
  streamingMessage,
  activeFilePath,
  onFileOpen,
  onApplied,
  onRegenerate,
  onEdit,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingMessage?.content?.length])

  const isEmpty = messages.length === 0 && !streamingMessage

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full text-center select-none">
          <div className="text-4xl mb-3 opacity-20">⚡</div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Agentic IDE Assistant
          </div>
          <div className="text-xs mt-2 space-y-1 max-w-[220px]" style={{ color: 'var(--text-muted)' }}>
            <div>Ask anything or give a task</div>
            <div>
              Type{' '}
              <kbd className="px-1 rounded text-[10px]" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>@</kbd>
              {' '}to add context
            </div>
            <div>
              Type{' '}
              <kbd className="px-1 rounded text-[10px]" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>#</kbd>
              {' '}to reference files
            </div>
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
                className="w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
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
              // Use msg.id as key — guaranteed unique because addMessage now preserves ids
              // and deduplicates. Fall back to index only as last resort.
              key={msg.id || `msg-${i}`}
              message={msg}
              activeFilePath={activeFilePath}
              onFileOpen={onFileOpen}
              onApplied={onApplied}
              onRegenerate={
                i === messages.length - 1 && msg.role === 'assistant'
                  ? onRegenerate
                  : undefined
              }
              onEdit={onEdit}
            />
          ))}

          {/* Streaming message — uses streamingId which starts with "streaming_"
              so it can NEVER collide with a persisted message id */}
          {streamingMessage && (
            <ChatMessage
              key={streamingMessage.id}
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
