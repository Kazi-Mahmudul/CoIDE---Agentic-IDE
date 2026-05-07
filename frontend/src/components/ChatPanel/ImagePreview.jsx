import React from 'react'
import { X } from 'lucide-react'

export default function ImagePreview({ file, onRemove }) {
  const src = file.base64
    ? `data:${file.media_type || 'image/png'};base64,${file.base64}`
    : file.url || ''

  return (
    <div className="relative inline-block flex-shrink-0">
      <img
        src={src}
        alt={file.filename || 'image'}
        className="w-16 h-16 object-cover rounded border border-[#444]"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
        >
          <X size={8} className="text-white" />
        </button>
      )}
      <div className="text-[9px] text-[#555] truncate max-w-[64px] mt-0.5">{file.filename}</div>
    </div>
  )
}
