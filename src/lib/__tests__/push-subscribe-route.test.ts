import { describe, it, expect } from 'vitest'

// Validation helpers mirroring the subscribe route logic
function validateSubscribeBody(
  body: unknown,
): { endpoint: string; p256dh: string; auth: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid body' }
  const { endpoint, p256dh, auth } = body as Record<string, unknown>
  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '')
    return { error: 'endpoint is required' }
  if (!p256dh || typeof p256dh !== 'string' || p256dh.trim() === '')
    return { error: 'p256dh is required' }
  if (!auth || typeof auth !== 'string' || auth.trim() === '')
    return { error: 'auth is required' }
  return { endpoint, p256dh, auth }
}

function validateDeleteBody(body: unknown): { endpoint: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid body' }
  const { endpoint } = body as Record<string, unknown>
  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '')
    return { error: 'endpoint is required' }
  return { endpoint }
}

describe('push subscribe route validation', () => {
  // POST tests
  it('POST — accepts valid subscription fields', () => {
    const result = validateSubscribeBody({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    })
    expect(result).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    })
  })

  it('POST — missing endpoint returns error shape', () => {
    const result = validateSubscribeBody({
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/endpoint/)
  })

  it('POST — missing p256dh returns error shape', () => {
    const result = validateSubscribeBody({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/p256dh/)
  })

  it('POST — empty string endpoint treated as invalid', () => {
    const result = validateSubscribeBody({
      endpoint: '   ',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/endpoint/)
  })

  // DELETE tests
  it('DELETE — valid endpoint accepted', () => {
    const result = validateDeleteBody({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    })
    expect(result).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    })
  })

  it('DELETE — missing endpoint returns error shape', () => {
    const result = validateDeleteBody({})
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/endpoint/)
  })
})
