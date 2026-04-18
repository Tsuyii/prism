import { describe, it, expect } from 'vitest'
import { platformLabel, formatScheduledTime } from '../utils'
import type { Platform } from '../supabase/types'

describe('platformLabel', () => {
  it('returns correct label for each platform', () => {
    const cases: Array<[Platform, string]> = [
      ['instagram', 'Instagram'],
      ['tiktok', 'TikTok'],
      ['x_thread', 'X Thread'],
      ['x_video', 'X Video'],
    ]
    for (const [platform, expected] of cases) {
      expect(platformLabel(platform)).toBe(expected)
    }
  })
})

describe('formatScheduledTime', () => {
  it('returns "Not scheduled" for null', () => {
    expect(formatScheduledTime(null)).toBe('Not scheduled')
  })

  it('returns a time string for a valid ISO date', () => {
    const result = formatScheduledTime('2026-04-18T18:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('Not scheduled')
  })
})

describe('Drive URL fileId extraction', () => {
  function extractFileId(input: string): string {
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    return input.trim()
  }

  it('extracts fileId from full Drive URL', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view'
    expect(extractFileId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')
  })

  it('returns raw string when no URL pattern', () => {
    expect(extractFileId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')
  })

  it('trims whitespace from raw fileId', () => {
    expect(extractFileId('  1BxiMVs0  ')).toBe('1BxiMVs0')
  })
})
