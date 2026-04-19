import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

// ── Stub setTimeout so sleep() resolves instantly ────────────────────────────
vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 })

import { postInstagram } from '@/lib/post-instagram'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVariant(
  overrides?: Partial<{
    caption: string | null
    hashtags: string[] | null
    media_url: string | null
  }>,
) {
  return {
    caption: 'Amazing reel caption',
    hashtags: ['#reels', '#viral'],
    media_url: 'https://example.com/video.mp4',
    ...overrides,
  }
}

/** Make a mock Response-like object. */
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('postInstagram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'acct-123'
    mockGetToken.mockResolvedValue('ig-access-token')
  })

  afterEach(() => {
    delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('creates container, polls until FINISHED, publishes, returns mediaId', async () => {
      // 1. Container creation
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'container-abc' }))
        // 2. First poll — IN_PROGRESS
        .mockResolvedValueOnce(mockResponse({ status_code: 'IN_PROGRESS' }))
        // 3. Second poll — FINISHED
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        // 4. Publish
        .mockResolvedValueOnce(mockResponse({ id: 'media-xyz-789' }))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({ success: true, mediaId: 'media-xyz-789' })
    })

    it('calls getToken with "instagram"', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'container-1' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(mockResponse({ id: 'media-1' }))

      await postInstagram(makeVariant())

      expect(mockGetToken).toHaveBeenCalledWith('instagram')
    })

    it('sends correct body to reels endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'container-2' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(mockResponse({ id: 'media-2' }))

      await postInstagram(
        makeVariant({
          caption: 'Hello world',
          hashtags: ['#one', '#two'],
          media_url: 'https://cdn.example.com/clip.mp4',
        }),
      )

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://graph.facebook.com/v21.0/acct-123/reels')
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body as string) as {
        video_url: string
        caption: string
        access_token: string
      }
      expect(body.video_url).toBe('https://cdn.example.com/clip.mp4')
      expect(body.caption).toBe('Hello world\n\n#one #two')
      expect(body.access_token).toBe('ig-access-token')
    })

    it('builds caption correctly when hashtags are empty', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'c3' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(mockResponse({ id: 'm3' }))

      await postInstagram(makeVariant({ caption: 'Just caption', hashtags: [] }))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        caption: string
      }
      expect(body.caption).toBe('Just caption')
    })

    it('handles null caption and null hashtags gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'c4' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(mockResponse({ id: 'm4' }))

      const result = await postInstagram(
        makeVariant({ caption: null, hashtags: null }),
      )

      expect(result).toEqual({ success: true, mediaId: 'm4' })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        caption: string
      }
      expect(body.caption).toBe('')
    })

    it('sends correct body to media_publish endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'container-pub' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(mockResponse({ id: 'final-media' }))

      await postInstagram(makeVariant())

      const [publishUrl, publishOptions] = mockFetch.mock.calls[2] as [
        string,
        RequestInit,
      ]
      expect(publishUrl).toBe(
        'https://graph.facebook.com/v21.0/acct-123/media_publish',
      )
      const publishBody = JSON.parse(publishOptions.body as string) as {
        creation_id: string
        access_token: string
      }
      expect(publishBody.creation_id).toBe('container-pub')
      expect(publishBody.access_token).toBe('ig-access-token')
    })
  })

  // ── Missing env var ───────────────────────────────────────────────────────

  describe('missing INSTAGRAM_BUSINESS_ACCOUNT_ID', () => {
    it('returns success: false when account id env var is not set', async () => {
      delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'INSTAGRAM_BUSINESS_ACCOUNT_ID not set',
      })
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockGetToken).not.toHaveBeenCalled()
    })
  })

  // ── Timeout ───────────────────────────────────────────────────────────────

  describe('polling timeout', () => {
    it('returns success: false with timeout error when poll never finishes', async () => {
      // Container creation succeeds
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'container-timeout' }))

      // All 12 poll responses are IN_PROGRESS
      for (let i = 0; i < 12; i++) {
        mockFetch.mockResolvedValueOnce(
          mockResponse({ status_code: 'IN_PROGRESS' }),
        )
      }

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Instagram media processing timed out',
      })
    })

    it('exhausts exactly MAX_POLLS poll calls before timing out', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'c-exhaust' }))
      for (let i = 0; i < 12; i++) {
        mockFetch.mockResolvedValueOnce(
          mockResponse({ status_code: 'IN_PROGRESS' }),
        )
      }

      await postInstagram(makeVariant())

      // 1 container call + 12 poll calls = 13 total
      expect(mockFetch).toHaveBeenCalledTimes(13)
    })
  })

  // ── API error on container creation ──────────────────────────────────────

  describe('API error on container creation', () => {
    it('returns success: false with error from API body', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(
          { error: { message: 'Invalid video format' } },
          false,
          400,
        ),
      )

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Invalid video format',
      })
    })

    it('returns success: false with HTTP status fallback when no error body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, false, 500))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Instagram container creation failed: HTTP 500',
      })
    })

    it('returns success: false when container response has no id', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ some: 'unexpected' }))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Instagram container creation failed: HTTP 200',
      })
    })
  })

  // ── Terminal status codes during polling ──────────────────────────────────

  describe('terminal status codes during polling', () => {
    it('returns success: false on ERROR status_code', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'c-err' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'ERROR' }))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Instagram media processing failed with status: ERROR',
      })
    })

    it('returns success: false on EXPIRED status_code', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'c-exp' }))
        .mockResolvedValueOnce(mockResponse({ status_code: 'EXPIRED' }))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'Instagram media processing failed with status: EXPIRED',
      })
    })
  })

  // ── Network / unexpected errors ───────────────────────────────────────────

  describe('network / unexpected errors', () => {
    it('returns success: false on fetch network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'))

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'fetch failed: ECONNREFUSED',
      })
    })

    it('returns success: false when getToken throws', async () => {
      mockGetToken.mockRejectedValueOnce(
        new Error('No token for instagram and INSTAGRAM_ACCESS_TOKEN env var not set'),
      )

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'No token for instagram and INSTAGRAM_ACCESS_TOKEN env var not set',
      })
    })

    it('handles non-Error thrown objects', async () => {
      mockFetch.mockRejectedValueOnce('network string error')

      const result = await postInstagram(makeVariant())

      expect(result).toEqual({
        success: false,
        error: 'network string error',
      })
    })
  })
})
