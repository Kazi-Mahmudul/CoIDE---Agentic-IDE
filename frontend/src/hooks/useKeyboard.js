/**
 * Global keyboard shortcut handler.
 * Mounted once in App.jsx.
 *
 * Rules:
 * - Ctrl+Shift+P and Ctrl+P fire even from Monaco/xterm (command palette)
 * - Escape closes command palette from anywhere
 * - All other shortcuts are skipped when focus is inside Monaco or xterm
 */
import { useEffect } from 'react'
import { useIDEStore } from '../store/useIDEStore.js'

function isInEditorOrTerminal(target) {
  return (
    target.closest('.monaco-editor') !== null ||
    target.closest('.xterm') !== null
  )
}

function isInInput(target) {
  const tag = target.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

export function useKeyboard(editorRef, openCommandPalette) {
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const alt = e.altKey
      const key = e.key

      // ── Always-fire shortcuts (work even inside Monaco/xterm) ────────────
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

      // Escape: close command palette from anywhere
      if (key === 'Escape') {
        const { commandPaletteOpen, closeCommandPalette } = useIDEStore.getState()
        if (commandPaletteOpen) {
          e.preventDefault()
          closeCommandPalette()
          return
        }
      }

      // ── Skip remaining shortcuts when typing in editor/terminal ──────────
      if (isInEditorOrTerminal(e.target) || isInInput(e.target)) return

      const store = useIDEStore.getState()

      // Ctrl+only (no shift, no alt)
      if (ctrl && !shift && !alt) {
        switch (key.toLowerCase()) {
          case 'b': e.preventDefault(); store.toggleSidePanel(); return
          case 'j': e.preventDefault(); store.toggleBottomPanel(); return
          case 'w': e.preventDefault(); store.closeActiveTab(); return
          case 'n': e.preventDefault(); openCommandPalette('new-file'); return
          case 's': e.preventDefault(); editorRef?.current?.save?.(); return
          case '=': case '+': e.preventDefault(); store.zoomIn(); return
          case '-': e.preventDefault(); store.zoomOut(); return
          case '0': e.preventDefault(); store.resetZoom(); return
          case 'tab': e.preventDefault(); store.nextTab(); return
          case '`': e.preventDefault(); store.openBottomPanel(); store.setBottomTab('terminal'); return
        }
      }

      // Ctrl+Shift (no alt)
      if (ctrl && shift && !alt) {
        switch (key.toLowerCase()) {
          case 'e': e.preventDefault(); store.setActivityTab('explorer'); store.openSidePanel(); return
          case 'f': e.preventDefault(); store.setActivityTab('search'); store.openSidePanel(); return
          case 'x': e.preventDefault(); store.setActivityTab('extensions'); store.openSidePanel(); return
          case 'm': e.preventDefault(); store.setBottomTab('problems'); return
          case 'u': e.preventDefault(); store.setBottomTab('output'); return
          case 'y': e.preventDefault(); store.setBottomTab('debug'); return
          case 'tab': e.preventDefault(); store.prevTab(); return
          case 's': e.preventDefault(); editorRef?.current?.save?.(); return
          case 'g': e.preventDefault(); openCommandPalette(':'); return
        }
      }

      if (key === 'F11') {
        e.preventDefault()
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editorRef, openCommandPalette])
}
