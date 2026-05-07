# Plan 7: Intelligence Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude's captions trend-aware and audience-tuned by adding Perplexity real-time trend research, an Instagram performance feedback loop, and a one-tap "repurpose top posts" button on the dashboard.

**Architecture:** Three independent improvements layered on top of the existing pipeline. Perplexity replaces the YouTube-only research source with real-time search. Instagram metrics are pulled daily by a new cron and stored in the existing `performance` table, which the pipeline already reads. Repurpose creates new pending_review posts from top published posts via a dashboard button → POST /api/repurpose → Claude → Supabase.

**Tech Stack:** Perplexity sonar API (OpenAI-compatible), Instagram Graph API v21.0, existing Anthropic SDK, Supabase, Next.js App Router, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/trends.ts` | Modify | Add `fetchPerplexityTrends`, extend source types |
| `src/lib/supabase/types.ts` | Modify | Add `'perplexity'` to `TrendSource` |
| `src/app/api/cron/research/route.ts` | Modify | Include Perplexity in research cron |
| `src/lib/instagram-metrics.ts` | Create | `fetchInstagramMetrics()` — Graph API client |
| `src/app/api/cron/metrics/route.ts` | Create | Daily cron that pulls IG metrics → performance table |
| `vercel.json` | Modify | Add metrics cron schedule |
| `src/lib/claude.ts` | Modify | Add `generateRepurposedVariants()` + `RepurposeInput` type |
| `src/app/api/repurpose/route.ts` | Create | Fetch top published posts → Claude → new pending posts |
| `src/components/repurpose-button.tsx` | Create | Client component — button + loading + success state |
| `src/app/page.tsx` | Modify | Wire in `<RepurposeButton />` |
| `src/lib/__tests__/trends.test.ts` | Modify | Add Perplexity fetcher tests |
| `src/lib/__tests__/instagram-metrics.test.ts` | Create | Tests for IG metrics fetcher |
| `src/lib/__tests__/repurpose.test.ts` | Create | Tests for repurpose route logic |

---

## Task 1: Add Perplexity trend fetcher

**Files:**
- Modify: `src/lib/trends.ts`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/__tests__/trends.test.ts`

- [ ] **Step 1.1: Write the failing tests for fetchPerplexityTrends**

First, update the import line at the top of `src/lib/__tests__/trends.test.ts` to include `fetchPerplexityTrends`:

```typescript
// Replace the existing import line:
import { fetchYouTubeTrends, fetchRedditTrends, fetchPerplexityTrends, scoreTrendsWithClaude, TrendScoringSchema } from '../trends'
```

Then add these tests at the end of the file (after the existing `TrendScoringSchema` describe block):

```typescript
describe('fetchPerplexityTrends', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns RawTrend array from Perplexity JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '["CapCut AI tools 2025", "speed ramp transitions", "colour grading presets"]',
            },
          },
        ],
      }),
    })

    const trends = await fetchPerplexityTrends('test-key')
    expect(trends).toHaveLength(3)
    expect(trends[0]).toMatchObject({
      topic: 'CapCut AI tools 2025',
      source: 'perplexity',
      raw_data: { model: 'sonar' },
    })
  })

  it('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const trends = await fetchPerplexityTrends('bad-key')
    expect(trends).toEqual([])
  })

  it('returns empty array when response content is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Here are some trends: ...' } }],
      }),
    })
    const trends = await fetchPerplexityTrends('test-key')
    expect(trends).toEqual([])
  })

  it('strips markdown code fences before parsing JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n["AI transitions", "viral hooks"]\n```',
            },
          },
        ],
      }),
    })
    const trends = await fetchPerplexityTrends('test-key')
    expect(trends).toHaveLength(2)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/trends.test.ts 2>&1 | tail -20
```

Expected: FAIL — `fetchPerplexityTrends is not a function`

- [ ] **Step 1.3: Extend the source types in trends.ts**

In `src/lib/trends.ts`, update `RawTrend` and `ScoredTrend` interfaces, and the `TrendScoringSchema`:

```typescript
// Replace the existing RawTrend interface:
export interface RawTrend {
  topic: string
  source: 'youtube' | 'reddit' | 'perplexity'
  raw_data: Record<string, unknown>
}

