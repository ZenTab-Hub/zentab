import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QueryTab {
  id: string
  name: string
  query: string
  kafkaMode: 'consume' | 'produce'
  // Transient fields (not persisted but used at runtime)
  results?: any[]
  executionTime?: number
  error?: string
  loading?: boolean
}

/** Serialisable subset that gets written to localStorage */
type PersistedTab = Pick<QueryTab, 'id' | 'name' | 'query' | 'kafkaMode'>

interface QueryTabState {
  tabs: QueryTab[]
  activeTabId: string
  _tabCounter: number

  // Actions
  addTab: (dbType: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTab: (tabId: string, updates: Partial<QueryTab>) => void
  resetTabsForConnection: (dbType: string) => void
}

const defaultQuery = (dbType: string) =>
  dbType === 'kafka' ? '{"key": "", "value": ""}' : dbType === 'redis' ? 'PING' : dbType === 'postgresql' ? 'SELECT * FROM ' : '{}'

export const useQueryTabStore = create<QueryTabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: '',
      _tabCounter: 1,

      addTab: (dbType: string) => {
        const counter = get()._tabCounter + 1
        const id = `tab-${Date.now()}-${counter}`
        const newTab: QueryTab = {
          id,
          name: `Query ${counter}`,
          query: defaultQuery(dbType),
          kafkaMode: 'consume',
          results: [],
          loading: false,
        }
        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: id,
          _tabCounter: counter,
        }))
      },

      closeTab: (tabId: string) => {
        const { tabs, activeTabId } = get()
        if (tabs.length <= 1) return
        const idx = tabs.findIndex((t) => t.id === tabId)
        const newTabs = tabs.filter((t) => t.id !== tabId)
        const newActiveId =
          activeTabId === tabId
            ? newTabs[Math.min(idx, newTabs.length - 1)].id
            : activeTabId
        set({ tabs: newTabs, activeTabId: newActiveId })
      },

      setActiveTab: (tabId: string) => set({ activeTabId: tabId }),

      updateTab: (tabId: string, updates: Partial<QueryTab>) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
        })),

      resetTabsForConnection: (dbType: string) => {
        const counter = get()._tabCounter + 1
        const id = `tab-${Date.now()}-${counter}`
        const newTab: QueryTab = {
          id,
          name: `Query ${counter}`,
          query: defaultQuery(dbType),
          kafkaMode: 'consume',
          results: [],
          loading: false,
        }
        set({ tabs: [newTab], activeTabId: id, _tabCounter: counter })
      },
    }),
    {
      name: 'queryai-query-tabs',
      // Only persist the serialisable subset — strip results/loading/error
      partialize: (state) => ({
        tabs: state.tabs.map(
          (t): PersistedTab => ({
            id: t.id,
            name: t.name,
            query: t.query,
            kafkaMode: t.kafkaMode,
          })
        ),
        activeTabId: state.activeTabId,
        _tabCounter: state._tabCounter,
      }),
      // When rehydrating, add back the transient runtime fields
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        tabs: (persisted?.tabs || []).map((t: PersistedTab) => ({
          ...t,
          results: [],
          loading: false,
          error: undefined,
          executionTime: undefined,
        })),
      }),
    }
  )
)

