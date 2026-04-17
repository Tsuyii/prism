import { describe, it, expect } from 'vitest'
import { ContentVariantsSchema } from '../claude'

describe('ContentVariantsSchema', () => {
  it('validates a complete valid response', () => {
    const valid = {
      instagram: {
        caption: 'Stop scrolling — this CapCut trick saved me 3 hours.',
        hashtags: ['#capcut', '#videoediting', '#editingtips', '#reels', '#contentcreator'],
      },
      tiktok: {
        caption: 'The CapCut button nobody talks about 👇',
        hashtags: ['#capcut', '#fyp', '#edit'],
      },
      x_thread: {
        tweets: [
          'Most editors waste 20 minutes on something that takes 30 seconds in CapCut.',
          'The auto-caption tool syncs perfectly to beat — tap the music note icon first.',
          'Transition speed matters more than type. 0.3s is the sweet spot.',
        ],
      },
      x_video: {
        caption: 'Found a CapCut trick I wish I knew 2 years ago. Sharing it now.',
      },
      best_post_time: 'Friday at 6:00 PM',
      film_next: 'A 60-second tutorial on the 3 most-rewatched CapCut transitions.',
    }
    const result = ContentVariantsSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('fails when x_video caption exceeds 280 chars', () => {
    const tooLong = 'x'.repeat(281)
    const result = ContentVariantsSchema.safeParse({
      instagram: { caption: 'ok', hashtags: [] },
      tiktok: { caption: 'ok', hashtags: [] },
      x_thread: { tweets: ['tip one'] },
      x_video: { caption: tooLong },
      best_post_time: 'Monday at 6:00 PM',
      film_next: 'Film this',
    })
    expect(result.success).toBe(false)
  })

  it('requires all four platform variants', () => {
    const missing = {
      instagram: { caption: 'ok', hashtags: [] },
      tiktok: { caption: 'ok', hashtags: [] },
      x_video: { caption: 'ok' },
      best_post_time: 'Monday at 6:00 PM',
      film_next: 'Film this',
    }
    const result = ContentVariantsSchema.safeParse(missing)
    expect(result.success).toBe(false)
  })
})