// Replace the existing ScoredTrend interface:
export interface ScoredTrend {
  topic: string
  score: number
  source: 'youtube' | 'reddit' | 'perplexity' | 'claude'
  raw_data: Record<string, unknown>
}

// In TrendScoringSchema, replace the source enum in scored_topics:
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
```

- [ ] **Step 1.4: Add fetchPerplexityTrends to trends.ts**

Add this function after `fetchRedditTrends` and before the Claude scorer section:

```typescript
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
```

- [ ] **Step 1.5: Update TrendSource in types.ts**

In `src/lib/supabase/types.ts`, find the line:
```typescript
export type TrendSource = 'youtube' | 'reddit' | 'tiktok' | 'google_trends' | 'claude'
```
Replace with:
```typescript
export type TrendSource = 'youtube' | 'reddit' | 'tiktok' | 'google_trends' | 'claude' | 'perplexity'
```

- [ ] **Step 1.6: Run tests and confirm they pass**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/trends.test.ts 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 1.7: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/lib/trends.ts src/lib/supabase/types.ts src/lib/__tests__/trends.test.ts && git commit -m "feat: add Perplexity real-time trend fetcher to trends.ts"
```

---

## Task 2: Wire Perplexity into research cron

**Files:**
- Modify: `src/app/api/cron/research/route.ts`

- [ ] **Step 2.1: Update the cron route to include Perplexity**

Replace `src/app/api/cron/research/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchYouTubeTrends, fetchRedditTrends, fetchPerplexityTrends, scoreTrendsWithClaude } from '@/lib/trends'
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
  const fetchers: Promise<Awaited<ReturnType<typeof fetchYouTubeTrends>>>[] = [
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
```

- [ ] **Step 2.2: Run the full test suite to confirm nothing broke**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run 2>&1 | tail -10
```

Expected: All previously passing tests still pass.

- [ ] **Step 2.3: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/app/api/cron/research/route.ts && git commit -m "feat: add Perplexity to weekly research cron (non-fatal if key absent)"
```

---

## Task 3: Instagram metrics fetcher

**Files:**
- Create: `src/lib/instagram-metrics.ts`
- Create: `src/lib/__tests__/instagram-metrics.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `src/lib/__tests__/instagram-metrics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchInstagramMetrics } from '../instagram-metrics'

describe('fetchInstagramMetrics', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns metric rows from media + insights responses', async () => {
    // First call: media list
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'media_1', media_type: 'VIDEO', timestamp: '2026-04-20T12:00:00Z', like_count: 42 },
          { id: 'media_2', media_type: 'IMAGE', timestamp: '2026-04-19T12:00:00Z', like_count: 15 },
        ],
      }),
    })
    // Second call: insights for media_1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: 'plays', total_value: { value: 1200 } },
          { name: 'reach', total_value: { value: 900 } },
          { name: 'impressions', total_value: { value: 1500 } },
          { name: 'saved', total_value: { value: 30 } },
          { name: 'shares', total_value: { value: 10 } },
        ],
      }),
    })
    // Third call: insights for media_2
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: 'impressions', total_value: { value: 400 } },
          { name: 'reach', total_value: { value: 300 } },
          { name: 'saved', total_value: { value: 5 } },
          { name: 'shares', total_value: { value: 2 } },
          { name: 'plays', total_value: { value: 0 } },
        ],
      }),
    })

    const rows = await fetchInstagramMetrics('token123', 'account456')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      views: 1200,
      likes: 42,
      saves: 30,
      shares: 10,
      impressions: 1500,
      reach: 900,
    })
    expect(rows[1]).toMatchObject({
      views: 0,
      likes: 15,
      saves: 5,
      shares: 2,
      impressions: 400,
      reach: 300,
    })
  })

  it('returns empty array when media fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const rows = await fetchInstagramMetrics('bad-token', 'account456')
    expect(rows).toEqual([])
  })

  it('skips media items whose insight fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'media_1', media_type: 'VIDEO', timestamp: '2026-04-20T12:00:00Z', like_count: 5 }],
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })

    const rows = await fetchInstagramMetrics('token123', 'account456')
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/instagram-metrics.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../instagram-metrics'`

