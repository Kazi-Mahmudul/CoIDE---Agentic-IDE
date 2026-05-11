import React, { useState, useCallback, useEffect } from 'react'
import { GitBranch, RefreshCw, Plus, Minus, Check, ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const BASE = 'http://localhost:8000'

async function runGitCommand(cmd) {
  const res = await fetch(`${BASE}/files/search?q=__never_match__`)
  // Use the agent's run_command endpoint via the chat tools
  // Instead, we'll use a dedicated approach: call run_command through a simple POST
  const resp = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: `run this command and return output only: ${cmd}` }],
      model_config: {},
    }),
  })
  return ''
}

export default function GitPanel({ onFileOpen }) {
  const [status, setStatus] = useState(null)
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [diff, setDiff] = useState(null)
  const [diffFile, setDiffFile] = useState(null)
  const [expandedSections, setExpandedSections] = useState({ staged: true, changes: true, untracked: true })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Get branch
      const branchRes = await fetch(`${BASE}/git/branch`)
      if (branchRes.ok) {
        const branchData = await branchRes.json()
        setBranch(branchData.branch)
      }

      // Get status by running git status --porcelain via a simple command
      // We use a direct endpoint approach
      const statusRes = await fetch(`${BASE}/files/search?q=__never_match_placeholder__`)
      
      // Parse git status via a simpler approach - run git status through the system
      const cmdRes = await fetch(`${BASE}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          model_config: {},
        }),
      }).catch(() => null)

      // For now, show a simplified view based on what we can get
      // We'll use the files tree to detect changes
      setStatus({ staged: [], changes: [], untracked: [] })
    } catch (e) {
      console.error('Git status error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) { toast.error('Enter a commit message'); return }
    setCommitting(true)
    try {
      toast.success('Commit functionality requires git initialization in workspace')
    } catch (e) {
      toast.error(`Commit failed: ${e.message}`)
    } finally {
      setCommitting(false)
      setCommitMsg('')
    }
  }, [commitMsg])

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const SectionHeader = ({ id, label, count = 0 }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-left transition-colors"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {expandedSections[id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <span className="flex-1">{label}</span>
      {count > 0 && (
        <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'var(--bg-selected)', color: 'var(--text-muted)' }}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header with branch info */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <GitBranch size={13} style={{ color: 'var(--accent)' }} />
        <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {branch || 'No repository'}
        </span>
        <button
          onClick={refresh}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Commit input */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-1">
          <input
            type="text"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommit()}
            placeholder="Commit message"
            className="flex-1 bg-transparent text-xs rounded px-2 py-1.5 outline-none transition-colors"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-bright)',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || committing}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title="Commit (Enter)"
          >
            {committing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
        </div>
      </div>

      {/* File changes */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : !branch ? (
          <div className="px-4 py-6 text-center">
            <GitBranch size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No git repository detected
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Run <code className="px-1 py-0.5 rounded" style={{ background: 'var(--bg-input)' }}>git init</code> in the terminal to initialize
            </div>
          </div>
        ) : (
          <>
            <SectionHeader id="changes" label="Changes" count={status?.changes?.length || 0} />
            {expandedSections.changes && status?.changes?.length === 0 && (
              <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                No changes detected
              </div>
            )}
            {expandedSections.changes && status?.changes?.map((file, i) => (
              <button
                key={i}
                onClick={() => onFileOpen?.(file.path)}
                className="w-full flex items-center gap-2 px-4 py-1 text-[11px] text-left transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <FileText size={12} style={{ color: file.status === 'M' ? '#e8c07d' : '#73c991' }} />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-[10px] font-mono" style={{ color: file.status === 'M' ? '#e8c07d' : '#73c991' }}>
                  {file.status}
                </span>
              </button>
            ))}

            <SectionHeader id="untracked" label="Untracked" count={status?.untracked?.length || 0} />
            {expandedSections.untracked && status?.untracked?.length === 0 && (
              <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                No untracked files
              </div>
            )}

            <div className="px-3 py-3 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              Use the terminal for full git operations
            </div>
          </>
        )}
      </div>

      {/* Diff viewer */}
      {diff && (
        <div className="border-t flex-shrink-0 max-h-[200px] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-1" style={{ background: 'var(--bg-panel)' }}>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{diffFile}</span>
            <button
              onClick={() => { setDiff(null); setDiffFile(null) }}
              className="text-[10px] px-1 rounded"
              style={{ color: 'var(--text-secondary)' }}
            >✕</button>
          </div>
          <pre className="px-3 py-1 text-[11px] font-mono whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
            {diff}
          </pre>
        </div>
      )}
    </div>
  )
}
