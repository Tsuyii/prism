import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoist mocks so vi.mock factories can reference them ──────────────────────

const {
  mockPostInstagram,
  mockPostX,
  mockPostTikTok,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  // Build a chainable Supabase query builder mock
  const makeQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    const chain = () => builder

    builder.select = vi.fn().mockReturnValue(builder)
    builder.eq = vi.fn().mockReturnValue(builder)
    builder.or = vi.fn().mockReturnValue(builder)
    builder.update = vi.fn().mockReturnValue(builder)
    // Default: returns empty data
    builder.then = undefined

    // Make it thenable so `await supabase.from(...).select(...).eq(...)` works
    // We override per-test with .mockResolvedValueOnce on the last call in chain
    return builder
  }

  const mockFrom = vi.fn()
  const mockCreateServiceClient = vi.fn(() => ({
    from: mockFrom,
  }))

  return {
    mockPostInstagram: vi.fn(),
    mockPostX: vi.fn(),
    mockPostTikTok: vi.fn(),
    mockFrom,
    mockCreateServiceClient,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock('@/lib/post-instagram', () => ({
  postInstagram: mockPostInstagram,
}))

vi.mock('@/lib/post-x', () => ({
  postX: mockPostX,
}))

vi.mock('@/lib/post-tiktok', () => ({
  postTikTok: mockPostTikTok,
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET } from '../route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['authorization'] = authHeader
  }
  return new NextRequest('http://localhost/api/cron/post', { headers })
}

/** Build a chainable mock that ultimately resolves with `value`. */
function makeChain(value: unknown) {
  const self: Record<string, unknown> = {}
  self.select = vi.fn().mockReturnValue(self)
  self.eq = vi.fn().mockReturnValue(self)
  self.or = vi.fn().mockReturnValue(self)
  self.update = vi.fn().mockReturnValue(self)
  // Make it a thenable (Promise-like) so `await` resolves to `value`
  self.then = (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve)
  self.catch = (reject: (e: unknown) => unknown) => Promise.resolve(value).catch(reject)
  return self
}

type Post = {
  id: string
  status: string
  type: string
  drive_url: string
  scheduled_at: string | null
  created_at: string | null
}

type PostVariant = {
  id: string
  post_id: string
  platform: string
  caption: string | null
  hashtags: string[] | null
  media_url: string | null
  approved: boolean | null
}

function makePost(overrides?: Partial<Post>): Post {
  return {
    id: 'post-1',
    status: 'approved',
    type: 'reel',
    drive_url: 'https://drive.google.com/file/abc',
    scheduled_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeVariant(overrides?: Partial<PostVariant>): PostVariant {
  return {
    id: 'variant-1',
    post_id: 'post-1',
    platform: 'instagram',
    caption: 'Test caption',
    hashtags: ['#test'],
    media_url: 'https://cdn.example.com/video.mp4',
    approved: true,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/cron/post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe('authorization', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = makeRequest()
      const res = await GET(req)
      expect(res.status).toBe(401)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 when Authorization header has wrong secret', async () => {
      const req = makeRequest('Bearer wrong-secret')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })

    it('returns 401 when CRON_SECRET env var is not set', async () => {
      delete process.env.CRON_SECRET
      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })
  })

  // ── No due posts ──────────────────────────────────────────────────────────

  describe('no due posts', () => {
    it('returns { processed: 0, published: 0, failed: 0 } when no posts are due', async () => {
      // posts query returns empty array
      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return makeChain({ data: [], error: null })
        }
        return makeChain({ data: [], error: null })
      })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      expect(body).toEqual({ processed: 0, published: 0, failed: 0 })
    })
  })

  // ── All platforms succeed ─────────────────────────────────────────────────

  describe('all platforms succeed', () => {
    it('marks post as published when instagram, x, and tiktok all succeed', async () => {
      const post = makePost()
      const igVariant = makeVariant({ platform: 'instagram' })
      const xVariant = makeVariant({ id: 'variant-2', platform: 'x_thread' })
      const ttVariant = makeVariant({ id: 'variant-3', platform: 'tiktok' })

      let updateChain: ReturnType<typeof makeChain>

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          // First call: select approved posts
          // Subsequent calls: update status
          const callCount = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'posts').length
          if (callCount === 1) {
            return makeChain({ data: [post], error: null })
          }
          // update chain
          updateChain = makeChain({ error: null })
          return updateChain
        }
        // post_variants
        return makeChain({ data: [igVariant, xVariant, ttVariant], error: null })
      })

      mockPostInstagram.mockResolvedValue({ success: true, mediaId: 'ig-123' })
      mockPostX.mockResolvedValue({ success: true, tweetId: 'x-123' })
      mockPostTikTok.mockResolvedValue({ success: true, videoId: 'tt-123' })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      expect(body).toEqual({ processed: 1, published: 1, failed: 0 })
    })
  })

  // ── TikTok skipped, others succeed → published ────────────────────────────

  describe('tiktok skipped but instagram and x succeed', () => {
    it('marks post as published when tiktok returns skipped: true', async () => {
      const post = makePost()
      const igVariant = makeVariant({ platform: 'instagram' })
      const xVariant = makeVariant({ id: 'variant-2', platform: 'x_thread' })
      const ttVariant = makeVariant({ id: 'variant-3', platform: 'tiktok' })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          const callCount = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'posts').length
          if (callCount === 1) {
            return makeChain({ data: [post], error: null })
          }
          return makeChain({ error: null })
        }
        return makeChain({ data: [igVariant, xVariant, ttVariant], error: null })
      })

      mockPostInstagram.mockResolvedValue({ success: true, mediaId: 'ig-abc' })
      mockPostX.mockResolvedValue({ success: true, tweetId: 'x-abc' })
      mockPostTikTok.mockResolvedValue({ success: false, error: 'TikTok not configured', skipped: true })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      expect(body).toEqual({ processed: 1, published: 1, failed: 0 })
    })

    it('marks post as published when there is no tiktok variant at all', async () => {
      const post = makePost()
      const igVariant = makeVariant({ platform: 'instagram' })
      const xVariant = makeVariant({ id: 'variant-2', platform: 'x_thread' })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          const callCount = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'posts').length
          if (callCount === 1) {
            return makeChain({ data: [post], error: null })
          }
          return makeChain({ error: null })
        }
        // No tiktok variant
        return makeChain({ data: [igVariant, xVariant], error: null })
      })

      mockPostInstagram.mockResolvedValue({ success: true, mediaId: 'ig-xyz' })
      mockPostX.mockResolvedValue({ success: true, tweetId: 'x-xyz' })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      // TikTok skipped silently → still published
      expect(body).toEqual({ processed: 1, published: 1, failed: 0 })
      // postTikTok should NOT have been called (no variant)
      expect(mockPostTikTok).not.toHaveBeenCalled()
    })
  })

  // ── Instagram fails → failed ──────────────────────────────────────────────

  describe('instagram fails', () => {
    it('marks post as failed when instagram returns success: false without skipped', async () => {
      const post = makePost()
      const igVariant = makeVariant({ platform: 'instagram' })
      const xVariant = makeVariant({ id: 'variant-2', platform: 'x_thread' })
      const ttVariant = makeVariant({ id: 'variant-3', platform: 'tiktok' })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          const callCount = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'posts').length
          if (callCount === 1) {
            return makeChain({ data: [post], error: null })
          }
          return makeChain({ error: null })
        }
        return makeChain({ data: [igVariant, xVariant, ttVariant], error: null })
      })

      mockPostInstagram.mockResolvedValue({ success: false, error: 'Instagram container creation failed: HTTP 500' })
      mockPostX.mockResolvedValue({ success: true, tweetId: 'x-ok' })
      mockPostTikTok.mockResolvedValue({ success: true, videoId: 'tt-ok' })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      expect(body).toEqual({ processed: 1, published: 0, failed: 1 })
    })
  })

  // ── X falls back to x_video when x_thread is absent ─────────────────────

  describe('x platform fallback', () => {
    it('uses x_video variant when x_thread is not present', async () => {
      const post = makePost()
      const igVariant = makeVariant({ platform: 'instagram' })
      const xVideoVariant = makeVariant({ id: 'variant-v', platform: 'x_video', caption: 'video caption' })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          const callCount = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'posts').length
          if (callCount === 1) {
            return makeChain({ data: [post], error: null })
          }
          return makeChain({ error: null })
        }
        return makeChain({ data: [igVariant, xVideoVariant], error: null })
      })

      mockPostInstagram.mockResolvedValue({ success: true, mediaId: 'ig-1' })
      mockPostX.mockResolvedValue({ success: true, tweetId: 'x-1' })

      const req = makeRequest('Bearer test-secret')
      await GET(req)

      expect(mockPostX).toHaveBeenCalledWith(
        expect.objectContaining({ caption: 'video caption' }),
      )
    })
  })

  // ── Multiple posts ────────────────────────────────────────────────────────

  describe('multiple posts', () => {
    it('processes two posts and reports correct counts', async () => {
      const post1 = makePost({ id: 'post-1' })
      const post2 = makePost({ id: 'post-2' })

      const igVariant1 = makeVariant({ id: 'v-1', post_id: 'post-1', platform: 'instagram' })
      const igVariant2 = makeVariant({ id: 'v-2', post_id: 'post-2', platform: 'instagram' })

      let postQueryCount = 0
      let variantQueryCount = 0

      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          postQueryCount++
          if (postQueryCount === 1) {
            return makeChain({ data: [post1, post2], error: null })
          }
          return makeChain({ error: null })
        }
        // post_variants — return different variant per call
        variantQueryCount++
        const variant = variantQueryCount === 1 ? igVariant1 : igVariant2
        return makeChain({ data: [variant], error: null })
      })

      // post1 instagram succeeds, post2 instagram fails
      mockPostInstagram
        .mockResolvedValueOnce({ success: true, mediaId: 'ig-1' })
        .mockResolvedValueOnce({ success: false, error: 'server error' })

      const req = makeRequest('Bearer test-secret')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json() as { processed: number; published: number; failed: number }
      expect(body).toEqual({ processed: 2, published: 1, failed: 1 })
    })
  })
})
