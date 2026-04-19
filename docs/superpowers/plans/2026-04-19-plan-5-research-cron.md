# Plan 5: Research Tab + Weekly Spy Cron

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly Vercel cron that fetches trending video-editing content from YouTube and Reddit, scores and enriches it with Claude, stores results in `niche_trends`, and displays them on a new Research tab.

**Architecture:** Vercel cron fires weekly → `/api/cron/research` fetches YouTube Data API v3 + Reddit public JSON in parallel → Claude scores all raw topics and generates 3–5 original emerging topics → results upserted into `niche_trends` (old rows pruned). `/research` page is a server component that reads `niche_trends` ordered by score and renders a card feed with source badges.

**Tech Stack:** Next.js App Router, Vercel Cron, YouTube Data API v3 (existing `YOUTUBE_API_KEY`), Reddit public JSON API (no auth), Anthropic SDK `claude-sonnet-4-6` with cached system prompt + Zod structured output, Supabase service role client, Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/trends.ts` | Create | YouTube + Reddit fetchers, Claude scorer, shared types |
| `src/app/api/cron/research/route.ts` | Create | Vercel cron handler — orchestrate fetch → score → insert → prune |
| `src/app/research/page.tsx` | Create | Research tab — server component reading `niche_trends` |
| `src/components/nav.tsx` | Modify | Add Research nav item |
| `vercel.json` | Modify | Register weekly cron (`0 9 * * 1`) |
| `src/lib/__tests__/trends.test.ts` | Create | Unit tests for fetchers + scorer + schema |

---

### Task 1: Trend fetchers + Claude scorer (`src/lib/trends.ts`)

**Files:**
- Create: `src/lib/trends.ts`
- Create: `src/lib/__tests__/trends.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/trends.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchYouTubeTrends, fetchRedditTrends, scoreTrendsWithClaude, TrendScoringSchema } from '../trends'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      parse: vi.fn().mockResolvedValue({
        parsed_output: {
          scored_topics: [
            { topic: 'CapCut speed ramp tutorial', score: 88, source: 'youtube' },
            { topic: 'My best color grade yet', score: 61, source: 'reddit' },
          ],
          claude_topics: [
            { topic: 'AI b-roll generation for solo creators', score: 93, rationale: 'Underserved gap between AI tools and editing workflow' },
          ],
        },
        stop_reason: 'end_turn',
      }),
    },
  })),
}))

describe('fetchYouTubeTrends', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns RawTrend array from YouTube search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: { videoId: 'abc123' }, snippet: { title: 'CapCut speed ramp tutorial', channelTitle: 'EditPro' } },
          { id: { videoId: 'def456' }, snippet: { title: 'Premiere Pro color grade 2025', channelTitle: 'VideoSchool' } },
        ],
      }),
    })

    const topics = await fetchYouTubeTrends('test-key')
    expect(topics).toHaveLength(2)
    expect(topics[0]).toMatchObject({
      topic: 'CapCut speed ramp tutorial',
      source: 'youtube',
      raw_data: { videoId: 'abc123', channelTitle: 'EditPro' },
    })
  })

  it('returns empty array when API responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    const topics = await fetchYouTubeTrends('bad-key')
    expect(topics).toEqual([])
  })

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'))
    const topics = await fetchYouTubeTrends('any-key')
    expect(topics).toEqual([])
  })
})

describe('fetchRedditTrends', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns RawTrend array from Reddit hot posts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [
            { data: { title: 'My best color grade yet', ups: 420, num_comments: 34, permalink: '/r/videoediting/comments/abc' } },
          ],
        },
      }),
    })

    const topics = await fetchRedditTrends()
    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0]).toMatchObject({
      source: 'reddit',
      raw_data: expect.objectContaining({ ups: expect.any(Number) }),
    })
  })

  it('skips subreddits that return non-ok responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 })
    const topics = await fetchRedditTrends()
    expect(topics).toEqual([])
  })
})

describe('scoreTrendsWithClaude', () => {
  it('returns scored_topics and claude_topics with correct shapes', async () => {
    const raw = [
      { topic: 'CapCut speed ramp tutorial', source: 'youtube' as const, raw_data: { videoId: 'abc123' } },
      { topic: 'My best color grade yet', source: 'reddit' as const, raw_data: { ups: 420 } },
    ]

    const result = await scoreTrendsWithClaude(raw)
    expect(result.scored_topics).toHaveLength(2)
    expect(result.claude_topics).toHaveLength(1)
    expect(result.scored_topics[0].score).toBe(88)
    expect(result.claude_topics[0].source).toBe('claude')
    expect(result.claude_topics[0].raw_data).toMatchObject({ rationale: expect.any(String) })
  })
})

