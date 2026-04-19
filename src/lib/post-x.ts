import { TwitterApi } from 'twitter-api-v2'
import { getXCredentials } from '@/lib/platform-tokens'

const MAX_TWEET_LENGTH = 280
const TRUNCATE_AT = 277

/**
 * Split text into tweet-sized chunks on \n\n boundaries.
 * Each chunk must be <= 280 chars; if a single chunk exceeds that, truncate to 277 + '...'.
 */
function splitIntoChunks(text: string): string[] {
  const parts = text.split('\n\n').filter((p) => p.length > 0)
  return parts.map((chunk) =>
    chunk.length > MAX_TWEET_LENGTH ? chunk.slice(0, TRUNCATE_AT) + '...' : chunk,
  )
}

export async function postX(variant: {
  caption: string | null
  hashtags: string[] | null
}): Promise<{ success: true; tweetId: string } | { success: false; error: string }> {
  try {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } = getXCredentials()

    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    })

    const fullText = `${variant.caption ?? ''}\n\n${(variant.hashtags ?? []).join(' ')}`.trim()

    let chunks: string[]
    if (fullText.length > MAX_TWEET_LENGTH) {
      chunks = splitIntoChunks(fullText)
      // If splitting yields no chunks (edge case: empty after filter), fall back to truncation
      if (chunks.length === 0) {
        chunks = [fullText.slice(0, TRUNCATE_AT) + '...']
      }
    } else {
      chunks = [fullText]
    }

    let firstTweetId: string | null = null
    let previousTweetId: string | null = null

    for (const chunk of chunks) {
      let response: { data: { id: string } }
      if (previousTweetId === null) {
        response = await client.v2.tweet(chunk)
      } else {
        response = await client.v2.tweet(chunk, {
          reply: { in_reply_to_tweet_id: previousTweetId },
        })
      }
      if (firstTweetId === null) {
        firstTweetId = response.data.id
      }
      previousTweetId = response.data.id
    }

    return { success: true, tweetId: firstTweetId! }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
    return { success: false, error: message }
  }
}
