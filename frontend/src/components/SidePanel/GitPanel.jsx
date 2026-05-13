import React, { useState, useCallback, useEffect } from 'react'
import { GitBranch, RefreshCw, Check, ChevronDown, ChevronRight, FileText, Loader2, Eye } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { commitGit, getGitDiff, getGitStatus } from '../../api.js'

export default function GitPanel({ onFileOpen }) {
  const [status, setStatus] = useState({ staged: [], changes: [], untracked: [] })
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
      const data = await getGitStatus()
      setBranch(data.branch)
      setStatus({
        staged: data.staged || [],
        changes: data.changes || [],
        untracked: data.untracked || [],
      })
    } catch (e) {
      setBranch(null)
      setStatus({ staged: [], changes: [], untracked: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) {
      toast.error('Enter a commit message')
      return
    }
    setCommitting(true)
    try {
      const res = await commitGit(commitMsg)
      toast.success('Committed successfully')
      if (res?.output) {
        setDiff(res.output)
        setDiffFile('commit')
      }
      setCommitMsg('')
      await refresh()
    } catch (e) {
      toast.error(`Commit failed: ${e.message}`)
    } finally {
      setCommitting(false)
    }
  }, [commitMsg, refresh])

  const openDiff = useCallback(async (path, staged = false) => {
    try {
      const res = await getGitDiff(path, staged)
      setDiff(res.diff || '(no diff)')
      setDiffFile(path || 'workspace')
    } catch (e) {
      toast.error(`Diff failed: ${e.message}`)
    }
  }, [])

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

  const FileRow = ({ file, staged = false }) => (
    <div className="w-full flex items-center gap-1 px-4 py-1 text-[11px]">
      <button
        onClick={() => onFileOpen?.(file.path)}
        className="flex items-center gap-2 min-w-0 flex-1 text-left transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <FileText size={12} style={{ color: file.status === 'M' ? '#e8c07d' : '#73c991' }} />
        <span className="truncate">{file.name}</span>
        <span className="text-[10px] font-mono" style={{ color: file.status === 'M' ? '#e8c07d' : '#73c991' }}>
          {file.status}
        </span>
      </button>
      <button
        className="p-1 rounded transition-colors"
        title="View diff"
        onClick={() => openDiff(file.path, staged)}
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
      >
        <Eye size={11} />
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
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

      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-1">
          <input
            type="text"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommit()}
            placeholder="Commit message"
            className="flex-1 bg-transparent text-xs rounded px-2 py-1.5 outline-none transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-bright)' }}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || committing}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title="Commit"
          >
            {committing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
        </div>
      </div>

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
          </div>
        ) : (
          <>
            <SectionHeader id="staged" label="Staged" count={status.staged.length} />
            {expandedSections.staged && status.staged.map((file, i) => <FileRow key={`s-${i}`} file={file} staged />)}
            <SectionHeader id="changes" label="Changes" count={status.changes.length} />
            {expandedSections.changes && status.changes.map((file, i) => <FileRow key={`c-${i}`} file={file} />)}
            <SectionHeader id="untracked" label="Untracked" count={status.untracked.length} />
            {expandedSections.untracked && status.untracked.map((file, i) => <FileRow key={`u-${i}`} file={file} />)}
          </>
        )}
      </div>

      {diff != null && (
        <div className="border-t flex-shrink-0 max-h-[200px] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-1" style={{ background: 'var(--bg-panel)' }}>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{diffFile}</span>
            <button
              onClick={() => { setDiff(null); setDiffFile(null) }}
              className="text-[10px] px-1 rounded"
              style={{ color: 'var(--text-secondary)' }}
            >x</button>
          </div>
          <pre className="px-3 py-1 text-[11px] font-mono whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
            {diff}
          </pre>
        </div>
      )}
    </div>
  )
}

