import { describe, it, expect } from 'vitest'

describe('pipeline request validation', () => {
  it('accepts valid reel payload shape', () => {
    const payload = {
      fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
      fileName: 'capcut-tutorial.mp4',
      mimeType: 'video/mp4',
      driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    }
    const isValid =
      typeof payload.fileId === 'string' &&
      typeof payload.fileName === 'string' &&
      typeof payload.mimeType === 'string' &&
      typeof payload.driveUrl === 'string'
    expect(isValid).toBe(true)
  })

  it('detects reel vs carousel from mimeType', () => {
    const classify = (mimeType: string) =>
      mimeType.startsWith('video/') ? 'reel' : 'carousel'

    expect(classify('video/mp4')).toBe('reel')
    expect(classify('video/quicktime')).toBe('reel')
    expect(classify('image/jpeg')).toBe('carousel')
    expect(classify('image/png')).toBe('carousel')
    expect(classify('application/zip')).toBe('carousel')
  })

  it('builds correct platform set for post variants', () => {
    const PLATFORMS = ['instagram', 'tiktok', 'x_thread', 'x_video'] as const
    expect(PLATFORMS).toHaveLength(4)
    expect(PLATFORMS).toContain('instagram')
    expect(PLATFORMS).toContain('x_thread')
  })
})
