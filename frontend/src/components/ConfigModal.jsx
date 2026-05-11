import React, { useState, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'

const PRESETS = [
  { label: 'Groq',             base_url: 'https://api.groq.com/openai/v1',                              model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter',       base_url: 'https://openrouter.ai/api/v1',                                model: 'anthropic/claude-3.5-sonnet' },
  { label: 'Google AI Studio', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',     model: 'gemini-2.0-flash' },
  { label: 'Ollama (local)',   base_url: 'http://localhost:11434/v1',                                   model: 'llama3.2' },
]

export default function ConfigModal({ open, onClose }) {
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [presetOpen, setPresetOpen] = useState(false)

  useEffect(() => {
    if (open) {
      const cfg = JSON.parse(localStorage.getItem('modelConfig') || '{}')
      setBaseUrl(cfg.base_url || '')
      setModel(cfg.model || '')
      setApiKey(cfg.api_key || '')
    }
  }, [open])

  const handleSave = () => {
    if (!baseUrl.trim() || !model.trim()) { alert('Base URL and Model are required.'); return }
    localStorage.setItem('modelConfig', JSON.stringify({ base_url: baseUrl.trim(), model: model.trim(), api_key: apiKey.trim() }))
    onClose()
  }

  if (!open) return null

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 4,
    background: 'var(--bg-input)', border: '1px solid var(--border-light)',
    color: 'var(--text-bright)', fontSize: 13, outline: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="rounded-lg shadow-2xl w-[480px] max-w-[95vw]"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>Model Configuration</h2>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Presets */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Quick Presets</label>
            <div className="relative">
              <button
                onClick={() => setPresetOpen(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              >
                <span>Select a provider preset…</span>
                <ChevronDown size={14} className={`transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
              </button>
              {presetOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-10"
                  style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}>
                  {PRESETS.map(p => (
                    <button key={p.label}
                      onClick={() => { setBaseUrl(p.base_url); setModel(p.model); setPresetOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-selected)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span className="font-medium">{p.label}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.model}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              API Base URL <span className="text-red-400">*</span>
            </label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.groq.com/openai/v1" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'} />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Model Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={model} onChange={e => setModel(e.target.value)}
              placeholder="llama-3.3-70b-versatile" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'} />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-… (leave empty for Ollama)" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Stored in localStorage only. Never sent anywhere except your chosen provider.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="px-4 py-1.5 text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-bright)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
            Cancel
          </button>
          <button onClick={handleSave}
            className="px-4 py-1.5 text-sm text-white rounded transition-colors"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
