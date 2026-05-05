import React from 'react'
import { Blocks } from 'lucide-react'

export default function ExtensionsPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Blocks size={32} className="text-[#555] mb-3" />
      <div className="text-xs text-[#555]">Extensions marketplace</div>
      <div className="text-[10px] text-[#444] mt-1">Coming soon</div>
    </div>
  )
}
