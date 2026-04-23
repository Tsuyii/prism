import { describe, it, expect, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  const parseMock = vi.fn().mockResolvedValue({
    parsed_output: {
      instagram: { caption: 'Fresh caption', hashtags: ['#edit'] },
      tiktok: { caption: 'Fresh TikTok', hashtags: ['#fyp'] },
      x_thread: { tweets: ['Tweet 1', 'Tweet 2'] },
      x_video: { caption: 'Fresh X caption' },
      best_post_time: 'Tuesday at 7:00 PM',
      film_next: 'Speed ramp tutorial',
    },
    stop_reason: 'end_turn',
  })
  class MockAnthropic {
    messages = { parse: parseMock }
  }
  return { default: MockAnthropic }
})

import { generateRepurposedVariants } from '../claude'

describe('generateRepurposedVariants', () => {
  it('returns ContentVariants with all four platforms', async () => {
    const result = await generateRepurposedVariants({
      contentType: 'reel',
      originalCaption: 'Original caption about CapCut speed ramps',
      trendData: [{ topic: 'AI b-roll', source: 'perplexity' }],
    })

    expect(result.instagram.caption).toBe('Fresh caption')
    expect(result.tiktok.hashtags).toContain('#fyp')
    expect(result.x_thread.tweets).toHaveLength(2)
    expect(result.x_video.caption).toBe('Fresh X caption')
    expect(result.best_post_time).toBe('Tuesday at 7:00 PM')
    expect(result.film_next).toBe('Speed ramp tutorial')
  })

  it('works without optional trendData', async () => {
    const result = await generateRepurposedVariants({
      contentType: 'carousel',
      originalCaption: 'Original carousel about colour grading',
    })
    expect(result.instagram.caption).toBeDefined()
  })
})
