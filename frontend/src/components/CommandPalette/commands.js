import { useIDEStore } from '../../store/useIDEStore.js'
import { useCommandStore } from '../../store/useCommandStore.js'
import { toast } from 'react-hot-toast'

export function registerCommands({ editorRef, openCommandPalette }) {
  const store = useIDEStore.getState

  const commands = [
    { id: 'view.toggleTerminal',    label: 'View: Toggle Terminal',             shortcut: 'Ctrl+J',         action: () => store().toggleBottomPanel() },
    { id: 'view.toggleSidebar',     label: 'View: Toggle Side Bar',             shortcut: 'Ctrl+B',         action: () => store().toggleSidePanel() },
    { id: 'view.focusTerminal',     label: 'Terminal: Focus Terminal',           shortcut: 'Ctrl+`',         action: () => { store().openBottomPanel(); store().setBottomTab('terminal') } },
    { id: 'terminal.new',           label: 'Terminal: New Terminal',             shortcut: 'Ctrl+Shift+`',   action: () => { store().openBottomPanel(); store().setBottomTab('terminal') } },
    { id: 'terminal.split',         label: 'Terminal: Split Terminal',           shortcut: 'Ctrl+Shift+5',   action: () => toast('Split terminal — not yet implemented', { icon: '🚧' }) },
    { id: 'file.save',              label: 'File: Save',                         shortcut: 'Ctrl+S',         action: () => editorRef?.current?.save?.() },
    { id: 'file.saveAll',           label: 'File: Save All',                     shortcut: 'Ctrl+K S',       action: () => toast('Save All — not yet implemented', { icon: '🚧' }) },
    { id: 'file.new',               label: 'File: New File',                     shortcut: 'Ctrl+N',         action: () => toast('New File — not yet implemented', { icon: '🚧' }) },
    { id: 'file.close',             label: 'File: Close Editor',                 shortcut: 'Ctrl+W',         action: () => store().closeActiveTab() },
    { id: 'view.explorer',          label: 'View: Show Explorer',                shortcut: 'Ctrl+Shift+E',   action: () => { store().setActivityTab('explorer'); store().openSidePanel() } },
    { id: 'view.search',            label: 'View: Show Search',                  shortcut: 'Ctrl+Shift+F',   action: () => { store().setActivityTab('search'); store().openSidePanel() } },
    { id: 'view.extensions',        label: 'View: Show Extensions',              shortcut: 'Ctrl+Shift+X',   action: () => { store().setActivityTab('extensions'); store().openSidePanel() } },
    { id: 'view.problems',          label: 'View: Show Problems',                shortcut: 'Ctrl+Shift+M',   action: () => store().setBottomTab('problems') },
    { id: 'view.output',            label: 'View: Show Output',                  shortcut: 'Ctrl+Shift+U',   action: () => store().setBottomTab('output') },
    { id: 'view.debug',             label: 'View: Show Debug Console',           shortcut: 'Ctrl+Shift+Y',   action: () => store().setBottomTab('debug') },
    { id: 'editor.format',          label: 'Format Document',                    shortcut: 'Shift+Alt+F',    action: () => editorRef?.current?.getAction?.('editor.action.formatDocument')?.run() },
    { id: 'editor.gotoLine',        label: 'Go to Line...',                      shortcut: 'Ctrl+G',         action: () => openCommandPalette(':') },
    { id: 'editor.gotoFile',        label: 'Go to File...',                      shortcut: 'Ctrl+P',         action: () => openCommandPalette('') },
    { id: 'editor.gotoSymbol',      label: 'Go to Symbol...',                    shortcut: 'Ctrl+Shift+O',   action: () => openCommandPalette('@') },
    { id: 'view.zoomIn',            label: 'View: Zoom In',                      shortcut: 'Ctrl+=',         action: () => store().zoomIn() },
    { id: 'view.zoomOut',           label: 'View: Zoom Out',                     shortcut: 'Ctrl+-',         action: () => store().zoomOut() },
    { id: 'view.resetZoom',         label: 'View: Reset Zoom',                   shortcut: 'Ctrl+0',         action: () => store().resetZoom() },
    { id: 'view.fullscreen',        label: 'View: Toggle Full Screen',           shortcut: 'F11',            action: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() },
    { id: 'theme.dark',             label: 'Preferences: Color Theme → Dark',    shortcut: '',               action: () => store().setTheme('dark') },
    { id: 'theme.light',            label: 'Preferences: Color Theme → Light',   shortcut: '',               action: () => store().setTheme('light') },
    { id: 'keyboard.shortcuts',     label: 'Preferences: Open Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: () => toast('Keyboard shortcuts — not yet implemented', { icon: '🚧' }) },
    { id: 'workbench.commandPalette', label: 'View: Command Palette',            shortcut: 'Ctrl+Shift+P',   action: () => openCommandPalette('>') },
  ]

  useCommandStore.getState().register(commands)
}
