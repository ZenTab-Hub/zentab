import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Singleton for use outside React components
let _addToast: ToastContextType['addToast'] | null = null
let _confirm: ToastContextType['confirm'] | null = null
export const toast = {
  success: (msg: string) => _addToast?.('success', msg),
  error: (msg: string) => _addToast?.('error', msg),
  warning: (msg: string) => _addToast?.('warning', msg),
  info: (msg: string) => _addToast?.('info', msg),
  confirm: (msg: string, onConfirm: () => void, onCancel?: () => void) => _confirm?.(msg, onConfirm, onCancel),
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}
const colorMap = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
}

interface ConfirmState {
  message: string
  onConfirm: () => void
  onCancel?: () => void
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const confirmFn = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmState({ message, onConfirm, onCancel })
  }, [])

  const ctx: ToastContextType = {
    addToast,
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg),
    warning: (msg) => addToast('warning', msg),
    info: (msg) => addToast('info', msg),
    confirm: confirmFn,
  }

  useEffect(() => { _addToast = addToast; _confirm = confirmFn }, [addToast, confirmFn])

  // Escape key to dismiss confirm dialog
  useEffect(() => {
    if (!confirmState) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { confirmState.onCancel?.(); setConfirmState(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmState])

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60" onClick={() => { confirmState.onCancel?.(); setConfirmState(null) }}>
          <div className="bg-[#1e1e2e] border border-[#333] rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-[#ccc]">{confirmState.message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { confirmState.onCancel?.(); setConfirmState(null) }}
                className="px-3 py-1.5 text-xs rounded-md border border-[#444] text-[#aaa] hover:bg-[#333] transition-colors">Cancel</button>
              <button onClick={() => { confirmState.onConfirm(); setConfirmState(null) }}
                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

const ToastItem = ({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  useEffect(() => {
    if (t.duration && t.duration > 0) {
      const timer = setTimeout(() => onRemove(t.id), t.duration)
      return () => clearTimeout(timer)
    }
  }, [t, onRemove])

  const Icon = iconMap[t.type]
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-lg animate-in slide-in-from-right-5 ${colorMap[t.type]}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <p className="text-xs flex-1">{t.message}</p>
      <button onClick={() => onRemove(t.id)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}

