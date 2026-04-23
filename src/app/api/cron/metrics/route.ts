import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchInstagramMetrics } from '@/lib/instagram-metrics'

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!accessToken || !accountId) {
    return NextResponse.json(
      { error: 'INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID not set' },
      { status: 500 },
    )
  }

  const supabase = createServiceClient()

  // ── Prune performance rows older than 60 days ─────────────────────────────
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('performance').delete().lt('fetched_at', cutoff)

  // ── Fetch latest Instagram metrics ────────────────────────────────────────
  const metrics = await fetchInstagramMetrics(accessToken, accountId)

  if (metrics.length === 0) {
    console.warn('[cron/metrics] No metrics returned from Instagram')
    return NextResponse.json({ inserted: 0, warning: 'No metrics' })
  }

  // ── Insert into performance table ─────────────────────────────────────────
  const rows = metrics.map((m) => ({
    platform: 'instagram',
    post_id: null,
    views: m.views,
    likes: m.likes,
    saves: m.saves,
    shares: m.shares,
    impressions: m.impressions,
    reach: m.reach,
  }))

  const { error } = await supabase.from('performance').insert(rows)
  if (error) {
    console.error('[cron/metrics] Insert failed:', error)
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  console.log(`[cron/metrics] Inserted ${rows.length} performance rows`)
  return NextResponse.json({ inserted: rows.length })
}
