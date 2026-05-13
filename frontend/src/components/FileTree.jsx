import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, File, RefreshCw, Plus, FolderPlus, Trash2, Edit2, ChevronRight, ChevronDown, FolderSymlink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { readFile, createFile, deleteFile, renameFile, readExternalFile, createExternalFile, deleteExternalFile, renameExternalFile } from '../api.js'

// File icon colors by extension
const EXT_HEX = {
  js: '#f7df1e', jsx: '#61dafb', mjs: '#f7df1e',
  ts: '#3178c6', tsx: '#61dafb',
  py: '#3572a5',
  json: '#f7df1e', jsonc: '#f7df1e',
  md: '#083fa1', mdx: '#083fa1',
  css: '#563d7c', scss: '#c6538c', sass: '#c6538c',
  html: '#e34c26', htm: '#e34c26',
  sh: '#89e051', bash: '#89e051', zsh: '#89e051',
  txt: '#aaaaaa',
  yml: '#cb171e', yaml: '#cb171e',
  toml: '#9c4221', ini: '#9c4221',
  rs: '#dea584', go: '#00add8', java: '#b07219',
  c: '#555599', cpp: '#f34b7d', h: '#555599',
  rb: '#701516', php: '#4f5d95', sql: '#e38c00',
  xml: '#f60', svg: '#ffb13b',
  png: '#a855f7', jpg: '#a855f7', jpeg: '#a855f7', gif: '#a855f7', webp: '#a855f7',
  env: '#22c55e', lock: '#888',
}

function fileIconColor(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  return EXT_HEX[ext] || null
}

// Context menu
function ContextMenu({ x, y, node, externalRoot, onClose, onRefresh, onFileOpen, onRequestInput }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const isExt = !!externalRoot

  const doDelete = async () => {
    onClose()
    if (!confirm(`Delete "${node.name}"?`)) return
    try {
      if (isExt) await deleteExternalFile(externalRoot, node.path)
      else await deleteFile(node.path)
      toast.success(`Deleted ${node.name}`)
      onRefresh()
    } catch (e) { toast.error(`Delete failed: ${e.message}`) }
  }

  const doRename = async () => {
    onClose()
    const newName = onRequestInput
      ? await onRequestInput({
      title: `Rename ${node.name}`,
      placeholder: 'New name',
      initialValue: node.name,
      submitLabel: 'Rename',
    })
      : prompt('New name:', node.name)
    if (!newName || newName === node.name) return
    const parts = node.path.split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')
    try {
      if (isExt) await renameExternalFile(externalRoot, node.path, newPath)
      else await renameFile(node.path, newPath)
      toast.success('Renamed')
      onRefresh()
    } catch (e) { toast.error(`Rename failed: ${e.message}`) }
  }

  const doNewFile = async () => {
    onClose()
    const name = onRequestInput
      ? await onRequestInput({
      title: `Create File In ${node.name}`,
      placeholder: 'e.g. app.py',
      submitLabel: 'Create File',
    })
      : prompt('New file name:')
    if (!name) return
    const dir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/')
    const newPath = dir ? `${dir}/${name}` : name
    try {
      if (isExt) {
        await createExternalFile(externalRoot, newPath, false)
        const data = await readExternalFile(externalRoot, newPath)
        onFileOpen({ path: newPath, content: data.content, externalRoot })
      } else {
        await createFile(newPath, false)
        const data = await readFile(newPath)
        onFileOpen({ path: newPath, content: data.content })
      }
      toast.success(`Created ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  const doNewFolder = async () => {
    onClose()
    const name = onRequestInput
      ? await onRequestInput({
      title: `Create Folder In ${node.name}`,
      placeholder: 'e.g. components',
      submitLabel: 'Create Folder',
    })
      : prompt('New folder name:')
    if (!name) return
    const dir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/')
    const newPath = dir ? `${dir}/${name}` : name
    try {
      if (isExt) await createExternalFile(externalRoot, newPath, true)
      else await createFile(newPath, true)
      toast.success(`Created folder ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  const MenuItem = ({ onClick, danger, children }) => (
    <button onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
      style={{ color: danger ? '#f87171' : 'var(--text-primary)' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.15)' : 'var(--bg-selected)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {children}
    </button>
  )

  return (
    <div ref={ref} className="fixed z-50 rounded shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y, background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}>
      <MenuItem onClick={doNewFile}><Plus size={12} /> New File</MenuItem>
      <MenuItem onClick={doNewFolder}><FolderPlus size={12} /> New Folder</MenuItem>
      <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
      <MenuItem onClick={doRename}><Edit2 size={12} /> Rename</MenuItem>
      <MenuItem onClick={doDelete} danger><Trash2 size={12} /> Delete</MenuItem>
    </div>
  )
}

// Single tree node
function TreeNode({ node, depth, activeFile, externalRoot, onFileOpen, onRefresh, onRequestInput }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [contextMenu, setContextMenu] = useState(null)

  const handleClick = async () => {
    if (node.type === 'directory') { setExpanded(e => !e); return }
    try {
      let data
      if (externalRoot) {
        data = await readExternalFile(externalRoot, node.path)
        onFileOpen({ path: node.path, content: data.content, externalRoot })
      } else {
        data = await readFile(node.path)
        onFileOpen({ path: node.path, content: data.content })
      }
    } catch (e) { toast.error(`Cannot open: ${e.message}`) }
  }

  const isActive = activeFile === node.path
  const pl = 8 + depth * 14
  const iconColor = fileIconColor(node.name)

  return (
    <div>
      <div
        className="flex items-center gap-1 py-[3px] cursor-pointer select-none text-xs"
        style={{
          paddingLeft: pl,
          background: isActive ? 'var(--bg-selected)' : 'transparent',
          color: isActive ? 'var(--text-bright)' : 'var(--text-primary)',
        }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {node.type === 'directory' ? (
          <>
            <span className="flex-shrink-0 w-3" style={{ color: 'var(--text-secondary)' }}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            <span className="flex-shrink-0 text-yellow-400">
              {expanded ? <FolderOpen size={13} /> : <Folder size={13} />}
            </span>
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <span className="flex-shrink-0">
              <File size={13} style={{ color: iconColor || 'var(--text-secondary)' }} />
            </span>
          </>
        )}
        <span className="truncate leading-none">{node.name}</span>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} node={node} externalRoot={externalRoot}
          onClose={() => setContextMenu(null)} onRefresh={onRefresh} onFileOpen={onFileOpen} onRequestInput={onRequestInput} />
      )}

      {node.type === 'directory' && expanded && node.children?.length > 0 && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} depth={depth + 1}
              activeFile={activeFile} externalRoot={externalRoot}
              onFileOpen={onFileOpen} onRefresh={onRefresh} onRequestInput={onRequestInput} />
          ))}
        </div>
      )}
    </div>
  )
}

