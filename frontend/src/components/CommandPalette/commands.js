import { useIDEStore } from '../../store/useIDEStore.js'
import { useCommandStore } from '../../store/useCommandStore.js'
import { toast } from 'react-hot-toast'

export function registerCommands({ editorRef, openCommandPalette, onOpenThemePicker }) {
  const store = useIDEStore.getState

  const commands = [
    // ── View / panels ──────────────────────────────────────────────────────
    { id: 'view.toggleTerminal',    label: 'View: Toggle Terminal',              shortcut: 'Ctrl+J',         action: () => store().toggleBottomPanel() },
    { id: 'view.toggleSidebar',     label: 'View: Toggle Side Bar',              shortcut: 'Ctrl+B',         action: () => store().toggleSidePanel() },
    { id: 'view.focusTerminal',     label: 'Terminal: Focus Terminal',            shortcut: 'Ctrl+`',         action: () => { store().openBottomPanel(); store().setBottomTab('terminal') } },
    { id: 'terminal.new',           label: 'Terminal: New Terminal',              shortcut: 'Ctrl+Shift+`',   action: () => { store().openBottomPanel(); store().setBottomTab('terminal') } },
    { id: 'terminal.split',         label: 'Terminal: Split Terminal',            shortcut: 'Ctrl+Shift+5',   action: () => { store().openBottomPanel(); store().setBottomTab('terminal'); window.dispatchEvent(new CustomEvent('coide:split-terminal')) } },
    { id: 'view.explorer',          label: 'View: Show Explorer',                 shortcut: 'Ctrl+Shift+E',   action: () => { store().setActivityTab('explorer'); store().openSidePanel() } },
    { id: 'view.search',            label: 'View: Show Search',                   shortcut: 'Ctrl+Shift+F',   action: () => { store().setActivityTab('search'); store().openSidePanel() } },
    { id: 'view.extensions',        label: 'View: Show Extensions',               shortcut: 'Ctrl+Shift+X',   action: () => { store().setActivityTab('extensions'); store().openSidePanel() } },
    { id: 'view.problems',          label: 'View: Show Problems',                 shortcut: 'Ctrl+Shift+M',   action: () => store().setBottomTab('problems') },
    { id: 'view.output',            label: 'View: Show Output',                   shortcut: 'Ctrl+Shift+U',   action: () => store().setBottomTab('output') },
    { id: 'view.debug',             label: 'View: Show Debug Console',            shortcut: 'Ctrl+Shift+Y',   action: () => store().setBottomTab('debug') },
    { id: 'view.chat',              label: 'View: Show Chat Panel',               shortcut: '',               action: () => { store().setRightTab('chat'); store().openRightPanel() } },
    { id: 'view.preview',           label: 'View: Show Preview Panel',            shortcut: '',               action: () => { store().setRightTab('preview'); store().openRightPanel() } },
    { id: 'view.layoutSettings',    label: 'View: Show Layout Settings',          shortcut: '',               action: () => { store().setRightTab('settings'); store().openRightPanel() } },
    { id: 'view.toggleRightPanel',  label: 'View: Toggle Right Panel',            shortcut: '',               action: () => store().toggleRightPanel() },

    // ── File operations ────────────────────────────────────────────────────
    { id: 'file.save',              label: 'File: Save',                          shortcut: 'Ctrl+S',         action: () => editorRef?.current?.save?.() },
    { id: 'file.saveAll',           label: 'File: Save All',                      shortcut: 'Ctrl+K S',       action: () => openCommandPalette('save-all') },
    { id: 'file.new',               label: 'File: New File',                      shortcut: 'Ctrl+N',         action: () => openCommandPalette('new-file') },
    { id: 'file.openFolder',        label: 'File: Open Folder...',                shortcut: 'Ctrl+K Ctrl+O',  action: () => openCommandPalette('open-folder') },
    { id: 'file.close',             label: 'File: Close Editor',                  shortcut: 'Ctrl+W',         action: () => store().closeActiveTab() },

    // ── Editor actions ─────────────────────────────────────────────────────
    { id: 'editor.format',          label: 'Format Document',                     shortcut: 'Shift+Alt+F',    action: () => editorRef?.current?.trigger('editor.action.formatDocument') },
    { id: 'editor.gotoLine',        label: 'Go to Line...',                       shortcut: 'Ctrl+G',         action: () => openCommandPalette(':') },
    { id: 'editor.gotoFile',        label: 'Go to File...',                       shortcut: 'Ctrl+P',         action: () => openCommandPalette('') },
    { id: 'editor.gotoSymbol',      label: 'Go to Symbol...',                     shortcut: 'Ctrl+Shift+O',   action: () => openCommandPalette('@') },
    { id: 'editor.find',            label: 'Find',                                shortcut: 'Ctrl+F',         action: () => editorRef?.current?.trigger('actions.find') },
    { id: 'editor.replace',         label: 'Replace',                             shortcut: 'Ctrl+H',         action: () => editorRef?.current?.trigger('editor.action.startFindReplaceAction') },
    { id: 'editor.commentLine',     label: 'Toggle Line Comment',                 shortcut: 'Ctrl+/',         action: () => editorRef?.current?.trigger('editor.action.commentLine') },
    { id: 'editor.undo',            label: 'Undo',                                shortcut: 'Ctrl+Z',         action: () => editorRef?.current?.trigger('undo') },
    { id: 'editor.redo',            label: 'Redo',                                shortcut: 'Ctrl+Y',         action: () => editorRef?.current?.trigger('redo') },
    { id: 'editor.selectAll',       label: 'Select All',                          shortcut: 'Ctrl+A',         action: () => editorRef?.current?.trigger('editor.action.selectAll') },

    // ── View / zoom ────────────────────────────────────────────────────────
    { id: 'view.zoomIn',            label: 'View: Zoom In',                       shortcut: 'Ctrl+=',         action: () => store().zoomIn() },
    { id: 'view.zoomOut',           label: 'View: Zoom Out',                      shortcut: 'Ctrl+-',         action: () => store().zoomOut() },
    { id: 'view.resetZoom',         label: 'View: Reset Zoom',                    shortcut: 'Ctrl+0',         action: () => store().resetZoom() },
    { id: 'view.fullscreen',        label: 'View: Toggle Full Screen',            shortcut: 'F11',            action: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() },

    // ── Preferences ────────────────────────────────────────────────────────
    { id: 'theme.picker',           label: 'Preferences: Color Theme…',           shortcut: 'Ctrl+K Ctrl+T', action: () => onOpenThemePicker?.() },
    { id: 'theme.dark',             label: 'Preferences: Color Theme → Dark',     shortcut: '',               action: () => store().setTheme('dark') },
    { id: 'theme.light',            label: 'Preferences: Color Theme → Light',    shortcut: '',               action: () => store().setTheme('light') },
    { id: 'theme.dracula',          label: 'Preferences: Color Theme → Dracula',  shortcut: '',               action: () => store().setTheme('dracula') },
    { id: 'theme.nord',             label: 'Preferences: Color Theme → Nord',     shortcut: '',               action: () => store().setTheme('nord') },
    { id: 'theme.monokai',          label: 'Preferences: Color Theme → Monokai', shortcut: '',               action: () => store().setTheme('monokai') },
    { id: 'theme.solarized',        label: 'Preferences: Color Theme → Solarized Dark', shortcut: '',        action: () => store().setTheme('solarized-dark') },
    { id: 'theme.github',           label: 'Preferences: Color Theme → GitHub Dark', shortcut: '',           action: () => store().setTheme('github-dark') },
    { id: 'theme.tokyo',            label: 'Preferences: Color Theme → Tokyo Night', shortcut: '',           action: () => store().setTheme('tokyo-night') },
    { id: 'keyboard.shortcuts',     label: 'Preferences: Open Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: () => window.dispatchEvent(new CustomEvent('coide:show-shortcuts')) },
    { id: 'workbench.commandPalette', label: 'View: Command Palette',             shortcut: 'Ctrl+Shift+P',   action: () => openCommandPalette('>') },
  ]

  useCommandStore.getState().register(commands)
}
