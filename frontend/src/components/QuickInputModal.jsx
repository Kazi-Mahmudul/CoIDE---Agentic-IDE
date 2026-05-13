import React, { useEffect, useMemo, useState } from 'react'

export default function QuickInputModal({
  open,
  title = 'Input',
  placeholder = '',
  initialValue = '',
  submitLabel = 'Create',
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => {
    if (open) setValue(initialValue || '')
  }, [open, initialValue])

  const canSubmit = useMemo(() => value.trim().length > 0, [value])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[14vh]"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] rounded-lg shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--text-bright)', borderBottom: '1px solid var(--border)' }}>
          {title}
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) onSubmit?.(value.trim())
              if (e.key === 'Escape') onClose?.()
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded outline-none text-sm"
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm transition-colors"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit?.(value.trim())}
              disabled={!canSubmit}
              className="px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

