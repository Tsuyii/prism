import { createServiceClient } from '@/lib/supabase/server'

export type Platform = 'instagram' | 'tiktok'

const ENV_VAR_MAP: Record<Platform, string> = {
  instagram: 'INSTAGRAM_ACCESS_TOKEN',
  tiktok: 'TIKTOK_ACCESS_TOKEN',
}

/** Milliseconds before expiry at which a proactive refresh is triggered, per platform. */
const REFRESH_THRESHOLD_MS: Record<Platform, number> = {
  instagram: 7 * 24 * 60 * 60 * 1000, // 7 days
  tiktok: 60 * 60 * 1000, // 1 hour before expiry
}

function isExpiringSoon(platform: Platform, expiresAt: Date): boolean {
  return expiresAt.getTime() - Date.now() <= REFRESH_THRESHOLD_MS[platform]
}

/**
 * Refresh a platform token using the platform's OAuth refresh flow.
 */
async function refreshToken(platform: Platform): Promise<string> {
  if (platform === 'instagram') {
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
    url.searchParams.set('grant_type', 'ig_refresh_token')
    url.searchParams.set('access_token', row.access_token)

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
 * - If the token expires within the platform threshold: triggers a refresh.
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
      throw new Error(`No token for ${platform} and ${envVar} env var not set`)
    }
    await saveToken(platform, token)
    return token
  }

  // Row exists — check expiry
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at)
    if (isExpiringSoon(platform, expiresAt)) {
      return await refreshToken(platform)
    }
  }

  return row.access_token
}

/**
 * Get X (Twitter) OAuth 1.0a credentials directly from env vars.
 * X tokens never expire, so no DB storage is needed.
 */
export function getXCredentials(): {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
} {
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error(
      'X credentials not set: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET required',
    )
  }
  return { apiKey, apiSecret, accessToken, accessTokenSecret }
}
