import { describe, it, expect, expectTypeOf } from 'vitest'
import type { Post, PostVariant, PostStatus, Platform, ScheduleConfig } from '../types'

describe('Supabase types', () => {
  it('Post type has required fields', () => {
    const post: Post = {
      id: '123',
      status: 'pending_review',
      type: 'reel',
      drive_url: 'https://drive.google.com/file/123',
      scheduled_at: null,
      created_at: new Date().toISOString(),
    }
    expect(post.status).toBe('pending_review')
    expect(post.type).toBe('reel')
  })

  it('Platform union covers all 4 platforms', () => {
    const allPlatforms = (p: Platform): boolean => {
      const map: Record<Platform, true> = {
        instagram: true,
        tiktok: true,
        x_thread: true,
        x_video: true,
      }
      return map[p]
    }
    expect(allPlatforms('instagram')).toBe(true)
    expect(allPlatforms('tiktok')).toBe(true)
    expect(allPlatforms('x_thread')).toBe(true)
    expect(allPlatforms('x_video')).toBe(true)
  })

  it('PostStatus union covers all valid states', () => {
    const allStatuses = (s: PostStatus): boolean => {
      const map: Record<PostStatus, true> = {
        pending_review: true,
        approved: true,
        rejected: true,
        published: true,
        failed: true,
      }
      return map[s]
    }
    expect(allStatuses('pending_review')).toBe(true)
    expect(allStatuses('approved')).toBe(true)
    expect(allStatuses('rejected')).toBe(true)
    expect(allStatuses('published')).toBe(true)
    expect(allStatuses('failed')).toBe(true)
  })
})
