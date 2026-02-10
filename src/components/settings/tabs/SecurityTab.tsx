import { useState, useCallback, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useSecurityStore } from '@/store/securityStore'
import { useToast } from '@/components/common/Toast'
import { SELECT_CLS, LABEL_CLS, DESC_CLS, ROW_CLS, SECTION_CLS, SECTION_TITLE_CLS } from '../settingsConstants'

export function SecurityTab() {
  const { twoFAEnabled, idleTimeoutMinutes, setTwoFAEnabled, setIdleTimeoutMinutes } = useSecurityStore()
  const tt = useToast()
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle')
  const [qrData, setQrData] = useState<{ secret: string; qrDataUrl: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.electronAPI.security.get2FAStatus().then((res) => {
      if (res.success) setTwoFAEnabled(!!res.enabled)
    })
    window.electronAPI.security.getIdleTimeout().then((res) => {
      if (res.success) setIdleTimeoutMinutes(res.minutes)
    })
  }, [setTwoFAEnabled, setIdleTimeoutMinutes])

  const handleStartSetup = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.security.setup2FA()
    setLoading(false)
    if (res.success && res.secret && res.qrDataUrl) {
      setQrData({ secret: res.secret, qrDataUrl: res.qrDataUrl })
      setSetupStep('qr')
    } else {
      tt.error('Failed to generate 2FA secret')
    }
  }, [tt])

  const handleVerifyAndEnable = useCallback(async () => {
    if (verifyCode.length !== 6 || !qrData) return
    setLoading(true)
    setVerifyError('')
    const res = await window.electronAPI.security.verify2FA(qrData.secret, verifyCode)
    if (res.success && res.valid) {
      await window.electronAPI.security.enable2FA(qrData.secret)
      setTwoFAEnabled(true)
      setSetupStep('idle')
      setQrData(null)
      setVerifyCode('')
      tt.success('2FA enabled successfully!')
    } else {
      setVerifyError('Invalid code. Please try again.')
      setVerifyCode('')
    }
    setLoading(false)
  }, [verifyCode, qrData, setTwoFAEnabled, tt])

  const handleDisable = useCallback(async () => {
    tt.confirm('Disable 2FA? This will remove the security lock.', async () => {
      await window.electronAPI.security.disable2FA()
      setTwoFAEnabled(false)
      setSetupStep('idle')
      setQrData(null)
      tt.success('2FA disabled')
    })
  }, [setTwoFAEnabled, tt])

  const handleTimeoutChange = useCallback(async (minutes: number) => {
    setIdleTimeoutMinutes(minutes)
    await window.electronAPI.security.setIdleTimeout(minutes)
  }, [setIdleTimeoutMinutes])

  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Two-Factor Authentication</h3>

        {twoFAEnabled && setupStep === 'idle' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-medium text-emerald-400">2FA is enabled</p>
                <p className="text-[11px] text-muted-foreground">Your app is protected with two-factor authentication</p>
              </div>
            </div>
            <button onClick={handleDisable}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors">
              Disable 2FA
            </button>
          </div>
        ) : setupStep === 'qr' && qrData ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
              <img src={qrData.qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Or enter this secret manually:</p>
              <code className="block text-xs bg-muted/50 p-2 rounded font-mono break-all select-all">{qrData.secret}</code>
            </div>
            <button onClick={() => setSetupStep('verify')}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Next — Verify Code
            </button>
          </div>
        ) : setupStep === 'verify' && qrData ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app to confirm setup:</p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={verifyCode}
              onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndEnable()}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-center text-lg font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
            <div className="flex gap-2">
              <button onClick={handleVerifyAndEnable} disabled={loading || verifyCode.length !== 6}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
              <button onClick={() => { setSetupStep('idle'); setQrData(null); setVerifyCode('') }}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-input hover:bg-accent transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Add an extra layer of security. When enabled, the app will lock after a period of inactivity and require a 2FA code to unlock.
            </p>
            <button onClick={handleStartSetup} disabled={loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}
      </div>

      {twoFAEnabled && (
        <div className={SECTION_CLS}>
          <h3 className={SECTION_TITLE_CLS}>Idle Lock Timeout</h3>
          <div className={ROW_CLS}>
            <div>
              <p className={LABEL_CLS}>Lock after inactivity</p>
              <p className={DESC_CLS}>App will lock and require 2FA after this period of no activity</p>
            </div>
            <select value={idleTimeoutMinutes} onChange={(e) => handleTimeoutChange(Number(e.target.value))} className={SELECT_CLS}>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

