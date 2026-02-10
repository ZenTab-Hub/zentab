import { type IpcMain } from 'electron'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { getAppSetting, setAppSetting, deleteAppSetting } from '../storage'

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
      // If secret is '__stored__', read from storage (used by LockScreen)
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
      return { success: true, valid: delta !== null }
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

