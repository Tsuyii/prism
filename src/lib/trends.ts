import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawTrend {
  topic: string
  source: 'youtube' | 'reddit'
  raw_data: Record<string, unknown>
}

export interface ScoredTrend {
  topic: string
  score: number
  source: 'youtube' | 'reddit' | 'claude'
  raw_data: Record<string, unknown>
}

// ─── Claude output schema ─────────────────────────────────────────────────────

export const TrendScoringSchema = z.object({
  scored_topics: z.array(
    z.object({
      topic: z.string(),
      score: z.number().min(0).max(100),
      source: z.enum(['youtube', 'reddit']),
    }),
  ),
  claude_topics: z.array(
    z.object({
      topic: z.string(),
      score: z.number().min(0).max(100),
      rationale: z.string(),
    }),
  ),
})

// ─── YouTube fetcher ──────────────────────────────────────────────────────────

const YOUTUBE_QUERIES = [
  'video editing tutorial',
  'capcut tutorial 2025',
  'premiere pro tips',
  'davinci resolve tutorial',
  'after effects tutorial',
]

export async function fetchYouTubeTrends(apiKey: string): Promise<RawTrend[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const query = YOUTUBE_QUERIES[new Date().getDay() % YOUTUBE_QUERIES.length]

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('publishedAfter', sevenDaysAgo)
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('key', apiKey)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      console.warn(`[trends] YouTube API ${res.status}`)
      return []
    }
    const data = await res.json()
    return (data.items ?? []).map((item: {
      id: { videoId: string }
      snippet: { title: string; channelTitle: string }
    }) => ({
      topic: item.snippet.title,
      source: 'youtube' as const,
      raw_data: { videoId: item.id.videoId, channelTitle: item.snippet.channelTitle },
    }))
  } catch (err) {
    console.warn('[trends] YouTube fetch error:', err)
    return []
  }
}

// ─── Reddit fetcher ───────────────────────────────────────────────────────────

const SUBREDDITS = ['videoediting', 'premiere', 'capcut', 'davinciresolve', 'AfterEffects']

export async function fetchRedditTrends(): Promise<RawTrend[]> {
  const results: RawTrend[] = []

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
        headers: { 'User-Agent': 'prism-research-cron/1.0' },
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const { data: post } of (data.data?.children ?? []) as Array<{
        data: { title: string; ups: number; num_comments: number; permalink: string }
      }>) {
        results.push({
          topic: post.title,
          source: 'reddit',
          raw_data: {
            subreddit: sub,
            ups: post.ups,
            num_comments: post.num_comments,
            permalink: `https://reddit.com${post.permalink}`,
          },
        })
      }
    } catch (err) {
      console.warn(`[trends] Reddit r/${sub} error:`, err)
    }
  }

  return results
}

// ─── Claude scorer ────────────────────────────────────────────────────────────

const SCORING_SYSTEM = `You are a social media trend analyst for the video editing niche (CapCut, Premiere Pro, After Effects, DaVinci Resolve). A solo creator uses your analysis to decide what content to film next.

Score each raw topic 0–100:
- 80–100: High relevance, trending now, strong content opportunity
- 50–79: Moderate relevance or evergreen value
- 0–49: Low relevance, oversaturated, or off-niche

Also identify 3–5 original emerging topics that are underserved but gaining momentum — gaps the raw data hints at but doesn't surface directly.`

export async function scoreTrendsWithClaude(raw: RawTrend[]): Promise<{
  scored_topics: ScoredTrend[]
  claude_topics: ScoredTrend[]
}> {
  const client = new Anthropic()

  const topicList = raw.map((t, i) => `${i + 1}. [${t.source}] ${t.topic}`).join('\n')

  const response = await client.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text', text: SCORING_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Score these trending topics and identify 3–5 emerging opportunities:\n\n${topicList}`,
      },
    ],
    output_config: { format: zodOutputFormat(TrendScoringSchema) },
  })

  if (!response.parsed_output) throw new Error('Claude returned no scored output')

  const rawByIndex = new Map(raw.map((t, i) => [i, t]))

  const scored_topics: ScoredTrend[] = response.parsed_output.scored_topics.map((t, i) => ({
    topic: t.topic,
    score: t.score,
    source: t.source,
    raw_data: rawByIndex.get(i)?.raw_data ?? {},
  }))

  const claude_topics: ScoredTrend[] = response.parsed_output.claude_topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    source: 'claude' as const,
    raw_data: { rationale: t.rationale },
  }))

  return { scored_topics, claude_topics }
}
