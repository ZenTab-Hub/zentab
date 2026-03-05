import { useState, useRef, useEffect, useCallback } from 'react'
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react'
import { useSecurityStore } from '@/store/securityStore'

export function LockScreen() {
  const unlock = useSecurityStore((s) => s.unlock)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Check if 2FA is still enabled (may have been disabled while locked)
      const status = await window.electronAPI.security.get2FAStatus()
      if (!status.success || !status.enabled) {
        unlock()
        return
      }
      // Verify using the stored secret on the backend side
      const result = await window.electronAPI.security.verify2FA('__stored__', code)
      if (result.success && result.valid) {
        unlock()
        setCode('')
      } else {
        setError(result.error || 'Invalid code. Please try again.')
        setCode('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [code, unlock])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify()
  }, [handleVerify])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#0a0a1a]/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Application locked">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-card/90 border border-border shadow-2xl w-[360px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">Zentab Locked</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your 2FA code to unlock
            </p>
          </div>
        </div>

        {/* Code Input */}
        <div className="w-full space-y-3">
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(v)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-12 pl-10 pr-4 rounded-lg border border-input bg-background text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:tracking-[0.3em] placeholder:text-muted-foreground/40"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Unlock'}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          Open your authenticator app to get the code
        </p>
      </div>
    </div>
  )
}

