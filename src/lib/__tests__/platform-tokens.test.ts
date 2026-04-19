import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock factory ─────────────────────────────────────────────────────

type MockRow = {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
} | null

let mockRow: MockRow = null
let upsertError: { message: string } | null = null

const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockUpsert = vi.fn()

function buildSupabaseMock() {
  mockUpsert.mockResolvedValue({ error: upsertError })
  mockSingle.mockResolvedValue({ data: mockRow, error: null })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })

  return {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => buildSupabaseMock()),
}))

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Import after mocks are set up ─────────────────────────────────────────────

import { getToken, saveToken } from '@/lib/platform-tokens'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('platform-tokens', () => {
  beforeEach(() => {
    mockRow = null
    upsertError = null
    vi.clearAllMocks()
    // Reset env vars
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    delete process.env.TIKTOK_ACCESS_TOKEN
    delete process.env.X_ACCESS_TOKEN
    delete process.env.INSTAGRAM_APP_ID
    delete process.env.INSTAGRAM_APP_SECRET
    delete process.env.TIKTOK_CLIENT_KEY
    delete process.env.TIKTOK_CLIENT_SECRET
  })

  // ── getToken: seed from env ─────────────────────────────────────────────────

  describe('getToken — seeds from env if no DB row', () => {
    it('returns the env var token and calls saveToken for instagram', async () => {
      mockRow = null
      process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-token-from-env'

      const token = await getToken('instagram')

      expect(token).toBe('ig-token-from-env')
      // upsert must have been called to persist the seed
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'instagram', access_token: 'ig-token-from-env' }),
        expect.objectContaining({ onConflict: 'platform' }),
      )
    })

    it('returns the env var token for tiktok', async () => {
      mockRow = null
      process.env.TIKTOK_ACCESS_TOKEN = 'tt-token-from-env'

      const token = await getToken('tiktok')
      expect(token).toBe('tt-token-from-env')
    })

    it('returns the env var token for x', async () => {
      mockRow = null
      process.env.X_ACCESS_TOKEN = 'x-token-from-env'

      const token = await getToken('x')
      expect(token).toBe('x-token-from-env')
    })

    it('throws a descriptive error when no DB row and env var not set', async () => {
      mockRow = null
      // INSTAGRAM_ACCESS_TOKEN is NOT set

      await expect(getToken('instagram')).rejects.toThrow(
        'No token for instagram and INSTAGRAM_ACCESS_TOKEN env var not set',
      )
    })
  })

  // ── getToken: returns from DB when row exists and not expiring ───────────────

  describe('getToken — returns DB token when not expiring', () => {
    it('returns access_token from DB row with no expiry', async () => {
      mockRow = {
        access_token: 'ig-db-token',
        refresh_token: null,
        expires_at: null,
      }

      const token = await getToken('instagram')
      expect(token).toBe('ig-db-token')
      // Should NOT have called fetch (no refresh)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns access_token from DB row when expiry is far in the future', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days
      mockRow = {
        access_token: 'ig-db-token-fresh',
        refresh_token: null,
        expires_at: farFuture,
      }

      const token = await getToken('instagram')
      expect(token).toBe('ig-db-token-fresh')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns x token from DB without triggering refresh even with near expiry', async () => {
      const nearExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // +3 days
      mockRow = {
        access_token: 'x-db-token',
        refresh_token: null,
        expires_at: nearExpiry,
      }

      // X tokens never expire — just returns the existing token
      const token = await getToken('x')
      expect(token).toBe('x-db-token')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ── getToken: triggers refresh when expiring soon ───────────────────────────

  describe('getToken — triggers refresh when expires_at within 7 days', () => {
    it('calls Instagram Graph API and returns refreshed token', async () => {
      const soonExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // +2 days
      mockRow = {
        access_token: 'ig-old-token',
        refresh_token: null,
        expires_at: soonExpiry,
      }

      process.env.INSTAGRAM_APP_ID = 'test-app-id'
      process.env.INSTAGRAM_APP_SECRET = 'test-app-secret'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'ig-refreshed-token' }),
      })

      const token = await getToken('instagram')
      expect(token).toBe('ig-refreshed-token')

      // Verify the correct endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com/v21.0/oauth/access_token'),
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('grant_type=fb_exchange_token'),
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('client_id=test-app-id'),
      )
    })

    it('calls TikTok OAuth endpoint and returns refreshed token', async () => {
      const soonExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // +1 hour
      mockRow = {
        access_token: 'tt-old-token',
        refresh_token: 'tt-refresh-token',
        expires_at: soonExpiry,
      }

      process.env.TIKTOK_CLIENT_KEY = 'test-client-key'
      process.env.TIKTOK_CLIENT_SECRET = 'test-client-secret'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { access_token: 'tt-refreshed-token', refresh_token: 'tt-new-refresh' },
        }),
      })

      const token = await getToken('tiktok')
      expect(token).toBe('tt-refreshed-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/oauth/token/',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws when Instagram refresh API returns no access_token', async () => {
      const soonExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      mockRow = {
        access_token: 'ig-old-token',
        refresh_token: null,
        expires_at: soonExpiry,
      }

      process.env.INSTAGRAM_APP_ID = 'test-app-id'
      process.env.INSTAGRAM_APP_SECRET = 'test-app-secret'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // no access_token
      })

      await expect(getToken('instagram')).rejects.toThrow(
        'Instagram token refresh failed: no access_token in response',
      )
    })

    it('throws when Instagram env vars for refresh are missing', async () => {
      const soonExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      mockRow = {
        access_token: 'ig-old-token',
        refresh_token: null,
        expires_at: soonExpiry,
      }
      // INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not set

      await expect(getToken('instagram')).rejects.toThrow(
        'INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET not set',
      )
    })
  })

  // ── saveToken ────────────────────────────────────────────────────────────────

  describe('saveToken', () => {
    it('upserts platform, access_token with no optional fields', async () => {
      await saveToken('x', 'x-access-token')

      expect(mockUpsert).toHaveBeenCalledWith(
        {
          platform: 'x',
          access_token: 'x-access-token',
          refresh_token: null,
          expires_at: null,
        },
        { onConflict: 'platform' },
      )
    })

    it('upserts with refreshToken and expiresAt when provided', async () => {
      const expiry = new Date('2026-06-01T00:00:00.000Z')
      await saveToken('tiktok', 'tt-token', 'tt-refresh', expiry)

      expect(mockUpsert).toHaveBeenCalledWith(
        {
          platform: 'tiktok',
          access_token: 'tt-token',
          refresh_token: 'tt-refresh',
          expires_at: expiry.toISOString(),
        },
        { onConflict: 'platform' },
      )
    })

    it('throws when supabase returns an error', async () => {
      upsertError = { message: 'unique constraint violation' }

      await expect(saveToken('instagram', 'bad-token')).rejects.toThrow(
        'Failed to save token for instagram',
      )
    })
  })
})
