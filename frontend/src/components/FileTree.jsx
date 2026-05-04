import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Folder, FolderOpen, File, RefreshCw, Plus, FolderPlus,
  Trash2, Edit2, ChevronRight, ChevronDown, FolderSymlink,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  readFile, createFile, deleteFile, renameFile,
  readExternalFile, createExternalFile, deleteExternalFile, renameExternalFile,
} from '../api.js'

// ── File icon colours by extension ───────────────────────────────────────────
const EXT_COLORS = {
  js: 'text-yellow-400', jsx: 'text-yellow-400', mjs: 'text-yellow-400',
  ts: 'text-blue-400', tsx: 'text-blue-400',
  py: 'text-green-400',
  json: 'text-yellow-300', jsonc: 'text-yellow-300',
  md: 'text-gray-300', mdx: 'text-gray-300',
  css: 'text-blue-300', scss: 'text-pink-400', sass: 'text-pink-400',
  html: 'text-orange-400', htm: 'text-orange-400',
  sh: 'text-green-300', bash: 'text-green-300', zsh: 'text-green-300',
  txt: 'text-gray-400',
  yml: 'text-red-300', yaml: 'text-red-300',
  toml: 'text-orange-300', ini: 'text-orange-300',
  rs: 'text-orange-400',
  go: 'text-cyan-400',
  java: 'text-red-400',
  c: 'text-blue-300', cpp: 'text-blue-300', h: 'text-blue-300',
  rb: 'text-red-400',
  php: 'text-purple-400',
  sql: 'text-blue-200',
  xml: 'text-orange-300',
  svg: 'text-yellow-300',
  png: 'text-purple-300', jpg: 'text-purple-300', jpeg: 'text-purple-300',
  gif: 'text-purple-300', webp: 'text-purple-300',
  env: 'text-green-300',
  lock: 'text-gray-500',
}