- [ ] **Step 3.3: Create src/lib/instagram-metrics.ts**

```typescript
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

  const mediaRes = await fetch(mediaUrl.toString())
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
```

- [ ] **Step 3.4: Run tests and confirm they pass**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/instagram-metrics.test.ts 2>&1 | tail -10
```

Expected: All 3 tests PASS

- [ ] **Step 3.5: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/lib/instagram-metrics.ts src/lib/__tests__/instagram-metrics.test.ts && git commit -m "feat: add Instagram Graph API metrics fetcher"
```

---

## Task 4: Metrics cron route

**Files:**
- Create: `src/app/api/cron/metrics/route.ts`
- Modify: `vercel.json`

- [ ] **Step 4.1: Create the metrics cron route**

Create `src/app/api/cron/metrics/route.ts`:

```typescript
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
```

- [ ] **Step 4.2: Add metrics cron to vercel.json**

Replace `vercel.json` with:

```json
{
  "crons": [
    {
      "path": "/api/cron/research",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/post",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/metrics",
      "schedule": "0 8 * * *"
    }
  ]
}
```

- [ ] **Step 4.3: Run the full test suite**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run 2>&1 | tail -10
```

Expected: All previously passing tests still pass.

- [ ] **Step 4.4: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/app/api/cron/metrics/route.ts vercel.json && git commit -m "feat: add daily Instagram metrics cron (pulls Graph API → performance table)"
```

---

## Task 5: Repurpose Claude function

**Files:**
- Modify: `src/lib/claude.ts`
- Create: `src/lib/__tests__/repurpose.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `src/lib/__tests__/repurpose.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  const parseMock = vi.fn().mockResolvedValue({
    parsed_output: {
      instagram: { caption: 'Fresh caption', hashtags: ['#edit'] },
      tiktok: { caption: 'Fresh TikTok', hashtags: ['#fyp'] },
      x_thread: { tweets: ['Tweet 1', 'Tweet 2'] },
      x_video: { caption: 'Fresh X caption' },
      best_post_time: 'Tuesday at 7:00 PM',
      film_next: 'Speed ramp tutorial',
    },
    stop_reason: 'end_turn',
  })
  class MockAnthropic {
    messages = { parse: parseMock }
  }
  return { default: MockAnthropic }
})

import { generateRepurposedVariants } from '../claude'

describe('generateRepurposedVariants', () => {
  it('returns ContentVariants with all four platforms', async () => {
    const result = await generateRepurposedVariants({
      contentType: 'reel',
      originalCaption: 'Original caption about CapCut speed ramps',
      trendData: [{ topic: 'AI b-roll', source: 'perplexity' }],
    })

    expect(result.instagram.caption).toBe('Fresh caption')
    expect(result.tiktok.hashtags).toContain('#fyp')
    expect(result.x_thread.tweets).toHaveLength(2)
    expect(result.x_video.caption).toBe('Fresh X caption')
    expect(result.best_post_time).toBe('Tuesday at 7:00 PM')
    expect(result.film_next).toBe('Speed ramp tutorial')
  })

  it('works without optional trendData', async () => {
    const result = await generateRepurposedVariants({
      contentType: 'carousel',
      originalCaption: 'Original carousel about colour grading',
    })
    expect(result.instagram.caption).toBeDefined()
  })
})
```

- [ ] **Step 5.2: Run test to confirm it fails**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/repurpose.test.ts 2>&1 | tail -10
```

Expected: FAIL — `generateRepurposedVariants is not a function`

- [ ] **Step 5.3: Add RepurposeInput type and generateRepurposedVariants to claude.ts**

