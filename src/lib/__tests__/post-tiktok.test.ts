import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock getToken (hoisted so vi.mock factory can reference it) ───────────────

const { mockGetToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn<() => Promise<string>>(),
}))

vi.mock('@/lib/platform-tokens', () => ({
  getToken: mockGetToken,
}))

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Import after mocks ────────────────────────────────────────────────────────

import { postTikTok } from '@/lib/post-tiktok'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVariant(overrides?: Partial<{ caption: string | null; hashtags: string[] | null; media_url: string | null }>) {
  return {
    caption: 'My great video',
    hashtags: ['#trending', '#fyp'],
    media_url: 'https://example.com/video.mp4',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('postTikTok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: env var is set
    process.env.TIKTOK_ACCESS_TOKEN = 'tt-env-token'
    mockGetToken.mockResolvedValue('tt-access-token')
  })

  afterEach(() => {
    delete process.env.TIKTOK_ACCESS_TOKEN
  })

  // ── Happy path ───────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns success: true with videoId on a valid API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { publish_id: 'tiktok-video-123' },
        }),
      })

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({ success: true, videoId: 'tiktok-video-123' })
    })

    it('calls getToken with "tiktok"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'vid-456' } }),
      })

      await postTikTok(makeVariant())

      expect(mockGetToken).toHaveBeenCalledWith('tiktok')
    })

    it('sends correct Authorization header and JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'vid-789' } }),
      })

      await postTikTok(makeVariant({
        caption: 'Hello world',
        hashtags: ['#test'],
        media_url: 'https://cdn.example.com/clip.mp4',
      }))

      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer tt-access-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            post_info: {
              title: 'Hello world #test',
              privacy_level: 'PUBLIC_TO_EVERYONE',
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: 'https://cdn.example.com/clip.mp4',
            },
          }),
        }),
      )
    })

    it('trims caption when hashtags are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'vid-trim' } }),
      })

      await postTikTok(makeVariant({ caption: 'Just a caption', hashtags: [] }))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        post_info: { title: string }
      }
      expect(body.post_info.title).toBe('Just a caption')
    })

    it('handles null caption and null hashtags gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'vid-null' } }),
      })

      const result = await postTikTok(makeVariant({ caption: null, hashtags: null }))

      expect(result).toEqual({ success: true, videoId: 'vid-null' })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        post_info: { title: string }
      }
      expect(body.post_info.title).toBe('')
    })
  })

  // ── No TIKTOK_ACCESS_TOKEN ────────────────────────────────────────────────────

  describe('no TIKTOK_ACCESS_TOKEN env var', () => {
    it('returns skipped: true without calling fetch or getToken', async () => {
      delete process.env.TIKTOK_ACCESS_TOKEN

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'TikTok not configured',
        skipped: true,
      })
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockGetToken).not.toHaveBeenCalled()
    })
  })

  // ── API error responses ──────────────────────────────────────────────────────

  describe('API error responses', () => {
    it('returns success: false with skipped: true for access_token.invalid error code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'access_token.invalid',
            message: 'Access token is invalid or expired.',
          },
        }),
      })

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Access token is invalid or expired.',
        skipped: true,
      })
    })

    it('returns success: false with skipped: true for spam_risk_too_many_posts error code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 'spam_risk_too_many_posts',
            message: 'Too many posts in a short period.',
          },
        }),
      })

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Too many posts in a short period.',
        skipped: true,
      })
    })

    it('returns success: false with skipped: true for any other 4xx error with error body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'permission_denied',
            message: 'App not approved for Content Posting API.',
          },
        }),
      })

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'App not approved for Content Posting API.',
        skipped: true,
      })
    })

    it('returns success: false with skipped: true for 4xx with no error message but not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ data: {} }),
      })

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'TikTok API error 400',
        skipped: true,
      })
    })
  })

  // ── Network errors ────────────────────────────────────────────────────────────

  describe('network / unexpected errors', () => {
    it('returns success: false (without skipped) on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'))

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'fetch failed: ECONNREFUSED',
      })
      // skipped should NOT be set
      expect((result as { skipped?: boolean }).skipped).toBeUndefined()
    })

    it('returns success: false when getToken throws', async () => {
      mockGetToken.mockRejectedValueOnce(new Error('Cannot refresh TikTok token: no refresh_token found in DB'))

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Cannot refresh TikTok token: no refresh_token found in DB',
      })
    })

    it('handles non-Error thrown objects', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      const result = await postTikTok(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'string error',
      })
    })
  })
})
