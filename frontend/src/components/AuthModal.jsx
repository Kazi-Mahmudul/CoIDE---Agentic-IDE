import React, { useState } from 'react'
import { Loader2, Lock, User } from 'lucide-react'
import { login, setAuthToken } from '../api.js'

export default function AuthModal({ open, onAuthenticated }) {
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(username, password)
      setAuthToken(res.token)
      localStorage.setItem('coide_user', JSON.stringify(res.user))
      onAuthenticated?.(res.user)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center" style={{ background: 'var(--bg-overlay)' }}>
      <form
        onSubmit={submit}
        className="w-[360px] rounded-lg shadow-2xl p-5"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-bright)' }}>Secure Sign In</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Use your account to access your isolated workspace.
        </p>
        <label className="text-[11px] block mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}>
          <User size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            autoFocus
          />
        </div>
        <label className="text-[11px] block mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}>
          <Lock size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        {error && <div className="text-xs mb-3" style={{ color: 'var(--text-danger)' }}>{error}</div>}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2 rounded text-sm font-medium transition-colors disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
        >
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Signing in</span> : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

