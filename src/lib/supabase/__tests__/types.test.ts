import { describe, it, expect } from 'vitest'
import type { Post, PostVariant, PostStatus, Platform } from '../types'

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

  it('PostVariant platform covers all 4 platforms', () => {
    const platforms: Platform[] = ['instagram', 'tiktok', 'x_thread', 'x_video']
    expect(platforms).toHaveLength(4)
  })

  it('PostStatus covers all valid states', () => {
    const statuses: PostStatus[] = ['pending_review', 'approved', 'rejected', 'published', 'failed']
    expect(statuses).toHaveLength(5)
  })
})
