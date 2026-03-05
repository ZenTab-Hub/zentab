import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Re-implement the validated helper for testing (since electron imports don't work in renderer tests)
function validated<T extends z.ZodTuple>(
  schema: T,
  handler: (event: any, ...args: z.infer<T>) => Promise<any>
) {
  return async (event: any, ...args: unknown[]) => {
    const result = schema.safeParse(args)
    if (!result.success) {
      const msg = result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ')
      return { success: false, error: `Invalid input: ${msg}` }
    }
    return handler(event, ...result.data)
  }
}

describe('IPC validation helper', () => {
  const schema = z.tuple([
    z.string().min(1, 'connectionId is required'),
    z.string().min(1, 'database is required'),
  ])

  const mockHandler = validated(schema, async (_event, connectionId, database) => {
    return { success: true, connectionId, database }
  })

  it('passes valid args through to handler', async () => {
    const result = await mockHandler({}, 'conn-1', 'mydb')
    expect(result).toEqual({ success: true, connectionId: 'conn-1', database: 'mydb' })
  })

  it('rejects empty connectionId', async () => {
    const result = await mockHandler({}, '', 'mydb')
    expect(result.success).toBe(false)
    expect(result.error).toContain('connectionId is required')
  })

  it('rejects missing database', async () => {
    const result = await mockHandler({}, 'conn-1', '')
    expect(result.success).toBe(false)
    expect(result.error).toContain('database is required')
  })

  it('rejects wrong type args', async () => {
    const result = await mockHandler({}, 123, 'mydb')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid input')
  })

  it('rejects missing args', async () => {
    const result = await mockHandler({})
    expect(result.success).toBe(false)
  })

  it('validates complex schemas', async () => {
    const complexSchema = z.tuple([
      z.string(),
      z.record(z.unknown()).default({}),
      z.number().optional(),
    ])
    const handler = validated(complexSchema, async (_event, id, filter, limit) => {
      return { success: true, id, filter, limit }
    })

    const result = await handler({}, 'test', { name: 'John' }, 10)
    expect(result).toEqual({ success: true, id: 'test', filter: { name: 'John' }, limit: 10 })
  })
})
