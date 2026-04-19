import { getToken } from '@/lib/platform-tokens'

export type InstagramVariant = {
  caption: string | null
  hashtags: string[] | null
  media_url: string | null
}

type InstagramSuccessResult = { success: true; mediaId: string }
type InstagramFailResult = { success: false; error: string }
type InstagramResult = InstagramSuccessResult | InstagramFailResult

type ContainerResponse = {
  id?: string
  creation_id?: string
  error?: { message: string }
}

type StatusResponse = {
  status_code?: string
  error?: { message: string }
}

type PublishResponse = {
  id?: string
  error?: { message: string }
}

/** Poll interval in milliseconds — exported so tests can override. */
export const POLL_INTERVAL_MS = 5000

/** Maximum number of poll attempts before timing out — exported so tests can override. */
export const MAX_POLLS = 12

/**
 * Post a video variant to Instagram as a Reel via the Graph API.
 *
 * Steps:
 * 1. Create a media container (reels endpoint)
 * 2. Poll the container status until FINISHED (or timeout)
 * 3. Publish the container
 *
 * Returns { success: true, mediaId } on success.
 * Returns { success: false, error } on failure or timeout.
 */
export async function postInstagram(variant: InstagramVariant): Promise<InstagramResult> {
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!accountId) {
    throw new Error(
      'INSTAGRAM_BUSINESS_ACCOUNT_ID env var is not set — cannot post to Instagram',
    )
  }

  try {
    const token = await getToken('instagram')

    // Build caption string
    const caption = `${variant.caption ?? ''}\n\n${(variant.hashtags ?? []).join(' ')}`.trim()

    // Step 1: Create reels container
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/reels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: variant.media_url,
          caption,
          access_token: token,
        }),
      },
    )

    const containerJson = (await containerRes.json()) as ContainerResponse

    if (!containerRes.ok || !containerJson.id) {
      const errMsg =
        containerJson.error?.message ??
        `Instagram container creation failed: HTTP ${containerRes.status}`
      return { success: false, error: errMsg }
    }

    const creationId = containerJson.id

    // Step 2: Poll for processing completion
    let pollsRemaining = MAX_POLLS

    while (pollsRemaining > 0) {
      await sleep(POLL_INTERVAL_MS)
      pollsRemaining--

      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${token}`,
      )

      const statusJson = (await statusRes.json()) as StatusResponse

      if (statusJson.status_code === 'FINISHED') {
        // Step 3: Publish the container
        const publishRes = await fetch(
          `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: creationId,
              access_token: token,
            }),
          },
        )

        const publishJson = (await publishRes.json()) as PublishResponse

        if (!publishRes.ok || !publishJson.id) {
          const errMsg =
            publishJson.error?.message ??
            `Instagram publish failed: HTTP ${publishRes.status}`
          return { success: false, error: errMsg }
        }

        return { success: true, mediaId: publishJson.id }
      }

      // If status indicates a terminal error, bail early
      if (
        statusJson.status_code === 'ERROR' ||
        statusJson.status_code === 'EXPIRED'
      ) {
        return {
          success: false,
          error: `Instagram media processing failed with status: ${statusJson.status_code}`,
        }
      }
    }

    // Exhausted all poll attempts
    return { success: false, error: 'Instagram media processing timed out' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
