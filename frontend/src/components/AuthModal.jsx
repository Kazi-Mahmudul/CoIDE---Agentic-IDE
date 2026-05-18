import React, { useState } from 'react'
import { Loader2, Lock, User } from 'lucide-react'
import { resendVerification, signIn, signUp, setAuthToken } from '../api.js'

export default function AuthModal({ open, onAuthenticated }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setInfo('')
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const res = await signUp(email, password)
        if (res?.status === 'pending_verification') {
          setInfo(res.message || 'Account created. Check your email to verify your account.')
          setMode('signin')
          setPassword('')
          return
        }
      }
      const res = await signIn(email, password)
      if (res?.token) {
        setAuthToken(res.token)
        localStorage.setItem('coide_user', JSON.stringify(res.user))
        onAuthenticated?.(res.user)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError('Enter your email first')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const res = await resendVerification(email)
      setInfo(res?.message || 'Verification email sent')
    } catch (err) {
      setError(err.message || 'Could not resend verification email')
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
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-bright)' }}>
          {mode === 'signup' ? 'Create Account' : 'Secure Sign In'}
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          {mode === 'signup'
            ? 'Create an account to get your own isolated workspace.'
            : 'Use your account to access your isolated workspace.'}
        </p>
        <label className="text-[11px] block mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}>
          <User size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            autoFocus
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
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
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>
        {info && <div className="text-xs mb-3" style={{ color: '#22c55e' }}>{info}</div>}
        {error && <div className="text-xs mb-3" style={{ color: 'var(--text-danger)' }}>{error}</div>}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-2 rounded text-sm font-medium transition-colors disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
        >
          {loading
            ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{mode === 'signup' ? 'Creating account' : 'Signing in'}</span>
            : (mode === 'signup' ? 'Create Account' : 'Sign In')}
        </button>
        <button
          type="button"
          className="w-full mt-2 text-xs underline"
          style={{ color: 'var(--text-secondary)' }}
          onClick={() => {
            setError('')
            setInfo('')
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
          }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            className="w-full mt-2 text-xs underline"
            style={{ color: 'var(--text-secondary)' }}
            onClick={handleResendVerification}
            disabled={loading}
          >
            Resend verification email
          </button>
        )}
      </form>
    </div>
  )
}

