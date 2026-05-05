/**
 * Global keyboard shortcut handler.
 * Mounted once in App.jsx.
 * Skips shortcuts when focus is inside Monaco editor or xterm terminal.
 */
import { useEffect } from 'react'
import { useIDEStore } from '../store/useIDEStore.js'

function isInEditor(target) {
  return (
    target.closest('.monaco-editor') !== null ||
    target.closest('.xterm') !== null ||
    target.closest('input') !== null ||
    target.closest('textarea') !== null
  )
}

export function useKeyboard(editorRef, openCommandPalette) {
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const alt = e.altKey
      const key = e.key

      // Command palette shortcuts fire even from editor
      if (ctrl && shift && key === 'P') {
        e.preventDefault()
        openCommandPalette('>')
        return
      }
      if (ctrl && !shift && !alt && key === 'p') {
        e.preventDefault()
        openCommandPalette('')
        return
      }

      // Escape closes command palette
      if (key === 'Escape') {
        const { commandPaletteOpen, closeCommandPalette } = useIDEStore.getState()
        if (commandPaletteOpen) { e.preventDefault(); closeCommandPalette(); return }
      }

      // Skip remaining shortcuts when typing in editor/terminal
      if (isInEditor(e.target)) return

      const store = useIDEStore.getState()

      if (ctrl && !shift && !alt) {
        switch (key) {
          case 'b': e.preventDefault(); store.toggleSidePanel(); return
          case 'j': e.preventDefault(); store.toggleBottomPanel(); return
          case 'w': e.preventDefault(); store.closeActiveTab(); return
          case 'n': e.preventDefault(); store.openCommandPalette('new-file'); return
          case 's': e.preventDefault(); editorRef?.current?.save?.(); return
          case '=': case '+': e.preventDefault(); store.zoomIn(); return
          case '-': e.preventDefault(); store.zoomOut(); return
          case '0': e.preventDefault(); store.resetZoom(); return
          case 'Tab': e.preventDefault(); store.nextTab(); return
        }
      }

      if (ctrl && shift && !alt) {
        switch (key) {
          case 'E': e.preventDefault(); store.setActivityTab('explorer'); store.openSidePanel(); return
          case 'F': e.preventDefault(); store.setActivityTab('search'); store.openSidePanel(); return
          case 'X': e.preventDefault(); store.setActivityTab('extensions'); store.openSidePanel(); return
          case 'M': e.preventDefault(); store.setBottomTab('problems'); return
          case 'U': e.preventDefault(); store.setBottomTab('output'); return
          case 'Y': e.preventDefault(); store.setBottomTab('debug'); return
          case 'Tab': e.preventDefault(); store.prevTab(); return
          case 'S': e.preventDefault(); editorRef?.current?.saveAs?.(); return
        }
      }

      if (key === 'F11') {
        e.preventDefault()
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen()
        return
      }

      // Ctrl+` — open terminal
      if (ctrl && key === '`') {
        e.preventDefault()
        store.openBottomPanel()
        store.setBottomTab('terminal')
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editorRef, openCommandPalette])
}
