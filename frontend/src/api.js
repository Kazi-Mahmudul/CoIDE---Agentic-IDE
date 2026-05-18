export const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export function getAuthToken() {
  return localStorage.getItem('coide_auth_token') || ''
}

export function setAuthToken(token) {
  if (token) localStorage.setItem('coide_auth_token', token)
  else localStorage.removeItem('coide_auth_token')
}

export function authHeaders(extra = {}) {
  const token = getAuthToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

async function request(path, init = {}) {
  const headers = authHeaders(init.headers || {})
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    const detail = isJson
      ? (body?.detail || body?.error?.message || body?.message || res.statusText)
      : (body || res.statusText)
    throw new Error(detail)
  }
  return body
}

function parseJwtExp(token) {
  try {
    const segment = token.split('.')[1]
    if (!segment) return 0
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
    return Number(payload?.exp || 0) * 1000
  } catch {
    return 0
  }
}

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
  return request('/files/tree') // { tree, root }
}

export async function readFile(path) {
  return request(`/files/read?path=${encodeURIComponent(path)}`) // { path, content }
}

export async function writeFile(path, content) {
  return request('/files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
}

export async function createFile(path, is_dir = false) {
  return request('/files/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, is_dir }),
  })
}

export async function deleteFile(path) {
  return request(`/files/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  })
}

export async function renameFile(oldPath, newPath) {
  return request('/files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  })
}

// ── External folder mode (any absolute path) ──────────────────────────────────

export async function getExternalTree(root) {
  return request(`/external/tree?root=${encodeURIComponent(root)}`) // { tree, root }
}

export async function readExternalFile(root, path) {
  return request(`/external/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`) // { path, content, abs }
}

export async function writeExternalFile(root, path, content) {
  return request('/external/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, path, content }),
  })
}

export async function createExternalFile(root, path, is_dir = false) {
  return request('/external/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, path, is_dir }),
  })
}

export async function deleteExternalFile(root, path) {
  return request(`/external/delete?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function renameExternalFile(root, oldPath, newPath) {
  return request('/external/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, old_path: oldPath, new_path: newPath }),
  })
}

export async function listDirectory(path) {
  return request(`/external/ls?path=${encodeURIComponent(path)}`) // { path, parent, items }
}

export async function getFilesystemRoots() {
  return request('/external/roots') // { roots: [{name, path}] }
}

export async function searchWorkspace(q, opts = {}) {
  const params = new URLSearchParams({
    q,
    case_sensitive: String(Boolean(opts.caseSensitive)),
    whole_word: String(Boolean(opts.wholeWord)),
    use_regex: String(Boolean(opts.useRegex)),
  })
  return request(`/files/search?${params.toString()}`)
}

export async function uploadWorkspaceFiles(files, path = '') {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  return request(`/files/upload?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body: form,
  })
}

export async function getGitStatus() {
  return request('/git/status')
}

export async function getGitDiff(path, staged = false) {
  const params = new URLSearchParams()
  if (path) params.set('path', path)
  params.set('staged', String(Boolean(staged)))
  return request(`/git/diff?${params.toString()}`)
}

export async function commitGit(message) {
  return request('/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export async function execRuntime(command, cwd = null, timeout = 30) {
  return request('/runtime/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd, timeout }),
  })
}

export async function listProjectTemplates() {
  return request('/projects/templates')
}

export async function scaffoldProject(template, name, install = false) {
  return request('/projects/scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, name, install }),
  })
}

// ── Agent streaming ───────────────────────────────────────────────────────────

export async function streamAgentChat(messages, onEvent) {
  const modelConfig = getModelConfig()

  const res = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
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

export async function signUp(email, password) {
  return request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function signIn(email, password) {
  return request('/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function verifyEmail(token) {
  return request('/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

export async function resendVerification(email) {
  return request('/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'unused' }),
  })
}

export async function refreshSession() {
  return request('/auth/refresh', { method: 'POST' })
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    setAuthToken('')
    localStorage.removeItem('coide_user')
  }
}

export async function ensureFreshToken() {
  const token = getAuthToken()
  if (!token) return null
  const expMs = parseJwtExp(token)
  if (expMs && (expMs - Date.now()) > 120000) {
    return token
  }
  const refreshed = await refreshSession()
  if (refreshed?.token) {
    setAuthToken(refreshed.token)
    return refreshed.token
  }
  return token
}

export async function login(usernameOrEmail, password) {
  // Backward-compatible helper retained for existing callsites.
  return signIn(usernameOrEmail, password)
}

export async function getCurrentUser() {
  return request('/auth/me')
}

export async function listChatUploads(sessionId = 'default') {
  return request(`/chat/uploads?session_id=${encodeURIComponent(sessionId)}`)
}

export function getChatUploadUrl(uploadId, sessionId = 'default') {
  return `${BASE}/chat/uploads/${encodeURIComponent(uploadId)}?session_id=${encodeURIComponent(sessionId)}`
}
