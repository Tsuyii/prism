import { describe, it, expect } from 'vitest'
import { cn, formatScheduledTime, platformLabel } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})

describe('formatScheduledTime', () => {
  it('formats a future ISO string as readable time', () => {
    const iso = '2026-04-16T18:00:00.000Z'
    const result = formatScheduledTime(iso)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns "Not scheduled" for null', () => {
    expect(formatScheduledTime(null)).toBe('Not scheduled')
  })
})

describe('platformLabel', () => {
  it('returns human labels for all platforms', () => {
    expect(platformLabel('instagram')).toBe('Instagram')
    expect(platformLabel('tiktok')).toBe('TikTok')
    expect(platformLabel('x_thread')).toBe('X Thread')
    expect(platformLabel('x_video')).toBe('X Video')
  })
})
