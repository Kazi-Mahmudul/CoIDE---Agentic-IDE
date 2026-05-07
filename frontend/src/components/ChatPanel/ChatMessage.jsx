import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, RotateCcw, Check, Edit2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import AgentToolCard from './AgentToolCard.jsx'
import AgentThinkingCard from './AgentThinkingCard.jsx'
import DiffBlock from './DiffBlock.jsx'
import CheckpointBar from './CheckpointBar.jsx'
import ModeIndicator from './ModeIndicator.jsx'
import ApplyButton from './ApplyButton.jsx'
import ImagePreview from './ImagePreview.jsx'

// Code block with copy + apply buttons
function CodeBlock({ children, className, activeFilePath, onApplied }) {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') || ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group my-2 rounded overflow-hidden border border-[#333]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#333]">
        <span className="text-[10px] text-[#555] font-mono">{lang || 'code'}</span>
        <div className="flex items-center gap-1.5">
          <ApplyButton code={code} activeFilePath={activeFilePath} onApplied={onApplied} />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#d4d4d4] transition-colors"
          >
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 bg-[#1a1a1a] text-[12px] font-mono text-[#d4d4d4] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// Inline code
function InlineCode({ children }) {
  return (
    <code className="bg-[#2d2d2d] text-[#d4d4d4] px-1 py-0.5 rounded text-[0.85em] font-mono">
      {children}
    </code>
  )
}

export default function ChatMessage({
  message,
  streaming = false,
  activeFilePath,
  onFileOpen,
  onApplied,
  onRegenerate,
  onEdit,
}) {
  const [copied, setCopied] = useState(false)
  const { role, content, mode, toolCalls = [], thinking, diffs = [], checkpoint, suggestions = [], images = [], contextChips = [], tokensUsed } = message

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── User message ──────────────────────────────────────────────────────────
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end mb-4 group">
        {/* Context chips above */}
        {contextChips.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1 justify-end max-w-[90%]">
            {contextChips.map(c => (
              <span key={c.id} className="text-[10px] px-1.5 py-0.5 bg-[#2d2d2d] border border-[#444] rounded-full text-[#858585]">
                {c.label}
              </span>
            ))}
          </div>
        )}
        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex gap-1 mb-1 flex-wrap justify-end">
            {images.map(img => <ImagePreview key={img.id} file={img} />)}
          </div>
        )}
        {/* Message bubble */}
        <div className="relative max-w-[90%]">
          <div className="bg-[#094771] text-[#d4d4d4] rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed">
            {content}
          </div>
          {/* Edit button */}
          {onEdit && (
            <button
              onClick={() => onEdit(message)}
              className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-[#555] hover:text-[#858585] transition-all"
              title="Edit message"
            >
              <Edit2 size={11} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Error message ─────────────────────────────────────────────────────────
  if (role === 'error') {
    return (
      <div className="mb-3 px-3 py-2 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-xs">
        ⚠ {content}
      </div>
    )
  }

  // ── Assistant message ─────────────────────────────────────────────────────
  return (
    <div className="mb-4 group">
      {/* Mode badge + actions row */}
      <div className="flex items-center gap-2 mb-1.5">
        <ModeIndicator mode={mode} streaming={streaming} />
        <div className="flex-1" />
        {!streaming && content && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopyAll} className="p-1 text-[#555] hover:text-[#858585] transition-colors" title="Copy response">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
            {onRegenerate && (
              <button onClick={onRegenerate} className="p-1 text-[#555] hover:text-[#858585] transition-colors" title="Regenerate">
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Thinking card */}
      {thinking && <AgentThinkingCard content={thinking} />}

      {/* Tool call cards */}
      {toolCalls.map((tc, i) => (
        <AgentToolCard
          key={tc.id || i}
          id={tc.id}
          name={tc.name}
          args={tc.args}
          output={tc.output}
          durationMs={tc.durationMs}
          status={tc.status || 'done'}
        />
      ))}

      {/* Diff blocks */}
      {diffs.map((d, i) => (
        <DiffBlock
          key={i}
          path={d.path}
          oldContent={d.old}
          newContent={d.new}
          onOpenFile={onFileOpen}
          onApplied={onApplied}
        />
      ))}

      {/* Text content */}
      {content && (
        <div className="text-sm text-[#d4d4d4] leading-relaxed prose-chat">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                if (inline) return <InlineCode>{children}</InlineCode>
                return (
                  <CodeBlock
                    className={className}
                    activeFilePath={activeFilePath}
                    onApplied={onApplied}
                    {...props}
                  >
                    {children}
                  </CodeBlock>
                )
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">{children}</a>
              },
              table({ children }) {
                return <div className="overflow-x-auto my-2"><table className="border-collapse text-xs w-full">{children}</table></div>
              },
              th({ children }) {
                return <th className="border border-[#444] px-2 py-1 bg-[#252526] text-[#cccccc] text-left">{children}</th>
              },
              td({ children }) {
                return <td className="border border-[#333] px-2 py-1 text-[#858585]">{children}</td>
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming cursor */}
      {streaming && !content && toolCalls.length === 0 && (
        <div className="flex items-center gap-1.5 text-[#555] text-xs mt-1">
          <span className="inline-block w-1.5 h-4 bg-[#007acc] animate-pulse rounded-sm" />
        </div>
      )}

      {/* Checkpoint bar */}
      {checkpoint && (
        <CheckpointBar
          checkpointId={checkpoint.id}
          filesChanged={checkpoint.filesChanged}
          onOpenFile={onFileOpen}
          onRestored={(files) => onApplied?.(files[0])}
        />
      )}

      {/* Follow-up suggestions */}
      {suggestions.length > 0 && !streaming && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onEdit?.({ _suggestion: s })}
              className="px-2.5 py-1 text-[11px] bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#444] hover:border-[#555] text-[#858585] hover:text-[#cccccc] rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Token count */}
      {tokensUsed && !streaming && (
        <div className="text-[10px] text-[#444] mt-1">~{tokensUsed.toLocaleString()} tokens</div>
      )}
    </div>
  )
}