describe('TrendScoringSchema', () => {
  it('validates correctly shaped output', () => {
    const result = TrendScoringSchema.safeParse({
      scored_topics: [{ topic: 'Test', score: 75, source: 'youtube' }],
      claude_topics: [{ topic: 'Gap', score: 90, rationale: 'Underserved' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects score outside 0–100', () => {
    const result = TrendScoringSchema.safeParse({
      scored_topics: [{ topic: 'Test', score: 150, source: 'youtube' }],
      claude_topics: [],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/trends.test.ts
```

Expected: FAIL — `Cannot find module '../trends'`

- [ ] **Step 3: Implement `src/lib/trends.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run src/lib/__tests__/trends.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/lib/trends.ts src/lib/__tests__/trends.test.ts && git commit -m "feat: add YouTube + Reddit trend fetchers and Claude scorer"
```

---

### Task 2: Weekly cron handler (`src/app/api/cron/research/route.ts`)

**Files:**
- Create: `src/app/api/cron/research/route.ts`

- [ ] **Step 1: Implement the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchYouTubeTrends, fetchRedditTrends, scoreTrendsWithClaude } from '@/lib/trends'

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
  const [youtube, reddit] = await Promise.all([
    fetchYouTubeTrends(youtubeKey),
    fetchRedditTrends(),
  ])

  const raw = [...youtube, ...reddit]

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
    raw_data: t.raw_data,
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

- [ ] **Step 2: Verify the route file exists and TypeScript is clean**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/app/api/cron/research/route.ts && git commit -m "feat: add weekly research cron handler"
```

---

### Task 3: Register the cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the weekly cron schedule**

Current `vercel.json`:
```json
{
  "crons": []
}
```

Replace with:
```json
{
  "crons": [
    {
      "path": "/api/cron/research",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

`0 9 * * 1` = every Monday at 09:00 UTC.

- [ ] **Step 2: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add vercel.json && git commit -m "feat: register weekly research cron in vercel.json"
```

---

### Task 4: Research tab UI (`src/app/research/page.tsx`)

**Files:**
- Create: `src/app/research/page.tsx`

- [ ] **Step 1: Implement the research page**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { NicheTrend } from '@/lib/supabase/types'

export const revalidate = 0

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  claude: 'AI Pick',
  tiktok: 'TikTok',
  google_trends: 'Google',
}

const SOURCE_COLOR: Record<string, string> = {
  youtube: 'bg-red-950 text-red-400 border-red-900',
  reddit: 'bg-orange-950 text-orange-400 border-orange-900',
  claude: 'bg-violet-950 text-violet-400 border-violet-900',
  tiktok: 'bg-sky-950 text-sky-400 border-sky-900',
  google_trends: 'bg-blue-950 text-blue-400 border-blue-900',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-zinc-500'
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>
}

function TrendCard({ trend }: { trend: NicheTrend }) {
  const sourceLabel = SOURCE_LABEL[trend.source] ?? trend.source
  const sourceColor = SOURCE_COLOR[trend.source] ?? 'bg-zinc-900 text-zinc-400 border-zinc-800'

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug">{trend.topic}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sourceColor}`}>
            {sourceLabel}
          </span>
        </div>
      </div>
      <ScoreBadge score={trend.score} />
    </div>
  )
}

export default async function ResearchPage() {
  const supabase = await createClient()

  const { data: trends } = await supabase
    .from('niche_trends')
    .select('*')
    .order('score', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(60)

  const all = trends ?? []
  const lastFetched = all[0]?.fetched_at
    ? new Date(all[0].fetched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const aiPicks = all.filter((t) => t.source === 'claude')
  const external = all.filter((t) => t.source !== 'claude')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Research</h1>
          {lastFetched && (
            <p className="text-xs text-zinc-500 mt-0.5">Updated {lastFetched}</p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {all.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-zinc-500 text-sm">No trend data yet.</p>
          <p className="text-zinc-600 text-xs">The weekly cron runs every Monday at 9:00 AM UTC.</p>
        </div>
      )}

      {/* AI Picks */}
      {aiPicks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            AI Picks — Emerging Gaps
          </h2>
          <div className="space-y-2">
            {aiPicks.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {/* External trends */}
      {external.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Trending Now
          </h2>
          <div className="space-y-2">
            {external.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/app/research/page.tsx && git commit -m "feat: add Research tab UI"
```

---

### Task 5: Add Research to nav (`src/components/nav.tsx`)

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Add the Research nav item**

In `src/components/nav.tsx`, replace the `NAV_ITEMS` array:

```typescript
const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/new',
    label: 'New Post',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: '/research',
    label: 'Research',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    ),
  },
]
```

- [ ] **Step 2: Run all tests to check for regressions**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && npx vitest run
```

Expected: all 30+ tests still PASS

- [ ] **Step 3: Commit and push**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism && git add src/components/nav.tsx && git commit -m "feat: add Research tab to nav" && git push
```

Push triggers Vercel deploy. After deploy: open the app, tap Research in the nav — should show the empty state (no trends yet since cron hasn't run).

---

## Verification

After all tasks complete:

1. **TypeScript clean:** `npx tsc --noEmit` — no new errors
2. **Tests pass:** `npx vitest run` — all tests green (was 30, now ~38+)
3. **Nav:** Research tab appears between New Post and Settings
4. **Research page:** loads at `/research`, shows empty state with cron schedule note
5. **Cron registered:** `vercel.json` has the `0 9 * * 1` schedule; visible in Vercel dashboard → Cron Jobs after deploy
6. **Manual trigger test (optional):** Hit `GET /api/cron/research` with `Authorization: Bearer <CRON_SECRET>` header in Postman — should return `{ inserted: N }`
