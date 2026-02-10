import { useState, useCallback, useEffect } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2, Download,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { useToast } from '@/components/common/Toast'
import { LABEL_CLS, DESC_CLS, ROW_CLS, SECTION_CLS, SECTION_TITLE_CLS } from '../settingsConstants'

export function UpdateTab() {
  const { general, setGeneralSetting } = useSettingsStore()
  const tt = useToast()
  const [status, setStatus] = useState<string>('idle')
  const [progress, setProgress] = useState(0)
  const [updateVersion, setUpdateVersion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [appVersion, setAppVersion] = useState('...')

  useEffect(() => {
    window.electronAPI.getVersion().then(setAppVersion).catch(() => setAppVersion('1.0.0'))
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.updater.onStatus((data: any) => {
      switch (data.event) {
        case 'checking':
          setStatus('checking')
          setErrorMsg('')
          break
        case 'update-available':
          setStatus('available')
          setUpdateVersion(data.version || '')
          break
        case 'update-not-available':
          setStatus('up-to-date')
          break
        case 'download-progress':
          setStatus('downloading')
          setProgress(Math.round(data.percent || 0))
          break
        case 'update-downloaded':
          setStatus('downloaded')
          setUpdateVersion(data.version || '')
          break
        case 'error':
          setStatus('error')
          setErrorMsg(data.error || 'Unknown error')
          break
      }
    })
    return unsub
  }, [])

  const handleCheckUpdate = useCallback(async () => {
    setStatus('checking')
    setErrorMsg('')
    const res = await window.electronAPI.updater.checkForUpdates()
    if (!res.success) {
      setStatus('error')
      setErrorMsg(res.error || 'Failed to check for updates')
    }
  }, [])

  const handleDownload = useCallback(async () => {
    setStatus('downloading')
    setProgress(0)
    await window.electronAPI.updater.downloadUpdate()
  }, [])

  const handleInstall = useCallback(() => {
    tt.confirm('The app will restart to install the update. Continue?', async () => {
      await window.electronAPI.updater.quitAndInstall()
    })
  }, [tt])

  const handleAutoUpdateToggle = useCallback(async () => {
    const newVal = !general.autoUpdate
    setGeneralSetting('autoUpdate', newVal)
    await window.electronAPI.updater.setAutoDownload(newVal)
  }, [general.autoUpdate, setGeneralSetting])

  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Current Version</h3>
        <div className={ROW_CLS}>
          <div>
            <p className={LABEL_CLS}>Zentab</p>
            <p className={DESC_CLS}>Currently installed version</p>
          </div>
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">v{appVersion}</span>
        </div>
      </div>

      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Check for Updates</h3>

        {status === 'checking' && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 mb-3">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Checking for updates...</p>
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-emerald-400">You're up to date! Running the latest version.</p>
          </div>
        )}

        {status === 'available' && (
          <div className="space-y-3 mb-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <Download className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-medium text-primary">Update available: v{updateVersion}</p>
                <p className="text-[11px] text-muted-foreground">A new version is ready to download</p>
              </div>
            </div>
            <button onClick={handleDownload}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Download Update
            </button>
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Downloading update... {progress}%</p>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === 'downloaded' && (
          <div className="space-y-3 mb-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <div>
                <p className="text-xs font-medium text-emerald-400">Update downloaded: v{updateVersion}</p>
                <p className="text-[11px] text-muted-foreground">Restart the app to install the update</p>
              </div>
            </div>
            <button onClick={handleInstall}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              Restart & Install
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 mb-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-xs font-medium text-destructive">Update check failed</p>
              <p className="text-[11px] text-muted-foreground">{errorMsg}</p>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'up-to-date' || status === 'error') && (
          <button onClick={handleCheckUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Check for Updates
          </button>
        )}
      </div>

      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Preferences</h3>
        <div className={ROW_CLS}>
          <div>
            <p className={LABEL_CLS}>Auto Update</p>
            <p className={DESC_CLS}>Automatically check and download updates when available</p>
          </div>
          <button onClick={handleAutoUpdateToggle}
            className={`relative w-9 h-5 rounded-full transition-colors ${general.autoUpdate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${general.autoUpdate ? 'translate-x-4' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  )
}

