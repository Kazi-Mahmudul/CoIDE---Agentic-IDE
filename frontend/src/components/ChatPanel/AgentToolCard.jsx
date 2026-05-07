import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, X, Loader2, FileText, Terminal, Search, Globe, GitBranch, Package } from 'lucide-react'

const TOOL_ICONS = {
  read_file: FileText, write_file: FileText, edit_file: FileText,
  create_file: FileText, delete_file: FileText, rename_file: FileText,
  list_files: FileText, search_files: Search, glob_files: Search,
  read_multiple_files: FileText,
  run_command: Terminal,
  get_file_outline: FileText, get_codebase_summary: Package,
  git_status: GitBranch, git_diff: GitBranch, git_log: GitBranch,
  git_commit: GitBranch, git_create_branch: GitBranch,
  web_search: Globe, fetch_url: Globe,
}

const TOOL_LABELS = {
  read_file: 'Reading file', write_file: 'Writing file', edit_file: 'Editing file',
  create_file: 'Creating file', delete_file: 'Deleting file', rename_file: 'Renaming file',
  list_files: 'Listing files', search_files: 'Searching files', glob_files: 'Finding files',
  read_multiple_files: 'Reading files',
  run_command: 'Running command',
  get_file_outline: 'Getting outline', get_codebase_summary: 'Analyzing codebase',
  git_status: 'Git status', git_diff: 'Git diff', git_log: 'Git log',
  git_commit: 'Committing', git_create_branch: 'Creating branch',
  web_search: 'Searching web', fetch_url: 'Fetching URL',
}

function formatArgs(name, args) {
  if (!args) return ''
  if (args.path) return args.path
  if (args.command) return args.command.slice(0, 60) + (args.command.length > 60 ? '…' : '')
  if (args.query) return `"${args.query}"`
  if (args.url) return args.url.slice(0, 60)
  if (args.old_path) return `${args.old_path} → ${args.new_path}`
  const first = Object.values(args)[0]
  return first ? String(first).slice(0, 60) : ''
}

export default function AgentToolCard({ id, name, args, output, durationMs, status = 'running' }) {
  const [expanded, setExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (status !== 'running') return
    const t = setInterval(() => setElapsed(e => e + 100), 100)
    return () => clearInterval(t)
  }, [status])

  const Icon = TOOL_ICONS[name] || FileText
  const label = TOOL_LABELS[name] || name.replace(/_/g, ' ')
  const argStr = formatArgs(name, args)
  const isError = output && (output.startsWith('Error:') || output.startsWith('Tool error'))
  const outputLines = output ? output.split('\n') : []
  const showMore = outputLines.length > 10
  const displayOutput = expanded ? output : outputLines.slice(0, 10).join('\n')

  return (
    <div className={`my-1 rounded border text-xs overflow-hidden transition-colors ${
      isError ? 'border-red-800/50 bg-red-950/20' :
      status === 'running' ? 'border-[#007acc]/40 bg-[#007acc]/5' :
      'border-[#333] bg-[#1a1a1a]'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {/* Status icon */}
        <span className="flex-shrink-0">
          {status === 'running' ? (
            <Loader2 size={12} className="text-[#007acc] animate-spin" />
          ) : isError ? (
            <X size={12} className="text-red-400" />
          ) : (
            <Check size={12} className="text-green-400" />
          )}
        </span>

        {/* Tool icon */}
        <Icon size={12} className={`flex-shrink-0 ${isError ? 'text-red-400' : 'text-[#858585]'}`} />

        {/* Label */}
        <span className={`font-medium ${isError ? 'text-red-300' : 'text-[#cccccc]'}`}>{label}</span>

        {/* Args preview */}
        {argStr && (
          <span className="text-[#555] truncate flex-1 font-mono">{argStr}</span>
        )}

        {/* Duration / elapsed */}
        <span className="flex-shrink-0 text-[#555] ml-auto">
          {status === 'running' ? `${(elapsed / 1000).toFixed(1)}s` : durationMs ? `${durationMs}ms` : ''}
        </span>

        {/* Expand toggle */}
        {output && (
          <span className="flex-shrink-0 text-[#555]">
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        )}
      </button>

      {expanded && output && (
        <div className="px-3 pb-2 border-t border-[#333]">
          <pre className={`mt-1.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed ${
            isError ? 'text-red-300' : 'text-[#858585]'
          }`}>
            {displayOutput}
          </pre>
          {showMore && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-[#007acc] text-[10px] mt-1 hover:underline">
              Show {outputLines.length - 10} more lines
            </button>
          )}
        </div>
      )}
    </div>
  )
}
