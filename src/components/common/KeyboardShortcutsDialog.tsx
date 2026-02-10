import { useEffect } from 'react'
import { X, Command, Keyboard } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutItem[]
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const mod = isMac ? '⌘' : 'Ctrl'

const sections: ShortcutSection[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: [mod, '/'], description: 'Show keyboard shortcuts' },
      { keys: [mod, ','], description: 'Open settings' },
      { keys: [mod, '1–9'], description: 'Navigate to page (by order)' },
      { keys: ['Esc'], description: 'Close dialog / modal' },
    ],
  },
  {
    title: 'Query Editor',
    shortcuts: [
      { keys: [mod, 'Enter'], description: 'Execute query' },
      { keys: [mod, 'S'], description: 'Save query' },
      { keys: [mod, 'T'], description: 'New tab' },
      { keys: [mod, 'W'], description: 'Close tab' },
    ],
  },
  {
    title: 'AI Assistant',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line' },
    ],
  },
  {
    title: 'Data Viewer',
    shortcuts: [
      { keys: ['Enter'], description: 'Execute AI natural language query' },
      { keys: ['Esc'], description: 'Close document editor' },
    ],
  },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-muted/60 text-[11px] font-mono font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

interface KeyboardShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-background border rounded-xl w-[520px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard Shortcuts"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{section.title}</h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/40 transition-colors">
                    <span className="text-[12px] text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Command className="h-3 w-3" /> {isMac ? '⌘ = Command key' : 'Ctrl = Control key'}
            </span>
            <span className="text-[10px] text-muted-foreground">Press <Kbd>Esc</Kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

