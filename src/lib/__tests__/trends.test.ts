import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchYouTubeTrends, fetchRedditTrends, scoreTrendsWithClaude, TrendScoringSchema } from '../trends'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@anthropic-ai/sdk', () => {
  let parseMock: ReturnType<typeof vi.fn>
  parseMock = vi.fn().mockResolvedValue({
    parsed_output: {
      scored_topics: [
        { topic: 'CapCut speed ramp tutorial', score: 88, source: 'youtube' },
        { topic: 'My best color grade yet', score: 61, source: 'reddit' },
      ],
      claude_topics: [
        { topic: 'AI b-roll generation for solo creators', score: 93, rationale: 'Underserved gap between AI tools and editing workflow' },
      ],
    },
    stop_reason: 'end_turn',
  })
  class MockAnthropic {
    messages = { parse: parseMock }
  }
  return { default: MockAnthropic }
})

describe('fetchYouTubeTrends', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns RawTrend array from YouTube search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: { videoId: 'abc123' }, snippet: { title: 'CapCut speed ramp tutorial', channelTitle: 'EditPro' } },
          { id: { videoId: 'def456' }, snippet: { title: 'Premiere Pro color grade 2025', channelTitle: 'VideoSchool' } },
        ],
      }),
    })

    const topics = await fetchYouTubeTrends('test-key')
    expect(topics).toHaveLength(2)
    expect(topics[0]).toMatchObject({
      topic: 'CapCut speed ramp tutorial',
      source: 'youtube',
      raw_data: { videoId: 'abc123', channelTitle: 'EditPro' },
    })
  })

  it('returns empty array when API responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    const topics = await fetchYouTubeTrends('bad-key')
    expect(topics).toEqual([])
  })

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'))
    const topics = await fetchYouTubeTrends('any-key')
    expect(topics).toEqual([])
  })
})

describe('fetchRedditTrends', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns RawTrend array from Reddit hot posts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [
            { data: { title: 'My best color grade yet', ups: 420, num_comments: 34, permalink: '/r/videoediting/comments/abc' } },
          ],
        },
      }),
    })

    const topics = await fetchRedditTrends()
    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0]).toMatchObject({
      source: 'reddit',
      raw_data: expect.objectContaining({ ups: expect.any(Number) }),
    })
  })

  it('skips subreddits that return non-ok responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 })
    const topics = await fetchRedditTrends()
    expect(topics).toEqual([])
  })
})

describe('scoreTrendsWithClaude', () => {
  it('returns scored_topics and claude_topics with correct shapes', async () => {
    const raw = [
      { topic: 'CapCut speed ramp tutorial', source: 'youtube' as const, raw_data: { videoId: 'abc123' } },
      { topic: 'My best color grade yet', source: 'reddit' as const, raw_data: { ups: 420 } },
    ]

    const result = await scoreTrendsWithClaude(raw)
    expect(result.scored_topics).toHaveLength(2)
    expect(result.claude_topics).toHaveLength(1)
    expect(result.scored_topics[0].score).toBe(88)
    expect(result.scored_topics[0].raw_data).toMatchObject({ videoId: 'abc123' })
    expect(result.claude_topics[0].source).toBe('claude')
    expect(result.claude_topics[0].raw_data).toMatchObject({ rationale: expect.any(String) })
  })
})

describe('TrendScoringSchema', () => {
  it('validates correctly shaped output', () => {
    const result = TrendScoringSchema.safeParse({
      scored_topics: [{ topic: 'Test', score: 75, source: 'youtube' }],
      claude_topics: [{ topic: 'Gap', score: 90, rationale: 'Underserved' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects score outside 0–100', () => {
    const result = TrendScoringSchema.safeParse({
      scored_topics: [{ topic: 'Test', score: 150, source: 'youtube' }],
      claude_topics: [],
    })
    expect(result.success).toBe(false)
  })
})
