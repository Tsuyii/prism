import { getToken } from '@/lib/platform-tokens'

type TikTokVariant = {
  caption: string | null
  hashtags: string[] | null
  media_url: string | null
}

type TikTokSuccessResult = { success: true; videoId: string }
type TikTokFailResult = { success: false; error: string; skipped?: boolean }
type TikTokResult = TikTokSuccessResult | TikTokFailResult

type TikTokErrorResponse = {
  error: {
    code: string
    message: string
  }
}

type TikTokSuccessResponse = {
  data: {
    publish_id: string
  }
  error?: {
    code: string
    message: string
  }
}

const SKIPPED_ERROR_CODES = new Set([
  'access_token.invalid',
  'spam_risk_too_many_posts',
])

/**
 * Post a video variant to TikTok via the Content Posting API.
 *
 * Returns { success: true, videoId } on success.
 * Returns { success: false, error, skipped: true } when TikTok is not configured
 * or when the API rejects the post due to access/review/spam issues — these are
 * not hard failures; the caller should log and continue.
 * Returns { success: false, error } on unexpected errors.
 */
export async function postTikTok(variant: TikTokVariant): Promise<TikTokResult> {
  // 1. Guard: env var must exist before attempting any DB/token work
  if (!process.env.TIKTOK_ACCESS_TOKEN) {
    return { success: false, error: 'TikTok not configured', skipped: true }
  }

  try {
    // 2. Retrieve token (seeds from env or refreshes if expiring)
    const token = await getToken('tiktok')

    // 3. Build caption string
    const captionText = `${variant.caption ?? ''} ${(variant.hashtags ?? []).join(' ')}`.trim()

    // 4. Call TikTok Content Posting API
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: captionText,
          privacy_level: 'PUBLIC_TO_EVERYONE',
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: variant.media_url,
        },
      }),
    })

    const json = (await res.json()) as TikTokSuccessResponse | TikTokErrorResponse

    // 5. Handle API-level errors (error code in body or 4xx HTTP status)
    const errorBody = 'error' in json && json.error?.code ? json.error : null

    if (errorBody && (SKIPPED_ERROR_CODES.has(errorBody.code) || !res.ok)) {
      return {
        success: false,
        error: errorBody.message,
        skipped: true,
      }
    }

    if (!res.ok) {
      const message =
        errorBody?.message ?? `TikTok API returned HTTP ${res.status}`
      return { success: false, error: message, skipped: true }
    }

    // 6. Return success with videoId
    const successJson = json as TikTokSuccessResponse
    return { success: true, videoId: successJson.data.publish_id }
  } catch (err) {
    // 7. Network or unexpected errors — not skipped, a real failure
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
