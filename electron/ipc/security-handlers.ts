import { type IpcMain } from 'electron'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { getAppSetting, setAppSetting, deleteAppSetting } from '../storage'

// Rate limiting for 2FA verification to prevent brute force attacks
const verifyAttempts = { count: 0, lastReset: Date.now(), lockedUntil: 0 }
const MAX_ATTEMPTS = 5
const RESET_INTERVAL_MS = 60_000 // 1 minute
const LOCKOUT_MS = 300_000 // 5 minute lockout after max attempts

export function setupSecurityHandlers(ipcMain: IpcMain) {
  ipcMain.handle('security:setup2FA', async () => {
    try {
      const secret = new OTPAuth.Secret({ size: 20 })
      const totp = new OTPAuth.TOTP({
        issuer: 'Zentab',
        label: 'Zentab App',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      })
      const uri = totp.toString()
      const qrDataUrl = await QRCode.toDataURL(uri, { width: 256, margin: 2 })
      return { success: true, secret: secret.base32, uri, qrDataUrl }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('security:verify2FA', async (_event, secret: string, token: string) => {
    try {
      // Rate limiting check
      const now = Date.now()
      if (now < verifyAttempts.lockedUntil) {
        const remainingSec = Math.ceil((verifyAttempts.lockedUntil - now) / 1000)
        return { success: false, error: `Too many failed attempts. Try again in ${remainingSec} seconds.` }
      }
      // Reset counter after interval
      if (now - verifyAttempts.lastReset > RESET_INTERVAL_MS) {
        verifyAttempts.count = 0
        verifyAttempts.lastReset = now
      }

      // Resolve the actual secret
      let actualSecret = secret
      if (secret === '__stored__') {
        const stored = getAppSetting('2fa_secret')
        if (!stored) return { success: false, error: '2FA secret not found' }
        actualSecret = stored
      }
      const totp = new OTPAuth.TOTP({
        issuer: 'Zentab',
        label: 'Zentab App',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(actualSecret),
      })
      const delta = totp.validate({ token, window: 1 })
      const valid = delta !== null

      if (valid) {
        // Reset attempts on successful verification
        verifyAttempts.count = 0
      } else {
        verifyAttempts.count++
        if (verifyAttempts.count >= MAX_ATTEMPTS) {
          verifyAttempts.lockedUntil = now + LOCKOUT_MS
          verifyAttempts.count = 0
          return { success: false, error: 'Too many failed attempts. Locked for 5 minutes.' }
        }
      }

      return { success: true, valid }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('security:enable2FA', async (_event, secret: string) => {
    try {
      setAppSetting('2fa_secret', secret)
      setAppSetting('2fa_enabled', 'true')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('security:disable2FA', async () => {
    try {
      deleteAppSetting('2fa_secret')
      deleteAppSetting('2fa_enabled')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('security:get2FAStatus', async () => {
    try {
      const enabled = getAppSetting('2fa_enabled') === 'true'
      const secret = getAppSetting('2fa_secret')
      return { success: true, enabled, hasSecret: !!secret }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('security:getIdleTimeout', async () => {
    const val = getAppSetting('idle_timeout_minutes')
    return { success: true, minutes: val ? parseInt(val) : 30 }
  })

  ipcMain.handle('security:setIdleTimeout', async (_event, minutes: number) => {
    setAppSetting('idle_timeout_minutes', String(minutes))
    return { success: true }
  })
}

