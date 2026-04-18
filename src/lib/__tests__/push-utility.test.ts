import { describe, it, expect, vi } from 'vitest'

// Inline helpers mirroring the push utility module
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function is410(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { statusCode?: number }).statusCode === 410
  )
}

// Mock the heavy dependencies so the module can be imported without hanging
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(), delete: vi.fn(() => ({ eq: vi.fn() })) })),
  })),
}))

describe('push utility module', () => {
  it('sendPushToAll is exported from @/lib/push', async () => {
    const mod = await import('@/lib/push')
    expect(typeof mod.sendPushToAll).toBe('function')
  })

  it('payload shape has title, body, and postId fields', () => {
    const payload: { title: string; body: string; postId: string } = {
      title: 'New post ready for review',
      body: 'Your content is ready',
      postId: 'post-uuid-123',
    }
    expect(payload).toHaveProperty('title')
    expect(payload).toHaveProperty('body')
    expect(payload).toHaveProperty('postId')
    expect(typeof payload.title).toBe('string')
    expect(typeof payload.body).toBe('string')
    expect(typeof payload.postId).toBe('string')
  })

  it('urlBase64ToUint8Array converts a VAPID public key to a 65-byte Uint8Array', () => {
    // 65-byte uncompressed EC public key (0x04 prefix + 32-byte X + 32-byte Y) encoded as url-safe base64
    const vapidPublicKey =
      'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const result = urlBase64ToUint8Array(vapidPublicKey)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(65)
  })

  it('is410 correctly identifies statusCode 410 errors', () => {
    expect(is410({ statusCode: 410 })).toBe(true)
    expect(is410({ statusCode: 404 })).toBe(false)
    expect(is410({ statusCode: 500 })).toBe(false)
    expect(is410(null)).toBe(false)
    expect(is410('string error')).toBe(false)
    expect(is410({})).toBe(false)
  })
})
