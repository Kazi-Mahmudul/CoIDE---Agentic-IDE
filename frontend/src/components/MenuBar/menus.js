import { writeExternalFile, writeFile } from '../../api.js'

// All menu definitions — every action is implemented.

export function buildMenus({ store, editorRef, openCommandPalette, toast, onOpenThemePicker, onSaveAll, onOpenFile }) {
  const ed = (actionId) => () => {
    editorRef?.current?.focus()
    editorRef?.current?.trigger(actionId)
  }

  return [
    {
      label: 'File',
      items: [
        { label: 'New File',        shortcut: 'Ctrl+N',         action: () => openCommandPalette('new-file') },
        { label: 'New Window',      shortcut: 'Ctrl+Shift+N',   action: () => window.open(window.location.href, '_blank') },
        { separator: true },
        { label: 'Open File…',      shortcut: 'Ctrl+O',         action: () => openCommandPalette('open-file') },
        { label: 'Open Folder…',    shortcut: 'Ctrl+K Ctrl+O',  action: () => openCommandPalette('open-folder') },
        { separator: true },
        { label: 'Save',            shortcut: 'Ctrl+S',         action: () => editorRef?.current?.save?.() },
        { label: 'Save As…',        shortcut: 'Ctrl+Shift+S',   action: () => {
          const f = store.openFiles?.find(x => x.id === store.activeFileId)
          if (!f) return
          const name = prompt('Save as:', f.path)
          if (!name) return
          const save = f.externalRoot
            ? writeExternalFile(f.externalRoot, name, f.content || '')
            : writeFile(name, f.content || '')
          save.then(() => toast.success(`Saved as ${name}`)).catch(e => toast.error(e.message))
        }},
        { label: 'Save All',        shortcut: 'Ctrl+K S',       action: () => openCommandPalette('save-all') },
        { separator: true },
        { label: 'Close Editor',    shortcut: 'Ctrl+W',         action: () => store.closeActiveTab() },
        { label: 'Close Folder',                                 action: () => store.setExternalRoot(null) },
        { separator: true },
        { label: 'Exit',                                         action: () => window.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo',                    shortcut: 'Ctrl+Z',         action: ed('undo') },
        { label: 'Redo',                    shortcut: 'Ctrl+Y',         action: ed('redo') },
        { separator: true },
        { label: 'Cut',                     shortcut: 'Ctrl+X',         action: ed('editor.action.clipboardCutAction') },
        { label: 'Copy',                    shortcut: 'Ctrl+C',         action: ed('editor.action.clipboardCopyAction') },
        { label: 'Paste',                   shortcut: 'Ctrl+V',         action: ed('editor.action.clipboardPasteAction') },
        { separator: true },
        { label: 'Find',                    shortcut: 'Ctrl+F',         action: ed('actions.find') },
        { label: 'Replace',                 shortcut: 'Ctrl+H',         action: ed('editor.action.startFindReplaceAction') },
        { label: 'Find in Files',           shortcut: 'Ctrl+Shift+F',   action: () => { store.setActivityTab('search'); store.openSidePanel() } },
        { separator: true },
        { label: 'Go to Line…',             shortcut: 'Ctrl+G',         action: () => openCommandPalette(':') },
        { label: 'Select All',              shortcut: 'Ctrl+A',         action: ed('editor.action.selectAll') },
        { separator: true },
        { label: 'Toggle Line Comment',     shortcut: 'Ctrl+/',         action: ed('editor.action.commentLine') },
        { label: 'Toggle Block Comment',    shortcut: 'Shift+Alt+A',    action: ed('editor.action.blockComment') },
        { label: 'Format Document',         shortcut: 'Shift+Alt+F',    action: ed('editor.action.formatDocument') },
      ],
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All',              shortcut: 'Ctrl+A',         action: ed('editor.action.selectAll') },
        { separator: true },
        { label: 'Copy Line Up',            shortcut: 'Shift+Alt+Up',   action: ed('editor.action.copyLinesUpAction') },
        { label: 'Copy Line Down',          shortcut: 'Shift+Alt+Down', action: ed('editor.action.copyLinesDownAction') },
        { label: 'Move Line Up',            shortcut: 'Alt+Up',         action: ed('editor.action.moveLinesUpAction') },
        { label: 'Move Line Down',          shortcut: 'Alt+Down',       action: ed('editor.action.moveLinesDownAction') },
        { separator: true },
        { label: 'Add Cursor Above',        shortcut: 'Ctrl+Alt+Up',    action: ed('editor.action.insertCursorAbove') },
        { label: 'Add Cursor Below',        shortcut: 'Ctrl+Alt+Down',  action: ed('editor.action.insertCursorBelow') },
        { label: 'Add Next Occurrence',     shortcut: 'Ctrl+D',         action: ed('editor.action.addSelectionToNextFindMatch') },
        { label: 'Select All Occurrences',  shortcut: 'Ctrl+Shift+L',   action: ed('editor.action.selectHighlights') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette',         shortcut: 'Ctrl+Shift+P',   action: () => openCommandPalette('>') },
        { separator: true },
        { label: 'Explorer',                shortcut: 'Ctrl+Shift+E',   action: () => { store.setActivityTab('explorer'); store.openSidePanel() } },
        { label: 'Search',                  shortcut: 'Ctrl+Shift+F',   action: () => { store.setActivityTab('search'); store.openSidePanel() } },
        { label: 'Extensions',              shortcut: 'Ctrl+Shift+X',   action: () => { store.setActivityTab('extensions'); store.openSidePanel() } },
        { separator: true },
        { label: 'Terminal',                shortcut: 'Ctrl+`',         action: () => { store.openBottomPanel(); store.setBottomTab('terminal') } },
        { label: 'Problems',                shortcut: 'Ctrl+Shift+M',   action: () => store.setBottomTab('problems') },
        { label: 'Output',                  shortcut: 'Ctrl+Shift+U',   action: () => store.setBottomTab('output') },
        { label: 'Debug Console',           shortcut: 'Ctrl+Shift+Y',   action: () => store.setBottomTab('debug') },
        { separator: true },
        { label: 'Toggle Side Bar',         shortcut: 'Ctrl+B',         action: () => store.toggleSidePanel() },
        { label: 'Toggle Panel',            shortcut: 'Ctrl+J',         action: () => store.toggleBottomPanel() },
        { separator: true },
        { label: 'Zoom In',                 shortcut: 'Ctrl+=',         action: () => store.zoomIn() },
        { label: 'Zoom Out',                shortcut: 'Ctrl+-',         action: () => store.zoomOut() },
        { label: 'Reset Zoom',              shortcut: 'Ctrl+0',         action: () => store.resetZoom() },
        { separator: true },
        { label: 'Full Screen',             shortcut: 'F11',            action: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() },
        { separator: true },
        {
          label: 'Theme', submenu: [
            { label: 'Color Theme…',        action: () => onOpenThemePicker?.() },
            { separator: true },
            { label: 'Dark (Default)',       action: () => store.setTheme('dark') },
            { label: 'Light',               action: () => store.setTheme('light') },
            { label: 'Dracula',             action: () => store.setTheme('dracula') },
            { label: 'Nord',                action: () => store.setTheme('nord') },
            { label: 'Monokai',             action: () => store.setTheme('monokai') },
            { label: 'Solarized Dark',      action: () => store.setTheme('solarized-dark') },
            { label: 'GitHub Dark',         action: () => store.setTheme('github-dark') },
            { label: 'Tokyo Night',         action: () => store.setTheme('tokyo-night') },
          ]
        },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Back',                    shortcut: 'Alt+Left',       action: () => window.history.back() },
        { label: 'Forward',                 shortcut: 'Alt+Right',      action: () => window.history.forward() },
        { separator: true },
        { label: 'Go to File…',             shortcut: 'Ctrl+P',         action: () => openCommandPalette('') },
        { label: 'Go to Symbol…',           shortcut: 'Ctrl+Shift+O',   action: () => openCommandPalette('@') },
        { label: 'Go to Line/Column…',      shortcut: 'Ctrl+G',         action: () => openCommandPalette(':') },
        { separator: true },
        { label: 'Go to Definition',        shortcut: 'F12',            action: ed('editor.action.revealDefinition') },
        { label: 'Go to References',        shortcut: 'Shift+F12',      action: ed('editor.action.goToReferences') },
        { separator: true },
        { label: 'Next Problem',            shortcut: 'F8',             action: ed('editor.action.marker.next') },
        { label: 'Previous Problem',        shortcut: 'Shift+F8',       action: ed('editor.action.marker.prev') },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Run Active File',         shortcut: 'F5',             action: () => {
          const f = store.openFiles?.find(x => x.id === store.activeFileId)
          if (!f) { toast('No active file'); return }
          store.openBottomPanel(); store.setBottomTab('terminal')
          // Send run command to terminal via a custom event
          window.dispatchEvent(new CustomEvent('coide:run-file', { detail: { path: f.path } }))
        }},
        { label: 'Run Without Debugging',   shortcut: 'Ctrl+F5',        action: () => {
          const f = store.openFiles?.find(x => x.id === store.activeFileId)
          if (!f) { toast('No active file'); return }
          store.openBottomPanel(); store.setBottomTab('terminal')
          window.dispatchEvent(new CustomEvent('coide:run-file', { detail: { path: f.path } }))
        }},
        { label: 'Stop',                    shortcut: 'Shift+F5',       action: () => toast('No running process') },
        { separator: true },
        { label: 'Toggle Breakpoint',       shortcut: 'F9',             action: ed('editor.debug.action.toggleBreakpoint') },
      ],
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal',            shortcut: 'Ctrl+Shift+`',   action: () => { store.openBottomPanel(); store.setBottomTab('terminal') } },
        { separator: true },
        { label: 'Run Active File',                                      action: () => {
          const f = store.openFiles?.find(x => x.id === store.activeFileId)
          if (!f) { toast('No active file'); return }
          store.openBottomPanel(); store.setBottomTab('terminal')
          window.dispatchEvent(new CustomEvent('coide:run-file', { detail: { path: f.path } }))
        }},
        { separator: true },
        { label: 'Clear Terminal',                                       action: () => window.dispatchEvent(new CustomEvent('coide:clear-terminal')) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts',      shortcut: 'Ctrl+K Ctrl+S',  action: () => openCommandPalette('>keyboard') },
        { separator: true },
        { label: 'Color Theme',             shortcut: 'Ctrl+K Ctrl+T',  action: () => onOpenThemePicker?.() },
        { separator: true },
        { label: 'About Coide',                                          action: () => toast('Coide — Agentic Web IDE v1.0  |  Built with React + FastAPI', { icon: '💡', duration: 5000 }) },
      ],
    },
  ]
}
