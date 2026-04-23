import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchInstagramMetrics } from '../instagram-metrics'

describe('fetchInstagramMetrics', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns metric rows from media + insights responses', async () => {
    // First call: media list
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'media_1', media_type: 'VIDEO', timestamp: '2026-04-20T12:00:00Z', like_count: 42 },
          { id: 'media_2', media_type: 'IMAGE', timestamp: '2026-04-19T12:00:00Z', like_count: 15 },
        ],
      }),
    })
    // Second call: insights for media_1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: 'plays', total_value: { value: 1200 } },
          { name: 'reach', total_value: { value: 900 } },
          { name: 'impressions', total_value: { value: 1500 } },
          { name: 'saved', total_value: { value: 30 } },
          { name: 'shares', total_value: { value: 10 } },
        ],
      }),
    })
    // Third call: insights for media_2
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: 'impressions', total_value: { value: 400 } },
          { name: 'reach', total_value: { value: 300 } },
          { name: 'saved', total_value: { value: 5 } },
          { name: 'shares', total_value: { value: 2 } },
          { name: 'plays', total_value: { value: 0 } },
        ],
      }),
    })

    const rows = await fetchInstagramMetrics('token123', 'account456')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      views: 1200,
      likes: 42,
      saves: 30,
      shares: 10,
      impressions: 1500,
      reach: 900,
    })
    expect(rows[1]).toMatchObject({
      views: 0,
      likes: 15,
      saves: 5,
      shares: 2,
      impressions: 400,
      reach: 300,
    })
  })

  it('returns empty array when media fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const rows = await fetchInstagramMetrics('bad-token', 'account456')
    expect(rows).toEqual([])
  })

  it('skips media items whose insight fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'media_1', media_type: 'VIDEO', timestamp: '2026-04-20T12:00:00Z', like_count: 5 }],
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })

    const rows = await fetchInstagramMetrics('token123', 'account456')
    expect(rows).toEqual([])
  })
})