Add this after the `GenerateInput` interface definition and before `buildUserPrompt` in `src/lib/claude.ts`:

```typescript
export interface RepurposeInput {
  contentType: 'reel' | 'carousel'
  originalCaption: string
  trendData?: Array<Pick<NicheTrend, 'topic' | 'source'>>
}
```

Add this function at the end of `src/lib/claude.ts`, after `generateContentVariants`:

```typescript
export async function generateRepurposedVariants(
  input: RepurposeInput,
): Promise<ContentVariants> {
  const client = new Anthropic()

  const sections: string[] = [
    `## Top-performing content to repurpose`,
    `- Type: ${input.contentType === 'reel' ? 'Short-form video (Reel)' : 'Carousel'}`,
    `- Original caption: ${input.originalCaption}`,
    ``,
    `This was one of your best-performing posts. Generate fresh platform-native variants with NEW hooks — same topic, completely different angle and opening line. Do not reuse any phrases from the original caption.`,
  ]

  if (input.trendData && input.trendData.length > 0) {
    const trends = input.trendData
      .slice(0, 10)
      .map((t) => `- ${t.topic} (${t.source})`)
      .join('\n')
    sections.push(`\n## Current trending topics in the niche\n${trends}`)
  }

  sections.push('\nGenerate all four platform variants plus timing and film-next recommendation.')

  const response = await client.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: sections.join('\n') }],
    output_config: {
      format: zodOutputFormat(ContentVariantsSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error(`Claude returned no parsed output. Stop reason: ${response.stop_reason}`)
  }

  return response.parsed_output
}
```

- [ ] **Step 5.4: Run tests and confirm they pass**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/repurpose.test.ts 2>&1 | tail -10
```

Expected: Both tests PASS

- [ ] **Step 5.5: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/lib/claude.ts src/lib/__tests__/repurpose.test.ts && git commit -m "feat: add generateRepurposedVariants to Claude client"
```

---

## Task 6: Repurpose API route

**Files:**
- Create: `src/app/api/repurpose/route.ts`

- [ ] **Step 6.1: Create the repurpose route**

Create `src/app/api/repurpose/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateRepurposedVariants } from '@/lib/claude'

export async function POST() {
  const supabase = createServiceClient()

  // ── Get top 3 most recent published posts ─────────────────────────────────
  const { data: posts } = await supabase
    .from('posts')
    .select('id, type, drive_url')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!posts || posts.length === 0) {
    return NextResponse.json({ repurposed: 0, message: 'No published posts to repurpose' })
  }

  // ── Fetch variants for each post ──────────────────────────────────────────
  const { data: allVariants } = await supabase
    .from('post_variants')
    .select('post_id, platform, caption')
    .in('post_id', posts.map((p) => p.id))

  // ── Fetch recent trend data for context ───────────────────────────────────
  const { data: trends } = await supabase
    .from('niche_trends')
    .select('topic, source')
    .order('fetched_at', { ascending: false })
    .limit(10)

  // ── Repurpose each post ───────────────────────────────────────────────────
  let repurposed = 0

  for (const post of posts) {
    const variants = allVariants?.filter((v) => v.post_id === post.id) ?? []
    const igVariant = variants.find((v) => v.platform === 'instagram')

    if (!igVariant?.caption) {
      console.warn(`[repurpose] No instagram caption for post ${post.id} — skipping`)
      continue
    }

    try {
      const newVariants = await generateRepurposedVariants({
        contentType: post.type as 'reel' | 'carousel',
        originalCaption: igVariant.caption,
        trendData: trends ?? [],
      })

      const { data: newPost } = await supabase
        .from('posts')
        .insert({ status: 'pending_review', type: post.type, drive_url: post.drive_url })
        .select()
        .single()

      if (!newPost) {
        console.error('[repurpose] Failed to create new post record')
        continue
      }

      await supabase.from('post_variants').insert([
        {
          post_id: newPost.id,
          platform: 'instagram',
          caption: newVariants.instagram.caption,
          hashtags: newVariants.instagram.hashtags,
        },
        {
          post_id: newPost.id,
          platform: 'tiktok',
          caption: newVariants.tiktok.caption,
          hashtags: newVariants.tiktok.hashtags,
        },
        {
          post_id: newPost.id,
          platform: 'x_thread',
          caption: newVariants.x_thread.tweets.join('\n\n---\n\n'),
          hashtags: [],
        },
        {
          post_id: newPost.id,
          platform: 'x_video',
          caption: newVariants.x_video.caption,
          hashtags: [],
        },
      ])

      repurposed++
    } catch (err) {
      console.error(`[repurpose] Failed for post ${post.id}:`, err)
    }
  }

  return NextResponse.json({ repurposed })
}
```

- [ ] **Step 6.2: Run the full test suite**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 6.3: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/app/api/repurpose/route.ts && git commit -m "feat: add POST /api/repurpose — repurposes top published posts via Claude"
```

