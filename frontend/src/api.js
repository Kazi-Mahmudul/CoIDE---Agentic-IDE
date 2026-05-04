const BASE = 'http://localhost:8000'

// ── Model config ─────────────────────────────────────────────────────────────
export function getModelConfig() {
  try {
    return JSON.parse(localStorage.getItem('modelConfig') || '{}')
  } catch {
    return {}
  }
}

// ── Workspace mode (sandboxed to backend/workspace/) ─────────────────────────

export async function getFileTree() {
  const res = await fetch(`${BASE}/files/tree`)
  if (!res.ok) throw new Error(`Failed to fetch file tree: ${res.statusText}`)
  return res.json() // { tree, root }
}

export async function readFile(path) {
  const res = await fetch(`${BASE}/files/read?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`Failed to read file: ${res.statusText}`)
  return res.json() // { path, content }
}

export async function writeFile(path, content) {
  const res = await fetch(`${BASE}/files/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error(`Failed to write file: ${res.statusText}`)
  return res.json()
}

export async function createFile(path, is_dir = false) {
  const res = await fetch(`${BASE}/files/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, is_dir }),
  })
  if (!res.ok) throw new Error(`Failed to create: ${res.statusText}`)
  return res.json()
}

export async function deleteFile(path) {
  const res = await fetch(`${BASE}/files/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`)
  return res.json()
}

export async function renameFile(oldPath, newPath) {
  const res = await fetch(`${BASE}/files/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  })
  if (!res.ok) throw new Error(`Failed to rename: ${res.statusText}`)
  return res.json()
}

// ── External folder mode (any absolute path) ──────────────────────────────────

export async function getExternalTree(root) {
  const res = await fetch(`${BASE}/external/tree?root=${encodeURIComponent(root)}`)
  if (!res.ok) throw new Error(`Failed to fetch folder: ${res.statusText}`)
  return res.json() // { tree, root }
}

export async function readExternalFile(root, path) {
  const res = await fetch(
    `${BASE}/external/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
  )
  if (!res.ok) throw new Error(`Failed to read file: ${res.statusText}`)
  return res.json() // { path, content, abs }
}

export async function writeExternalFile(root, path, content) {
  const res = await fetch(`${BASE}/external/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, path, content }),
  })
  if (!res.ok) throw new Error(`Failed to write file: ${res.statusText}`)
  return res.json()
}

export async function createExternalFile(root, path, is_dir = false) {
  const res = await fetch(`${BASE}/external/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, path, is_dir }),
  })
  if (!res.ok) throw new Error(`Failed to create: ${res.statusText}`)
  return res.json()
}

export async function deleteExternalFile(root, path) {
  const res = await fetch(
    `${BASE}/external/delete?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`)
  return res.json()
}

export async function renameExternalFile(root, oldPath, newPath) {
  const res = await fetch(`${BASE}/external/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, old_path: oldPath, new_path: newPath }),
  })
  if (!res.ok) throw new Error(`Failed to rename: ${res.statusText}`)
  return res.json()
}

export async function listDirectory(path) {
  const res = await fetch(`${BASE}/external/ls?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`Failed to list: ${res.statusText}`)
  return res.json() // { path, parent, items }
}

export async function getFilesystemRoots() {
  const res = await fetch(`${BASE}/external/roots`)
  if (!res.ok) throw new Error(`Failed to get roots: ${res.statusText}`)
  return res.json() // { roots: [{name, path}] }
}

// ── Agent streaming ───────────────────────────────────────────────────────────

export async function streamAgentChat(messages, onEvent) {
  const modelConfig = getModelConfig()

  const res = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model_config: modelConfig }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Agent error (${res.status}): ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try { onEvent(JSON.parse(trimmed)) } catch { /* ignore */ }
    }
  }
  if (buffer.trim()) {
    try { onEvent(JSON.parse(buffer.trim())) } catch { /* ignore */ }
  }
}
