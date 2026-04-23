import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchYouTubeTrends, fetchRedditTrends, fetchPerplexityTrends, scoreTrendsWithClaude, type RawTrend } from '@/lib/trends'
import type { Json } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY
  if (!youtubeKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })
  }

  const supabase = createServiceClient()

  // ── Prune rows older than 30 days ─────────────────────────────────────────
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('niche_trends').delete().lt('fetched_at', cutoff).not('source', 'eq', 'claude')

  // ── Fetch raw trends in parallel ──────────────────────────────────────────
  const fetchers: Promise<RawTrend[]>[] = [
    fetchYouTubeTrends(youtubeKey),
    fetchRedditTrends(),
  ]

  if (process.env.PERPLEXITY_API_KEY) {
    fetchers.push(fetchPerplexityTrends(process.env.PERPLEXITY_API_KEY))
  } else {
    console.warn('[cron/research] PERPLEXITY_API_KEY not set — skipping Perplexity')
  }

  const results = await Promise.all(fetchers)
  const raw = results.flat()

  if (raw.length === 0) {
    console.warn('[cron/research] No raw trends fetched — skipping Claude scoring')
    return NextResponse.json({ inserted: 0, warning: 'No raw trends' })
  }

  // ── Score with Claude ─────────────────────────────────────────────────────
  let scored_topics, claude_topics
  try {
    ;({ scored_topics, claude_topics } = await scoreTrendsWithClaude(raw))
  } catch (err) {
    console.error('[cron/research] Claude scoring failed:', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }

  // ── Insert into niche_trends ──────────────────────────────────────────────
  const rows = [...scored_topics, ...claude_topics].map((t) => ({
    source: t.source,
    topic: t.topic,
    score: t.score,
    raw_data: t.raw_data as Json,
  }))

  const { error } = await supabase.from('niche_trends').insert(rows)
  if (error) {
    console.error('[cron/research] Insert failed:', error)
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  console.log(`[cron/research] Inserted ${rows.length} trends`)
  return NextResponse.json({ inserted: rows.length })
}
