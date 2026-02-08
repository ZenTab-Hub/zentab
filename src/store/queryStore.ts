import { create } from 'zustand'
import { SavedQuery, QueryHistory } from '@/types'

interface QueryState {
  savedQueries: SavedQuery[]
  queryHistory: QueryHistory[]
  currentQuery: string
  currentQueryOptions: any

  // Actions
  setSavedQueries: (queries: SavedQuery[]) => void
  addSavedQuery: (query: SavedQuery) => void
  updateSavedQuery: (id: string, query: Partial<SavedQuery>) => void
  deleteSavedQuery: (id: string) => void
  setQueryHistory: (history: QueryHistory[]) => void
  addToHistory: (query: QueryHistory) => void
  setCurrentQuery: (query: string) => void
  setCurrentQueryOptions: (options: any) => void
}

export const useQueryStore = create<QueryState>((set) => ({
  savedQueries: [],
  queryHistory: [],
  currentQuery: '{}',
  currentQueryOptions: {},

  setSavedQueries: (queries) => set({ savedQueries: queries }),

  addSavedQuery: (query) =>
    set((state) => ({
      savedQueries: [...state.savedQueries, query],
    })),

  updateSavedQuery: (id, updates) =>
    set((state) => ({
      savedQueries: state.savedQueries.map((q) =>
        q.id === id ? { ...q, ...updates, updatedAt: new Date() } : q
      ),
    })),

  deleteSavedQuery: (id) =>
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    })),

  setQueryHistory: (history) => set({ queryHistory: history }),

  addToHistory: (query) =>
    set((state) => ({
      queryHistory: [query, ...state.queryHistory].slice(0, 100), // Keep last 100
    })),

  setCurrentQuery: (query) => set({ currentQuery: query }),

  setCurrentQueryOptions: (options) => set({ currentQueryOptions: options }),
}))