---

## Task 7: Dashboard repurpose button

**Files:**
- Create: `src/components/repurpose-button.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 7.1: Create the RepurposeButton client component**

Create `src/components/repurpose-button.tsx`:

```tsx
'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'done' | 'error'

export function RepurposeButton() {
  const [state, setState] = useState<State>('idle')
  const [count, setCount] = useState(0)

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/repurpose', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { repurposed: number } = await res.json()
      setCount(data.repurposed)
      setState('done')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return (
      <span className="text-sm text-violet-400 font-medium">
        {count} post{count !== 1 ? 's' : ''} queued
      </span>
    )
  }

  if (state === 'error') {
    return <span className="text-sm text-red-400">Failed — try again</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-300 disabled:opacity-50"
    >
      {state === 'loading' ? (
        <>
          <svg
            className="animate-spin"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Working…
        </>
      ) : (
        'Repurpose Top'
      )}
    </button>
  )
}
```

- [ ] **Step 7.2: Add RepurposeButton to the dashboard header**

In `src/app/page.tsx`, add the import at the top with the other imports:

```typescript
import { RepurposeButton } from '@/components/repurpose-button'
```

In the header `<div className="flex items-center justify-between">` section, add `<RepurposeButton />` between the `<PushBell />` and `<Link href="/new">` elements:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xl font-bold">Dashboard</h1>
  <div className="flex items-center gap-2">
    <PushBell />
    <RepurposeButton />
    <Link
      href="/new"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium text-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      New Post
    </Link>
  </div>
</div>
```

- [ ] **Step 7.3: Run the full test suite**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 7.4: Start dev server and verify the button renders**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npm run dev 2>&1 &
```

Open `http://localhost:3000` and confirm:
- "Repurpose Top" button appears in the header between the bell and "New Post"
- Button shows spinner while loading
- Button shows "X posts queued" on success (requires published posts in DB)
- Button shows "Failed — try again" for 3s on error, then resets

- [ ] **Step 7.5: Stop dev server and commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && kill %1 && git add src/components/repurpose-button.tsx src/app/page.tsx && git commit -m "feat: add Repurpose Top Posts button to dashboard"
```

---

## Task 8: Push to Vercel and add env vars

- [ ] **Step 8.1: Push to master**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git push origin master
```

- [ ] **Step 8.2: Set PERPLEXITY_API_KEY in Vercel**

In Vercel dashboard → Project → Settings → Environment Variables, add:
- `PERPLEXITY_API_KEY` — your Perplexity API key (get from [perplexity.ai/settings/api](https://perplexity.ai/settings/api))

Once Instagram keys are available, also add:
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

- [ ] **Step 8.3: Trigger the research cron manually to verify Perplexity works**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-vercel-domain>/api/cron/research
```

Expected response: `{"inserted": N}` where N includes Perplexity topics alongside YouTube/Reddit ones.

---

## Final test count check

After all tasks, run:

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run 2>&1 | grep -E "Tests|passed|failed"
```

Expected: ~40+ tests passing (was 30 before this plan — adds ~10 new tests across 3 new test files/additions).
