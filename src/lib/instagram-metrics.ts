// ── Types ─────────────────────────────────────────────────────────────────────

interface IGMediaItem {
  id: string
  media_type: string
  timestamp: string
  like_count?: number
}

interface IGInsight {
  name: string
  total_value?: { value: number }
  values?: Array<{ value: number }>
}

export interface MetricRow {
  views: number
  likes: number
  saves: number
  shares: number
  impressions: number
  reach: number
}

// ── Graph API client ──────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export async function fetchInstagramMetrics(
  accessToken: string,
  accountId: string,
): Promise<MetricRow[]> {
  // ── 1. Fetch recent media list ────────────────────────────────────────────
  const mediaUrl = new URL(`${GRAPH_BASE}/${accountId}/media`)
  mediaUrl.searchParams.set('fields', 'id,media_type,timestamp,like_count')
  mediaUrl.searchParams.set('limit', '10')
  mediaUrl.searchParams.set('access_token', accessToken)

  let mediaRes: Response
  try {
    mediaRes = await fetch(mediaUrl.toString())
  } catch (err) {
    console.warn('[instagram-metrics] media fetch error:', err)
    return []
  }
  if (!mediaRes.ok) {
    console.warn(`[instagram-metrics] media fetch ${mediaRes.status}`)
    return []
  }

  const mediaData = await mediaRes.json()
  const items: IGMediaItem[] = mediaData.data ?? []

  // ── 2. Fetch insights for each item in parallel ───────────────────────────
  const settled = await Promise.allSettled(
    items.map(async (item): Promise<MetricRow | null> => {
      const insightUrl = new URL(`${GRAPH_BASE}/${item.id}/insights`)
      insightUrl.searchParams.set('metric', 'impressions,reach,saved,shares,plays')
      insightUrl.searchParams.set('access_token', accessToken)

      const insightRes = await fetch(insightUrl.toString())
      if (!insightRes.ok) return null

      const insightData = await insightRes.json()
      const insights: IGInsight[] = insightData.data ?? []

      const get = (name: string): number => {
        const ins = insights.find((i) => i.name === name)
        return ins?.total_value?.value ?? ins?.values?.[0]?.value ?? 0
      }

      return {
        views: get('plays'),
        likes: item.like_count ?? 0,
        saves: get('saved'),
        shares: get('shares'),
        impressions: get('impressions'),
        reach: get('reach'),
      }
    }),
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<MetricRow | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is MetricRow => v !== null)
}
