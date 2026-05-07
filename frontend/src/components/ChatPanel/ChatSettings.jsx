import React, { useState, useEffect } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'

const DEFAULTS = {
  base_url: '', model: '', api_key: '',
  max_tokens: 4096, temperature: 0.7,
  streaming: true,
  max_iterations: 20, auto_apply: false,
  show_thinking: true, confirm_commands: false,
  web_search_enabled: false, search_api_key: '',
  auto_include_file: true, auto_include_selection: true,
  auto_include_diagnostics: true, max_context_lines: 200,
  conversation_memory: true,
}

const PRESETS = [
  { label: 'Groq', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
  { label: 'Google AI Studio', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { label: 'Ollama', base_url: 'http://localhost:11434/v1', model: 'llama3.2' },
]

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-[#007acc]' : 'bg-[#555]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
      <span className="text-xs text-[#858585]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export default function ChatSettings({ open, onClose }) {
  const [s, setS] = useState(DEFAULTS)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) {
      const saved = JSON.parse(localStorage.getItem('chat_settings') || '{}')
      const mc = JSON.parse(localStorage.getItem('modelConfig') || '{}')
      setS({
        ...DEFAULTS, ...saved,
        base_url: mc.base_url || saved.base_url || '',
        model: mc.model || saved.model || '',
        api_key: mc.api_key || saved.api_key || '',
      })
    }
  }, [open])

  const update = (key, val) => setS(prev => {
    const next = { ...prev, [key]: val }
    localStorage.setItem('chat_settings', JSON.stringify(next))
    localStorage.setItem('modelConfig', JSON.stringify({ base_url: next.base_url, model: next.model, api_key: next.api_key }))
    return next
  })

  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />
      {/* Drawer */}
      <div className="w-72 bg-[#1e1e1e] border-l border-[#333] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] flex-shrink-0">
          <span className="text-sm font-semibold text-[#d4d4d4]">Chat Settings</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3a3a3a] text-[#555] hover:text-[#d4d4d4]">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {/* Model */}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mt-2 mb-1">Model</div>

          <div className="mb-2">
            <select
              onChange={e => { const p = PRESETS.find(x => x.label === e.target.value); if (p) { update('base_url', p.base_url); update('model', p.model) } }}
              className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-[#d4d4d4] focus:outline-none"
            >
              <option value="">Select preset…</option>
              {PRESETS.map(p => <option key={p.label}>{p.label}</option>)}
            </select>
          </div>

          <Row label="Base URL">
            <input value={s.base_url} onChange={e => update('base_url', e.target.value)}
              className="w-36 bg-[#2d2d2d] border border-[#444] rounded px-2 py-0.5 text-xs text-[#d4d4d4] focus:outline-none focus:border-[#007acc]" />
          </Row>
          <Row label="Model">
            <input value={s.model} onChange={e => update('model', e.target.value)}
              className="w-36 bg-[#2d2d2d] border border-[#444] rounded px-2 py-0.5 text-xs text-[#d4d4d4] focus:outline-none focus:border-[#007acc]" />
          </Row>
          <Row label="API Key">
            <div className="flex items-center gap-1">
              <input type={showKey ? 'text' : 'password'} value={s.api_key} onChange={e => update('api_key', e.target.value)}
                className="w-28 bg-[#2d2d2d] border border-[#444] rounded px-2 py-0.5 text-xs text-[#d4d4d4] focus:outline-none focus:border-[#007acc]" />
              <button onClick={() => setShowKey(v => !v)} className="text-[#555] hover:text-[#858585]">
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
          </Row>
          <Row label={`Max Tokens: ${s.max_tokens.toLocaleString()}`}>
            <input type="range" min={1000} max={128000} step={1000} value={s.max_tokens}
              onChange={e => update('max_tokens', Number(e.target.value))}
              className="w-24 accent-[#007acc]" />
          </Row>
          <Row label={`Temperature: ${s.temperature.toFixed(1)}`}>
            <input type="range" min={0} max={10} step={1} value={Math.round(s.temperature * 10)}
              onChange={e => update('temperature', Number(e.target.value) / 10)}
              className="w-24 accent-[#007acc]" />
          </Row>
          <Row label="Streaming"><Toggle value={s.streaming} onChange={v => update('streaming', v)} /></Row>

          {/* Agent */}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mt-3 mb-1">Agent</div>
          <Row label="Max Iterations">
            <select value={s.max_iterations} onChange={e => update('max_iterations', Number(e.target.value))}
              className="bg-[#2d2d2d] border border-[#444] rounded px-2 py-0.5 text-xs text-[#d4d4d4] focus:outline-none">
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Row>
          <Row label="Auto-apply changes"><Toggle value={s.auto_apply} onChange={v => update('auto_apply', v)} /></Row>
          <Row label="Show thinking"><Toggle value={s.show_thinking} onChange={v => update('show_thinking', v)} /></Row>
          <Row label="Confirm commands"><Toggle value={s.confirm_commands} onChange={v => update('confirm_commands', v)} /></Row>
          <Row label="Web search"><Toggle value={s.web_search_enabled} onChange={v => update('web_search_enabled', v)} /></Row>

          {/* Context */}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mt-3 mb-1">Context</div>
          <Row label="Include open file"><Toggle value={s.auto_include_file} onChange={v => update('auto_include_file', v)} /></Row>
          <Row label="Include selection"><Toggle value={s.auto_include_selection} onChange={v => update('auto_include_selection', v)} /></Row>
          <Row label="Include diagnostics"><Toggle value={s.auto_include_diagnostics} onChange={v => update('auto_include_diagnostics', v)} /></Row>
          <Row label="Max lines per file">
            <select value={s.max_context_lines} onChange={e => update('max_context_lines', Number(e.target.value))}
              className="bg-[#2d2d2d] border border-[#444] rounded px-2 py-0.5 text-xs text-[#d4d4d4] focus:outline-none">
              {[100, 200, 500, 0].map(n => <option key={n} value={n}>{n === 0 ? 'Unlimited' : n}</option>)}
            </select>
          </Row>
          <Row label="Conversation memory"><Toggle value={s.conversation_memory} onChange={v => update('conversation_memory', v)} /></Row>
        </div>

        <div className="px-4 py-3 border-t border-[#333] flex-shrink-0">
          <button
            onClick={() => { setS(DEFAULTS); localStorage.setItem('chat_settings', JSON.stringify(DEFAULTS)) }}
            className="w-full py-1.5 text-xs text-[#858585] hover:text-[#d4d4d4] border border-[#333] hover:border-[#555] rounded transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
