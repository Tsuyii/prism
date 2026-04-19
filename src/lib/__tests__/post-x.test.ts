import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock getXCredentials (hoisted) ─────────────────────────────────────────────

const { mockGetXCredentials } = vi.hoisted(() => ({
  mockGetXCredentials: vi.fn<
    () => { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string }
  >(),
}))

vi.mock('@/lib/platform-tokens', () => ({
  getXCredentials: mockGetXCredentials,
}))

// ── Mock TwitterApi ────────────────────────────────────────────────────────────

const mockTweet = vi.fn<
  (text: string, opts?: { reply?: { in_reply_to_tweet_id: string } }) => Promise<{ data: { id: string } }>
>()

vi.mock('twitter-api-v2', () => {
  function MockTwitterApi() {
    return {
      v2: {
        tweet: mockTweet,
      },
    }
  }
  return {
    TwitterApi: vi.fn().mockImplementation(MockTwitterApi),
  }
})

// ── Import after mocks ─────────────────────────────────────────────────────────

import { postX } from '@/lib/post-x'

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCredentials() {
  return {
    apiKey: 'key',
    apiSecret: 'secret',
    accessToken: 'token',
    accessTokenSecret: 'tokenSecret',
  }
}

function makeTweetResponse(id: string) {
  return { data: { id } }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('postX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetXCredentials.mockReturnValue(defaultCredentials())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Happy path: single tweet ──────────────────────────────────────────────

  describe('single tweet (text under 280 chars)', () => {
    it('returns success: true with tweetId', async () => {
      mockTweet.mockResolvedValueOnce(makeTweetResponse('tweet-123'))

      const result = await postX({ caption: 'Hello world', hashtags: ['#test'] })

      expect(result).toEqual({ success: true, tweetId: 'tweet-123' })
    })

    it('calls tweet with the correct text (caption + hashtags)', async () => {
      mockTweet.mockResolvedValueOnce(makeTweetResponse('tweet-abc'))

      await postX({ caption: 'My caption', hashtags: ['#foo', '#bar'] })

      expect(mockTweet).toHaveBeenCalledOnce()
      expect(mockTweet).toHaveBeenCalledWith('My caption\n\n#foo #bar')
    })

    it('handles null caption and null hashtags', async () => {
      mockTweet.mockResolvedValueOnce(makeTweetResponse('tweet-null'))

      const result = await postX({ caption: null, hashtags: null })

      expect(result).toEqual({ success: true, tweetId: 'tweet-null' })
      expect(mockTweet).toHaveBeenCalledWith('')
    })

    it('trims when hashtags are empty array', async () => {
      mockTweet.mockResolvedValueOnce(makeTweetResponse('tweet-trim'))

      await postX({ caption: 'Just caption', hashtags: [] })

      expect(mockTweet).toHaveBeenCalledWith('Just caption')
    })
  })

  // ── Thread path: text > 280 chars split on \n\n ───────────────────────────

  describe('thread (text > 280 chars split on \\n\\n)', () => {
    it('posts multiple tweets as a reply chain when text exceeds 280 chars', async () => {
      // Each part is well under 280 chars individually but together exceed 280
      const part1 = 'A'.repeat(100)
      const part2 = 'B'.repeat(100)
      const part3 = 'C'.repeat(100)
      const caption = `${part1}\n\n${part2}\n\n${part3}`

      mockTweet
        .mockResolvedValueOnce(makeTweetResponse('tweet-1'))
        .mockResolvedValueOnce(makeTweetResponse('tweet-2'))
        .mockResolvedValueOnce(makeTweetResponse('tweet-3'))

      const result = await postX({ caption, hashtags: null })

      expect(result).toEqual({ success: true, tweetId: 'tweet-1' })
      expect(mockTweet).toHaveBeenCalledTimes(3)

      // First tweet: no reply options
      expect(mockTweet).toHaveBeenNthCalledWith(1, part1)

      // Second tweet: reply to first
      expect(mockTweet).toHaveBeenNthCalledWith(2, part2, {
        reply: { in_reply_to_tweet_id: 'tweet-1' },
      })

      // Third tweet: reply to second
      expect(mockTweet).toHaveBeenNthCalledWith(3, part3, {
        reply: { in_reply_to_tweet_id: 'tweet-2' },
      })
    })

    it('truncates a single chunk that exceeds 280 chars', async () => {
      // One chunk of 300 chars — should truncate to 277 + '...'
      const longChunk = 'X'.repeat(300)

      mockTweet.mockResolvedValueOnce(makeTweetResponse('tweet-trunc'))

      await postX({ caption: longChunk, hashtags: null })

      expect(mockTweet).toHaveBeenCalledOnce()
      const calledWith = mockTweet.mock.calls[0][0]
      expect(calledWith).toHaveLength(280)
      expect(calledWith.endsWith('...')).toBe(true)
    })

    it('returns the first tweet id when posting a thread', async () => {
      const part1 = 'First chunk '.repeat(15).trim()  // ~180 chars
      const part2 = 'Second chunk '.repeat(15).trim() // ~195 chars

      mockTweet
        .mockResolvedValueOnce(makeTweetResponse('first-tweet-id'))
        .mockResolvedValueOnce(makeTweetResponse('second-tweet-id'))

      const result = await postX({ caption: `${part1}\n\n${part2}`, hashtags: null })

      expect(result).toEqual({ success: true, tweetId: 'first-tweet-id' })
    })
  })

  // ── getXCredentials failure ───────────────────────────────────────────────

  describe('getXCredentials failure', () => {
    it('returns success: false when getXCredentials throws', async () => {
      mockGetXCredentials.mockImplementationOnce(() => {
        throw new Error(
          'X credentials not set: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET required',
        )
      })

      const result = await postX({ caption: 'Hello', hashtags: null })

      expect(result).toEqual({
        success: false,
        error: 'X credentials not set: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET required',
      })
      expect(mockTweet).not.toHaveBeenCalled()
    })
  })

  // ── API error ─────────────────────────────────────────────────────────────

  describe('API error', () => {
    it('returns success: false when tweet() throws', async () => {
      mockTweet.mockRejectedValueOnce(new Error('Twitter API error: 403 Forbidden'))

      const result = await postX({ caption: 'Hello', hashtags: ['#test'] })

      expect(result).toEqual({
        success: false,
        error: 'Twitter API error: 403 Forbidden',
      })
    })

    it('returns success: false on non-Error thrown values', async () => {
      mockTweet.mockRejectedValueOnce('string error from API')

      const result = await postX({ caption: 'Hello', hashtags: null })

      expect(result).toEqual({ success: false, error: 'string error from API' })
    })
  })
})
