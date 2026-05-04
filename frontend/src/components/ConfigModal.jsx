import React, { useState, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'

const PRESETS = [
  {
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  {
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
  },
  {
    label: 'Google AI Studio',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
  {
    label: 'Ollama (local)',
    base_url: 'http://localhost:11434/v1',
    model: 'llama3.2',
  },
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
    if (!baseUrl.trim() || !model.trim()) {
      alert('Base URL and Model are required.')
      return
    }
    localStorage.setItem('modelConfig', JSON.stringify({
      base_url: baseUrl.trim(),
      model: model.trim(),
      api_key: apiKey.trim(),
    }))
    onClose()
  }

  const applyPreset = (preset) => {
    setBaseUrl(preset.base_url)
    setModel(preset.model)
    setPresetOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[480px] max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3c3c3c]">
          <h2 className="text-sm font-semibold text-[#d4d4d4]">Model Configuration</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3a3a3a] text-[#858585] hover:text-[#d4d4d4] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Presets */}
          <div>
            <label className="block text-xs text-[#858585] mb-1.5">Quick Presets</label>
            <div className="relative">
              <button
                onClick={() => setPresetOpen(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded text-sm text-[#d4d4d4] hover:border-[#007acc] transition-colors"
              >
                <span>Select a provider preset…</span>
                <ChevronDown size={14} className={`transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
              </button>
              {presetOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2d2d2d] border border-[#555] rounded shadow-lg z-10">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#094771] transition-colors"
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="text-[#858585] ml-2 text-xs">{p.model}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs text-[#858585] mb-1.5">
              API Base URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.groq.com/openai/v1"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded text-sm text-[#d4d4d4] placeholder-[#555] focus:outline-none focus:border-[#007acc] transition-colors"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-[#858585] mb-1.5">
              Model Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="llama-3.3-70b-versatile"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded text-sm text-[#d4d4d4] placeholder-[#555] focus:outline-none focus:border-[#007acc] transition-colors"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs text-[#858585] mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-… (leave empty for Ollama)"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded text-sm text-[#d4d4d4] placeholder-[#555] focus:outline-none focus:border-[#007acc] transition-colors"
            />
            <p className="text-xs text-[#555] mt-1">Stored in localStorage only. Never sent to any server except your chosen provider.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#3c3c3c]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-[#858585] hover:text-[#d4d4d4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-[#007acc] hover:bg-[#0098ff] text-white rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