// Root FileTree
export default function FileTree({ tree, activeFile, externalRoot, rootLabel, onFileOpen, onRefresh, onOpenFolder, onRequestInput }) {
  const handleNewRootFile = async () => {
    const name = onRequestInput
      ? await onRequestInput({
      title: 'Create New File',
      placeholder: 'e.g. src/main.py',
      submitLabel: 'Create File',
    })
      : prompt('New file name:')
    if (!name) return
    try {
      if (externalRoot) {
        await createExternalFile(externalRoot, name, false)
        const data = await readExternalFile(externalRoot, name)
        onFileOpen({ path: name, content: data.content, externalRoot })
      } else {
        await createFile(name, false)
        const data = await readFile(name)
        onFileOpen({ path: name, content: data.content })
      }
      toast.success(`Created ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  const handleNewRootFolder = async () => {
    const name = onRequestInput
      ? await onRequestInput({
      title: 'Create New Folder',
      placeholder: 'e.g. src/components',
      submitLabel: 'Create Folder',
    })
      : prompt('New folder name:')
    if (!name) return
    try {
      if (externalRoot) await createExternalFile(externalRoot, name, true)
      else await createFile(name, true)
      toast.success(`Created ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  const iconBtn = {
    padding: '4px', borderRadius: 4, background: 'transparent',
    color: 'var(--text-secondary)', transition: 'all 0.15s', cursor: 'pointer',
  }

  return (
    <div className="py-1 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 pb-1">
        {[
          { icon: <RefreshCw size={12} />, onClick: onRefresh, title: 'Refresh' },
          { icon: <Plus size={12} />, onClick: handleNewRootFile, title: 'New File' },
          { icon: <FolderPlus size={12} />, onClick: handleNewRootFolder, title: 'New Folder' },
        ].map(({ icon, onClick, title }) => (
          <button key={title} onClick={onClick} title={title} style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            {icon}
          </button>
        ))}
        <div className="flex-1" />
        {onOpenFolder && (
          <button onClick={onOpenFolder} title="Open Folder…" style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-bright)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <FolderSymlink size={12} />
          </button>
        )}
      </div>

      {/* Root label */}
      {rootLabel && (
        <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider truncate"
          style={{ color: 'var(--text-muted)' }} title={rootLabel}>
          {rootLabel.split(/[/\\]/).pop() || rootLabel}
        </div>
      )}

      {tree.length === 0 ? (
        <div className="px-4 py-4 text-xs italic text-center" style={{ color: 'var(--text-muted)' }}>
          {externalRoot ? 'Folder is empty' : 'Workspace is empty'}
          <div className="mt-2">
            <button onClick={handleNewRootFile} style={{ color: 'var(--accent)' }} className="hover:underline">
              Create a file
            </button>
          </div>
        </div>
      ) : (
        tree.map(node => (
          <TreeNode key={node.path} node={node} depth={0}
            activeFile={activeFile} externalRoot={externalRoot}
            onFileOpen={onFileOpen} onRefresh={onRefresh} onRequestInput={onRequestInput} />
        ))
      )}
    </div>
  )
}
