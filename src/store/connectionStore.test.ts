import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './connectionStore'
import type { DatabaseConnection } from '@/types'

const mockConnection = (overrides?: Partial<DatabaseConnection>): DatabaseConnection => ({
  id: 'test-1',
  name: 'Test Connection',
  type: 'mongodb',
  connectionString: 'mongodb://localhost:27017',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [],
      activeConnectionId: null,
      connectionStatuses: {},
      selectedDatabase: null,
      selectedCollection: null,
      cachedDatabases: [],
      cachedCollections: {},
    })
  })

  describe('setConnections', () => {
    it('replaces entire connections list', () => {
      const conns = [mockConnection(), mockConnection({ id: 'test-2', name: 'Second' })]
      useConnectionStore.getState().setConnections(conns)
      expect(useConnectionStore.getState().connections).toHaveLength(2)
    })
  })

  describe('addConnection', () => {
    it('adds a connection to the list', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      expect(useConnectionStore.getState().connections).toHaveLength(1)
      expect(useConnectionStore.getState().connections[0].name).toBe('Test Connection')
    })

    it('appends without removing existing', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().addConnection(mockConnection({ id: 'test-2' }))
      expect(useConnectionStore.getState().connections).toHaveLength(2)
    })
  })

  describe('updateConnection', () => {
    it('updates matching connection fields', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().updateConnection('test-1', { name: 'Updated Name' })
      expect(useConnectionStore.getState().connections[0].name).toBe('Updated Name')
    })

    it('does not affect other connections', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().addConnection(mockConnection({ id: 'test-2', name: 'Second' }))
      useConnectionStore.getState().updateConnection('test-1', { name: 'Changed' })
      expect(useConnectionStore.getState().connections[1].name).toBe('Second')
    })

    it('sets updatedAt on update', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      const before = useConnectionStore.getState().connections[0].updatedAt
      useConnectionStore.getState().updateConnection('test-1', { name: 'Changed' })
      const after = useConnectionStore.getState().connections[0].updatedAt
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })
  })

  describe('deleteConnection', () => {
    it('removes the connection by id', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().deleteConnection('test-1')
      expect(useConnectionStore.getState().connections).toHaveLength(0)
    })

    it('clears activeConnectionId if deleted connection was active', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().setActiveConnection('test-1')
      useConnectionStore.getState().deleteConnection('test-1')
      expect(useConnectionStore.getState().activeConnectionId).toBeNull()
    })

    it('keeps activeConnectionId if different connection deleted', () => {
      useConnectionStore.getState().addConnection(mockConnection())
      useConnectionStore.getState().addConnection(mockConnection({ id: 'test-2' }))
      useConnectionStore.getState().setActiveConnection('test-1')
      useConnectionStore.getState().deleteConnection('test-2')
      expect(useConnectionStore.getState().activeConnectionId).toBe('test-1')
    })
  })

  describe('setActiveConnection', () => {
    it('sets activeConnectionId', () => {
      useConnectionStore.getState().setActiveConnection('test-1')
      expect(useConnectionStore.getState().activeConnectionId).toBe('test-1')
    })

    it('clears selectedDatabase and selectedCollection', () => {
      useConnectionStore.setState({ selectedDatabase: 'mydb', selectedCollection: 'users' })
      useConnectionStore.getState().setActiveConnection('test-1')
      expect(useConnectionStore.getState().selectedDatabase).toBeNull()
      expect(useConnectionStore.getState().selectedCollection).toBeNull()
    })

    it('clears cache on connection change', () => {
      useConnectionStore.setState({
        cachedDatabases: [{ name: 'db1' }],
        cachedCollections: { db1: [{ name: 'coll1' }] },
      })
      useConnectionStore.getState().setActiveConnection('test-2')
      expect(useConnectionStore.getState().cachedDatabases).toEqual([])
      expect(useConnectionStore.getState().cachedCollections).toEqual({})
    })
  })

  describe('setConnectionStatus', () => {
    it('sets status for connection', () => {
      const status = { connectionId: 'test-1', isConnected: true }
      useConnectionStore.getState().setConnectionStatus('test-1', status)
      expect(useConnectionStore.getState().connectionStatuses['test-1']).toEqual(status)
    })

    it('does not update state if same status reference', () => {
      const status = { connectionId: 'test-1', isConnected: true }
      useConnectionStore.getState().setConnectionStatus('test-1', status)
      // Same reference - should be no-op (optimization)
      const stateBefore = useConnectionStore.getState()
      useConnectionStore.getState().setConnectionStatus('test-1', status)
      expect(useConnectionStore.getState()).toBe(stateBefore)
    })
  })

  describe('setSelectedDatabase', () => {
    it('sets database and clears collection', () => {
      useConnectionStore.setState({ selectedCollection: 'users' })
      useConnectionStore.getState().setSelectedDatabase('mydb')
      expect(useConnectionStore.getState().selectedDatabase).toBe('mydb')
      expect(useConnectionStore.getState().selectedCollection).toBeNull()
    })
  })

  describe('getActiveConnection', () => {
    it('returns null when no active connection', () => {
      expect(useConnectionStore.getState().getActiveConnection()).toBeNull()
    })

    it('returns the active connection', () => {
      const conn = mockConnection()
      useConnectionStore.getState().addConnection(conn)
      useConnectionStore.getState().setActiveConnection('test-1')
      expect(useConnectionStore.getState().getActiveConnection()?.id).toBe('test-1')
    })
  })

  describe('cache management', () => {
    it('setCachedDatabases stores databases', () => {
      useConnectionStore.getState().setCachedDatabases([{ name: 'db1' }, { name: 'db2' }])
      expect(useConnectionStore.getState().cachedDatabases).toHaveLength(2)
    })

    it('setCachedCollections stores per-database collections', () => {
      useConnectionStore.getState().setCachedCollections('mydb', [{ name: 'users' }])
      expect(useConnectionStore.getState().cachedCollections['mydb']).toHaveLength(1)
    })

    it('clearCache resets all cache', () => {
      useConnectionStore.getState().setCachedDatabases([{ name: 'db1' }])
      useConnectionStore.getState().setCachedCollections('db1', [{ name: 'c1' }])
      useConnectionStore.getState().clearCache()
      expect(useConnectionStore.getState().cachedDatabases).toEqual([])
      expect(useConnectionStore.getState().cachedCollections).toEqual({})
    })
  })
})
