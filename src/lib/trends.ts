import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawTrend {
  topic: string
  source: 'youtube' | 'reddit' | 'perplexity'
  raw_data: Record<string, unknown>
}

export interface ScoredTrend {
  topic: string
  score: number
  source: 'youtube' | 'reddit' | 'perplexity' | 'claude'
  raw_data: Record<string, unknown>
}

// ─── Claude output schema ─────────────────────────────────────────────────────

export const TrendScoringSchema = z.object({
  scored_topics: z.array(
    z.object({
      topic: z.string(),
      score: z.number().min(0).max(100),
      source: z.enum(['youtube', 'reddit', 'perplexity']),
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
  const settled = await Promise.allSettled(
    SUBREDDITS.map(async (sub) => {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
        headers: { 'User-Agent': 'prism-research-cron/1.0' },
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.data?.children ?? []).map(({ data: post }: {
        data: { title: string; ups: number; num_comments: number; permalink: string }
      }) => ({
        topic: post.title,
        source: 'reddit' as const,
        raw_data: {
          subreddit: sub,
          ups: post.ups,
          num_comments: post.num_comments,
          permalink: `https://reddit.com${post.permalink}`,
        },
      }))
    }),
  )

  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
}

// ─── Perplexity fetcher ───────────────────────────────────────────────────────

export async function fetchPerplexityTrends(apiKey: string): Promise<RawTrend[]> {
  let res: Response
  try {
    res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a trend researcher for the video editing niche. Respond ONLY with a valid JSON array of strings — no explanation, no markdown, no code block. Each string is a trending topic, hook, or video format.',
          },
          {
            role: 'user',
            content:
              'What are the top 10 trending topics, hooks, and video formats in the CapCut, Premiere Pro, After Effects, and DaVinci Resolve editing niche right now this week? Return ONLY a JSON array of 10 strings.',
          },
        ],
      }),
    })
  } catch (err) {
    console.warn('[trends] Perplexity fetch error:', err)
    return []
  }

  if (!res.ok) {
    console.warn(`[trends] Perplexity API ${res.status}`)
    return []
  }

  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''

  let topics: unknown
  try {
    const cleaned = content.replace(/^```json\n?|^```\n?|\n?```$/gm, '').trim()
    topics = JSON.parse(cleaned)
  } catch {
    console.warn('[trends] Perplexity response not valid JSON:', content.slice(0, 200))
    return []
  }

  if (!Array.isArray(topics)) return []

  return topics
    .filter((t): t is string => typeof t === 'string')
    .map((topic) => ({
      topic,
      source: 'perplexity' as const,
      raw_data: { model: 'sonar' },
    }))
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

  const rawByTopic = new Map(raw.map((t) => [t.topic, t]))

  const scored_topics: ScoredTrend[] = response.parsed_output.scored_topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    source: t.source,
    raw_data: rawByTopic.get(t.topic)?.raw_data ?? {},
  }))

  const claude_topics: ScoredTrend[] = response.parsed_output.claude_topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    source: 'claude' as const,
    raw_data: { rationale: t.rationale },
  }))

  return { scored_topics, claude_topics }
}
