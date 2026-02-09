import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SecurityState {
  // Persisted settings
  twoFAEnabled: boolean
  idleTimeoutMinutes: number

  // Runtime state (not persisted)
  isLocked: boolean
  lastActivityTime: number

  // Actions
  setTwoFAEnabled: (enabled: boolean) => void
  setIdleTimeoutMinutes: (minutes: number) => void
  lock: () => void
  unlock: () => void
  updateActivity: () => void
  checkIdle: () => boolean
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      twoFAEnabled: false,
      idleTimeoutMinutes: 30,
      isLocked: false,
      lastActivityTime: Date.now(),

      setTwoFAEnabled: (enabled) => set({ twoFAEnabled: enabled }),

      setIdleTimeoutMinutes: (minutes) => set({ idleTimeoutMinutes: minutes }),

      lock: () => set({ isLocked: true }),

      unlock: () => set({ isLocked: false, lastActivityTime: Date.now() }),

      updateActivity: () => set({ lastActivityTime: Date.now() }),

      checkIdle: () => {
        const state = get()
        if (!state.twoFAEnabled) return false
        const elapsed = Date.now() - state.lastActivityTime
        const timeoutMs = state.idleTimeoutMinutes * 60 * 1000
        return elapsed >= timeoutMs
      },
    }),
    {
      name: 'security-settings',
      partialize: (state) => ({
        twoFAEnabled: state.twoFAEnabled,
        idleTimeoutMinutes: state.idleTimeoutMinutes,
      }),
    }
  )
)