function fileColor(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  return EXT_COLORS[ext] || 'text-[#858585]'
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, node, externalRoot, onClose, onRefresh, onFileOpen }) {
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const isExternal = !!externalRoot

  const doDelete = async () => {
    onClose()
    if (!confirm(`Delete "${node.name}"?`)) return
    try {
      if (isExternal) await deleteExternalFile(externalRoot, node.path)
      else await deleteFile(node.path)
      toast.success(`Deleted ${node.name}`)
      onRefresh()
    } catch (e) { toast.error(`Delete failed: ${e.message}`) }
  }

  const doRename = async () => {
    onClose()
    const newName = prompt('New name:', node.name)
    if (!newName || newName === node.name) return
    const parts = node.path.split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')
    try {
      if (isExternal) await renameExternalFile(externalRoot, node.path, newPath)
      else await renameFile(node.path, newPath)
      toast.success('Renamed')
      onRefresh()
    } catch (e) { toast.error(`Rename failed: ${e.message}`) }
  }

  const doNewFile = async () => {
    onClose()
    const name = prompt('New file name:')
    if (!name) return
    const dir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/')
    const newPath = dir ? `${dir}/${name}` : name
    try {
      if (isExternal) {
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
    const name = prompt('New folder name:')
    if (!name) return
    const dir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/')
    const newPath = dir ? `${dir}/${name}` : name
    try {
      if (isExternal) await createExternalFile(externalRoot, newPath, true)
      else await createFile(newPath, true)
      toast.success(`Created folder ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#2d2d2d] border border-[#555] rounded shadow-xl py-1 min-w-[160px] text-xs"
      style={{ left: x, top: y }}
    >
      <button onClick={doNewFile} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771] flex items-center gap-2">
        <Plus size={12} /> New File
      </button>
      <button onClick={doNewFolder} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771] flex items-center gap-2">
        <FolderPlus size={12} /> New Folder
      </button>
      <div className="border-t border-[#444] my-1" />
      <button onClick={doRename} className="w-full text-left px-3 py-1.5 text-[#d4d4d4] hover:bg-[#094771] flex items-center gap-2">
        <Edit2 size={12} /> Rename
      </button>
      <button onClick={doDelete} className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-[#3b1a1a] flex items-center gap-2">
        <Trash2 size={12} /> Delete
      </button>
    </div>
  )
}

// ── Single tree node ──────────────────────────────────────────────────────────
function TreeNode({ node, depth, activeFile, externalRoot, onFileOpen, onRefresh }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [contextMenu, setContextMenu] = useState(null)

  const handleClick = async () => {
    if (node.type === 'directory') {
      setExpanded(e => !e)
      return
    }
    try {
      let data
      if (externalRoot) {
        data = await readExternalFile(externalRoot, node.path)
        onFileOpen({ path: node.path, content: data.content, externalRoot })
      } else {
        data = await readFile(node.path)
        onFileOpen({ path: node.path, content: data.content })
      }
    } catch (e) {
      toast.error(`Cannot open: ${e.message}`)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const isActive = activeFile === node.path
  const pl = 8 + depth * 14

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-[3px] cursor-pointer select-none text-xs group
          ${isActive ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
        style={{ paddingLeft: pl }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'directory' ? (
          <>
            <span className="text-[#858585] flex-shrink-0 w-3">
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            <span className="text-yellow-400 flex-shrink-0">
              {expanded ? <FolderOpen size={13} /> : <Folder size={13} />}
            </span>
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <span className={`flex-shrink-0 ${fileColor(node.name)}`}>
              <File size={13} />
            </span>
          </>
        )}
        <span className="truncate leading-none">{node.name}</span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          externalRoot={externalRoot}
          onClose={() => setContextMenu(null)}
          onRefresh={onRefresh}
          onFileOpen={onFileOpen}
        />
      )}

      {node.type === 'directory' && expanded && node.children?.length > 0 && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              externalRoot={externalRoot}
              onFileOpen={onFileOpen}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Root FileTree component ───────────────────────────────────────────────────
export default function FileTree({
  tree,
  activeFile,
  externalRoot,   // null = workspace mode, string = external folder path
  rootLabel,      // display name for the root
  onFileOpen,
  onRefresh,
  onOpenFolder,   // callback to open folder picker
}) {
  const handleNewRootFile = async () => {
    const name = prompt('New file name:')
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
    const name = prompt('New folder name:')
    if (!name) return
    try {
      if (externalRoot) await createExternalFile(externalRoot, name, true)
      else await createFile(name, true)
      toast.success(`Created ${name}`)
      onRefresh()
    } catch (e) { toast.error(`Create failed: ${e.message}`) }
  }

  return (
    <div className="py-1 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 pb-1">
        <button onClick={onRefresh} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors" title="Refresh">
          <RefreshCw size={12} />
        </button>
        <button onClick={handleNewRootFile} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors" title="New File">
          <Plus size={12} />
        </button>
        <button onClick={handleNewRootFolder} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors" title="New Folder">
          <FolderPlus size={12} />
        </button>
        <div className="flex-1" />
        {onOpenFolder && (
          <button onClick={onOpenFolder} className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors" title="Open Folder…">
            <FolderSymlink size={12} />
          </button>
        )}
      </div>

      {/* Root label */}
      {rootLabel && (
        <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#555] truncate" title={rootLabel}>
          {rootLabel.split(/[/\\]/).pop() || rootLabel}
        </div>
      )}

      {tree.length === 0 ? (
        <div className="px-4 py-4 text-xs text-[#444] italic text-center">
          {externalRoot ? 'Folder is empty' : 'Workspace is empty'}
          <div className="mt-2">
            <button onClick={handleNewRootFile} className="text-[#007acc] hover:underline">Create a file</button>
          </div>
        </div>
      ) : (
        tree.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            externalRoot={externalRoot}
            onFileOpen={onFileOpen}
            onRefresh={onRefresh}
          />
        ))
      )}
    </div>
  )
}
