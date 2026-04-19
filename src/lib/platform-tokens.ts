import { createServiceClient } from '@/lib/supabase/server'

type Platform = 'instagram' | 'tiktok' | 'x'

const ENV_VAR_MAP: Record<Platform, string> = {
  instagram: 'INSTAGRAM_ACCESS_TOKEN',
  tiktok: 'TIKTOK_ACCESS_TOKEN',
  x: 'X_ACCESS_TOKEN',
}

/** Days before expiry that triggers a proactive token refresh. */
const REFRESH_THRESHOLD_DAYS = 7

function isExpiringSoon(expiresAt: Date): boolean {
  const thresholdMs = REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  return expiresAt.getTime() - Date.now() <= thresholdMs
}

/**
 * Refresh a platform token using the platform's OAuth refresh flow.
 * X (OAuth 1.0a) tokens never expire — calling this for X throws.
 */
async function refreshToken(platform: 'instagram' | 'tiktok'): Promise<string> {
  if (platform === 'instagram') {
    const appId = process.env.INSTAGRAM_APP_ID
    const appSecret = process.env.INSTAGRAM_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error(
        'Cannot refresh Instagram token: INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET not set',
      )
    }

    const supabase = createServiceClient()
    const { data: row } = await supabase
      .from('platform_tokens')
      .select('access_token')
      .eq('platform', 'instagram')
      .single()

    if (!row) {
      throw new Error('Cannot refresh Instagram token: no existing token row found in DB')
    }

    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    url.searchParams.set('grant_type', 'fb_exchange_token')
    url.searchParams.set('client_id', appId)
    url.searchParams.set('client_secret', appSecret)
    url.searchParams.set('fb_exchange_token', row.access_token)

    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Instagram token refresh failed: HTTP ${res.status}`)
    }
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) {
      throw new Error('Instagram token refresh failed: no access_token in response')
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // +60 days
    await saveToken('instagram', json.access_token, undefined, expiresAt)
    return json.access_token
  }

  // TikTok
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET

  if (!clientKey || !clientSecret) {
    throw new Error(
      'Cannot refresh TikTok token: TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set',
    )
  }

  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('platform_tokens')
    .select('refresh_token')
    .eq('platform', 'tiktok')
    .single()

  if (!row?.refresh_token) {
    throw new Error('Cannot refresh TikTok token: no refresh_token found in DB')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_key: clientKey,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
  })

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`TikTok token refresh failed: HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    data?: { access_token?: string; refresh_token?: string }
  }

  const accessToken = json.data?.access_token
  const newRefreshToken = json.data?.refresh_token

  if (!accessToken) {
    throw new Error('TikTok token refresh failed: no access_token in response')
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // +24 hours
  await saveToken('tiktok', accessToken, newRefreshToken, expiresAt)
  return accessToken
}

/**
 * Upsert a token row in the platform_tokens table.
 */
export async function saveToken(
  platform: Platform,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('platform_tokens').upsert(
    {
      platform,
      access_token: accessToken,
      refresh_token: refreshToken ?? null,
      expires_at: expiresAt?.toISOString() ?? null,
    },
    { onConflict: 'platform' },
  )

  if (error) {
    throw new Error(`Failed to save token for ${platform}: ${error.message}`)
  }
}

/**
 * Get the access token for a platform.
 *
 * - If no DB row exists: seeds from the corresponding env var and inserts it.
 * - If the token expires within 7 days: triggers a refresh (Instagram / TikTok only).
 * - Returns the current access_token.
 */
export async function getToken(platform: Platform): Promise<string> {
  const supabase = createServiceClient()

  const { data: row } = await supabase
    .from('platform_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('platform', platform)
    .single()

  // No row — seed from env var
  if (!row) {
    const envVar = ENV_VAR_MAP[platform]
    const token = process.env[envVar]
    if (!token) {
      throw new Error(
        `No token for ${platform} and ${envVar} env var not set`,
      )
    }
    await saveToken(platform, token)
    return token
  }

  // Row exists — check expiry
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at)
    if (isExpiringSoon(expiresAt)) {
      if (platform === 'x') {
        // X uses OAuth 1.0a — tokens don't expire, nothing to do
        return row.access_token
      }
      return await refreshToken(platform as 'instagram' | 'tiktok')
    }
  }

  return row.access_token
}
