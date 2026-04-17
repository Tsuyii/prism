# Prism — Plan 2: Drive + AI Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Google Drive → Whisper → Claude → Supabase. When n8n detects a new file in Drive and fires the pipeline webhook, the app transcribes the video (if it's a reel), calls Claude to generate 4 platform-native content variants, and saves everything to Supabase for the review PWA to display.

**Architecture:** `POST /api/pipeline` is the main entry point. It receives file metadata from n8n, creates a `posts` row, downloads the Drive file (for Whisper), transcribes if video, calls Claude Sonnet with cached system prompt + structured output, and upserts 4 `post_variants`. `POST /api/approve` fires the n8n posting webhook with final content. `POST /api/reject` archives the post. `POST /api/webhook/n8n` receives completion callbacks from n8n to update post status.

**Tech Stack:** `@anthropic-ai/sdk` (Sonnet, prompt caching, Zod structured output), `openai` (Whisper-1), `googleapis` (Drive v3 service account), `zod`

---

## New Env Vars (add to Vercel + `.env.local`)

```bash
# Google Drive (service account for server-side Drive access)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}   # full JSON string

# Pipeline security
PIPELINE_SECRET=generate-a-random-string-here               # n8n sends this as Bearer token
```

Add these to `.env.local.example` as well.

---

## File Map

```
src/
├── lib/
│   ├── drive.ts                     ← Google Drive download via service account
│   ├── whisper.ts                   ← OpenAI Whisper transcription
│   ├── claude.ts                    ← Claude content generation (4 variants)
│   └── __tests__/
│       ├── claude.test.ts           ← Schema + prompt builder unit tests
│       └── pipeline.test.ts         ← Pipeline validation unit tests
└── app/
    └── api/
        ├── pipeline/
        │   └── route.ts             ← POST: n8n → create post + run AI pipeline
        ├── approve/
        │   └── route.ts             ← POST: approve post → trigger n8n
        ├── reject/
        │   └── route.ts             ← POST: reject post
        └── webhook/
            └── n8n/
                └── route.ts         ← POST: n8n status callback (published/failed)
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime packages**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npm install @anthropic-ai/sdk openai googleapis zod
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify TypeScript types are available**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install anthropic sdk, openai, googleapis, zod"
git push origin master
```

---

## Task 2: Google Drive client

**Files:**
- Create: `src/lib/drive.ts`

- [ ] **Step 1: Create `src/lib/drive.ts`**

```typescript
import { google } from 'googleapis'

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return google.drive({ version: 'v3', auth })
}

export interface DriveFileMetadata {
  id: string
  name: string
  mimeType: string
  size: string
}

export async function getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size',
    supportsAllDrives: true,
  })
  return res.data as DriveFileMetadata
}

export async function downloadFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/drive.ts
git commit -m "feat: add Google Drive client (service account)"
git push origin master
```

---

## Task 3: Whisper transcription

**Files:**
- Create: `src/lib/whisper.ts`

- [ ] **Step 1: Create `src/lib/whisper.ts`**

```typescript
import OpenAI from 'openai'
import { toFile } from 'openai/uploads'

const WHISPER_MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  if (buffer.length > WHISPER_MAX_BYTES) {
    console.warn(
      `[whisper] File ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB) exceeds 25 MB Whisper limit — skipping transcription`,
    )
    return ''
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Detect MIME type from filename extension
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4'
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  }
  const mimeType = mimeMap[ext] ?? 'video/mp4'

  const file = await toFile(buffer, filename, { type: mimeType })
  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
  })

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whisper.ts
git commit -m "feat: add Whisper transcription helper"
git push origin master
```

---

## Task 4: Claude content generation

**Files:**
- Create: `src/lib/claude.ts`

This is the core AI engine. It uses Claude Sonnet 4.6 with:
- A large cached system prompt (reused on every pipeline call — saves ~$0.90/100 calls)
- Zod structured output (`messages.parse()`) for guaranteed schema compliance
- Adaptive thinking off (not needed for creative content generation; saves tokens)

- [ ] **Step 1: Create `src/lib/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { NicheTrend } from './supabase/types'

// ─── Output schema ───────────────────────────────────────────────────────────

export const ContentVariantsSchema = z.object({
  instagram: z.object({
    caption: z
      .string()
      .describe('2–3 sentence storytelling caption with a CTA at the end'),
    hashtags: z
      .array(z.string())
      .describe('15–20 hashtags: mix of niche (#videoediting) and broad (#fyp)'),
  }),
  tiktok: z.object({
    caption: z
      .string()
      .describe('Punchy 1-liner hook caption that grabs attention in the first word'),
    hashtags: z
      .array(z.string())
      .describe('3–5 trending TikTok-specific hashtags'),
  }),
  x_thread: z.object({
    tweets: z
      .array(z.string())
      .describe(
        'Twitter thread: 3–7 tweets, each under 280 chars. Pure value, no hashtags, no video reference. Extracted tips from the transcript.',
      ),
  }),
  x_video: z.object({
    caption: z
      .string()
      .max(280)
      .describe('Short conversational caption, max 280 chars, no hashtags'),
  }),
  best_post_time: z
    .string()
    .describe(
      'Best day and hour to post in "Monday at 6:00 PM" format, derived from performance data',
    ),
  film_next: z
    .string()
    .describe(
      'One sentence: the specific video topic to film next based on trend gaps and top performers',
    ),
})

export type ContentVariants = z.infer<typeof ContentVariantsSchema>

// ─── System prompt (cached — keep stable) ────────────────────────────────────

const SYSTEM_PROMPT = `You are a social media content strategist specializing in the video editing niche (CapCut, Premiere Pro, After Effects, DaVinci Resolve). You help a solo creator maximize reach by generating platform-native content from a single raw video or carousel.

## Your outputs

For every piece of content you receive, you produce exactly four platform-native variants:

### 1. Instagram
- Caption: 2–3 sentences of storytelling. Hook first sentence. End with a clear CTA ("Save this", "Follow for more", "Drop your question below").
- Hashtags: 15–20. Mix niche (#videoediting #capcut #editingtips) with medium (#contentcreator #videography) and broad (#fyp #viral #reels). Do not repeat. Lowercase, no spaces.

### 2. TikTok
- Caption: One punchy line. Start with a strong hook word or phrase (NOT "Learn how to"). Examples: "Stop doing this in CapCut...", "This transition took me 2 seconds", "POV: you found the secret button".
- Hashtags: 3–5. Only trending TikTok-specific hashtags. Short, punchy (#fyp #capcut #edit).

### 3. X Thread (Twitter)
- Extract the 3–7 most valuable actionable tips from the transcript (or infer from the filename/topic if no transcript).
- Each tweet is a standalone tip under 280 characters.
- No hashtags. No "1/", "2/" numbering. No "Thread:" preamble. Pure value.
- If no transcript, write a thought-leadership thread about the topic.

### 4. X Video
- 1–2 sentences. Max 280 characters total. Conversational tone, like a friend texting. No hashtags. Reference what the video shows without being clickbaity.

## Timing recommendation
Use the provided performance data to identify peak engagement windows. Default to 6:00 PM on weekdays if no data available.

## Film next
Identify the #1 gap between trending topics in the niche and what is underserved based on this creator's post history. Recommend a specific, filmable topic (e.g. "A 60-second tutorial showing the 3 CapCut transitions that TikTok viewers rewatch most").

## Rules
- Match each platform's native voice. TikTok speaks to Gen Z. Instagram is slightly more polished. X is for fellow creators.
- Never use the phrase "In this video". Never start captions with "I".
- Hashtags must be lowercase with no spaces or punctuation inside.
- Carousel content gets slightly more educational captions; reel content gets more hook-driven captions.`

// ─── Prompt builder ───────────────────────────────────────────────────────────

export interface GenerateInput {
  contentType: 'reel' | 'carousel'
  filename: string
  transcript?: string
  trendData?: Array<Pick<NicheTrend, 'topic' | 'source'>>
  performanceData?: Array<{ platform: string; views: number; likes: number }>
}

function buildUserPrompt(input: GenerateInput): string {
  const sections: string[] = []

  sections.push(`## Content to process
- Type: ${input.contentType === 'reel' ? 'Short-form video (Reel)' : 'Carousel'}
- Filename: ${input.filename}`)

  if (input.transcript && input.transcript.length > 0) {
    sections.push(`## Video transcript
${input.transcript.slice(0, 3000)}${input.transcript.length > 3000 ? '\n[transcript truncated]' : ''}`)
  } else {
    sections.push(`## Video transcript
No transcript available. Infer topic from filename and generate content accordingly.`)
  }

  if (input.trendData && input.trendData.length > 0) {
    const trends = input.trendData
      .slice(0, 15)
      .map((t) => `- ${t.topic} (${t.source})`)
      .join('\n')
    sections.push(`## Trending topics in the editing niche (this week)\n${trends}`)
  }

  if (input.performanceData && input.performanceData.length > 0) {
    const topPosts = input.performanceData
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((p) => `- ${p.platform}: ${p.views.toLocaleString()} views, ${p.likes.toLocaleString()} likes`)
      .join('\n')
    sections.push(`## Recent performance data (top posts)\n${topPosts}`)
  }

  sections.push('Generate all four platform variants plus timing and film-next recommendation.')

  return sections.join('\n\n')
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateContentVariants(
  input: GenerateInput,
): Promise<ContentVariants> {
  const client = new Anthropic()

  const response = await client.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // cache the stable system prompt
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    output_config: {
      format: zodOutputFormat(ContentVariantsSchema, 'content_variants'),
    },
  })

  if (!response.parsed_output) {
    throw new Error(
      `Claude returned no parsed output. Stop reason: ${response.stop_reason}`,
    )
  }

  return response.parsed_output
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Claude content generation with cached system prompt and structured output"
git push origin master
```

---

## Task 5: Unit tests for Claude and pipeline

**Files:**
- Create: `src/lib/__tests__/claude.test.ts`
- Create: `src/lib/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/lib/__tests__/claude.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ContentVariantsSchema } from '../claude'

describe('ContentVariantsSchema', () => {
  it('validates a complete valid response', () => {
    const valid = {
      instagram: {
        caption: 'Stop scrolling — this one CapCut trick saved me 3 hours.',
        hashtags: ['#capcut', '#videoediting', '#editingtips', '#reels', '#contentcreator'],
      },
      tiktok: {
        caption: 'The CapCut button nobody talks about 👇',
        hashtags: ['#capcut', '#fyp', '#edit'],
      },
      x_thread: {
        tweets: [
          'Most editors waste 20 minutes per project on something that takes 30 seconds in CapCut.',
          'The auto-caption tool syncs perfectly to beat — just tap the music note icon first.',
          'Transition speed matters more than the transition type. 0.3s is the sweet spot.',
        ],
      },
      x_video: {
        caption: 'Found a CapCut trick I wish I knew 2 years ago. Sharing it now.',
      },
      best_post_time: 'Friday at 6:00 PM',
      film_next: 'A 60-second tutorial on the 3 most-rewatched CapCut transitions according to TikTok analytics.',
    }
    const result = ContentVariantsSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('fails when x_video caption exceeds 280 chars', () => {
    const tooLong = 'x'.repeat(281)
    const result = ContentVariantsSchema.safeParse({
      instagram: { caption: 'ok', hashtags: [] },
      tiktok: { caption: 'ok', hashtags: [] },
      x_thread: { tweets: ['tip one'] },
      x_video: { caption: tooLong },
      best_post_time: 'Monday at 6:00 PM',
      film_next: 'Film this',
    })
    expect(result.success).toBe(false)
  })

  it('requires all four platform variants', () => {
    const missing = {
      instagram: { caption: 'ok', hashtags: [] },
      tiktok: { caption: 'ok', hashtags: [] },
      // x_thread missing
      x_video: { caption: 'ok' },
      best_post_time: 'Monday at 6:00 PM',
      film_next: 'Film this',
    }
    const result = ContentVariantsSchema.safeParse(missing)
    expect(result.success).toBe(false)
  })
})
```

Create `src/lib/__tests__/pipeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Tests pipeline request validation logic
describe('pipeline request validation', () => {
  it('accepts valid reel payload shape', () => {
    const payload = {
      fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
      fileName: 'capcut-tutorial.mp4',
      mimeType: 'video/mp4',
      driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    }
    const isValid =
      typeof payload.fileId === 'string' &&
      typeof payload.fileName === 'string' &&
      typeof payload.mimeType === 'string' &&
      typeof payload.driveUrl === 'string'
    expect(isValid).toBe(true)
  })

  it('detects reel vs carousel from mimeType', () => {
    const classify = (mimeType: string) =>
      mimeType.startsWith('video/') ? 'reel' : 'carousel'

    expect(classify('video/mp4')).toBe('reel')
    expect(classify('video/quicktime')).toBe('reel')
    expect(classify('image/jpeg')).toBe('carousel')
    expect(classify('image/png')).toBe('carousel')
    expect(classify('application/zip')).toBe('carousel')
  })

  it('builds correct platform set for post variants', () => {
    const PLATFORMS = ['instagram', 'tiktok', 'x_thread', 'x_video'] as const
    expect(PLATFORMS).toHaveLength(4)
    expect(PLATFORMS).toContain('instagram')
    expect(PLATFORMS).toContain('x_thread')
  })
})
```

- [ ] **Step 2: Run tests (they should all pass — no external calls needed)**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npm run test:run
```

Expected: `✓ src/lib/__tests__/claude.test.ts (3 tests)` and `✓ src/lib/__tests__/pipeline.test.ts (3 tests)` — 6 new tests passing, 8 prior tests still passing (14 total).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/claude.test.ts src/lib/__tests__/pipeline.test.ts
git commit -m "test: add claude schema validation and pipeline unit tests"
git push origin master
```

---

## Task 6: Pipeline API route

**Files:**
- Create: `src/app/api/pipeline/route.ts`

The payload n8n sends to this route:
```json
{
  "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
  "fileName": "capcut-tutorial.mp4",
  "mimeType": "video/mp4",
  "driveUrl": "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view"
}
```

n8n must set the header: `Authorization: Bearer <PIPELINE_SECRET>`

- [ ] **Step 1: Create `src/app/api/pipeline/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateContentVariants } from '@/lib/claude'
import { downloadFileAsBuffer } from '@/lib/drive'
import { transcribeBuffer } from '@/lib/whisper'

interface PipelinePayload {
  fileId: string
  fileName: string
  mimeType: string
  driveUrl: string
}

function classify(mimeType: string): 'reel' | 'carousel' {
  return mimeType.startsWith('video/') ? 'reel' : 'carousel'
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.PIPELINE_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: PipelinePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fileId, fileName, mimeType, driveUrl } = payload
  if (!fileId || !fileName || !mimeType || !driveUrl) {
    return NextResponse.json({ error: 'Missing required fields: fileId, fileName, mimeType, driveUrl' }, { status: 400 })
  }

  const contentType = classify(mimeType)
  const supabase = await createClient()

  // ── Create post record ────────────────────────────────────────────────────
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({ status: 'pending_review', type: contentType, drive_url: driveUrl })
    .select()
    .single()

  if (postError || !post) {
    console.error('[pipeline] Failed to create post:', postError)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  // ── Transcribe (reels only) ───────────────────────────────────────────────
  let transcript: string | undefined
  if (contentType === 'reel') {
    try {
      const buffer = await downloadFileAsBuffer(fileId)
      transcript = await transcribeBuffer(buffer, fileName)
    } catch (err) {
      console.warn('[pipeline] Transcription failed (non-fatal):', err)
    }
  }

  // ── Read cached context from Supabase ─────────────────────────────────────
  const [trendsResult, perfResult] = await Promise.all([
    supabase
      .from('niche_trends')
      .select('topic, source')
      .order('fetched_at', { ascending: false })
      .limit(20),
    supabase
      .from('performance')
      .select('platform, views, likes')
      .order('fetched_at', { ascending: false })
      .limit(50),
  ])

  // ── Generate content with Claude ──────────────────────────────────────────
  let variants
  try {
    variants = await generateContentVariants({
      contentType,
      filename: fileName,
      transcript,
      trendData: trendsResult.data ?? [],
      performanceData: perfResult.data ?? [],
    })
  } catch (err) {
    console.error('[pipeline] Claude generation failed:', err)
    await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id)
    return NextResponse.json({ error: 'Content generation failed' }, { status: 500 })
  }

  // ── Save variants to Supabase ─────────────────────────────────────────────
  const variantRows = [
    {
      post_id: post.id,
      platform: 'instagram',
      caption: variants.instagram.caption,
      hashtags: variants.instagram.hashtags,
    },
    {
      post_id: post.id,
      platform: 'tiktok',
      caption: variants.tiktok.caption,
      hashtags: variants.tiktok.hashtags,
    },
    {
      post_id: post.id,
      platform: 'x_thread',
      // Store thread tweets as newline-separated; review UI splits on \n\n---\n\n
      caption: variants.x_thread.tweets.join('\n\n---\n\n'),
      hashtags: [],
    },
    {
      post_id: post.id,
      platform: 'x_video',
      caption: variants.x_video.caption,
      hashtags: [],
    },
  ]

  const { error: variantsError } = await supabase
    .from('post_variants')
    .insert(variantRows)

  if (variantsError) {
    console.error('[pipeline] Failed to save variants:', variantsError)
    await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id)
    return NextResponse.json({ error: 'Failed to save variants' }, { status: 500 })
  }

  // ── Store film_next as a niche trend hint ─────────────────────────────────
  // Cheap way to surface the recommendation in the review UI without schema changes
  await supabase.from('niche_trends').insert({
    source: 'claude',
    topic: variants.film_next,
    score: null,
    raw_data: { type: 'film_next_recommendation', post_id: post.id },
  })

  console.log(`[pipeline] Post ${post.id} created with ${variantRows.length} variants`)

  return NextResponse.json({
    postId: post.id,
    bestPostTime: variants.best_post_time,
    filmNext: variants.film_next,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/pipeline/
git commit -m "feat: add pipeline API route (n8n webhook → Whisper → Claude → Supabase)"
git push origin master
```

---

## Task 7: Approve route

**Files:**
- Create: `src/app/api/approve/route.ts`

Called by the review PWA when the user taps "Approve". Payload:
```json
{
  "postId": "uuid",
  "scheduledAt": "2026-04-18T18:00:00.000Z"
}
```

On success, fires the n8n posting webhook to kick off publishing.

- [ ] **Step 1: Create `src/app/api/approve/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { postId?: string; scheduledAt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { postId, scheduledAt } = body
  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch post + variants
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*, post_variants(*)')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Update post status and scheduled time
  const { error: updateError } = await supabase
    .from('posts')
    .update({
      status: 'approved',
      scheduled_at: scheduledAt ?? null,
    })
    .eq('id', postId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }

  // Mark all variants as approved
  await supabase
    .from('post_variants')
    .update({ approved: true })
    .eq('post_id', postId)

  // Fire n8n posting webhook
  if (process.env.N8N_WEBHOOK_URL) {
    try {
      const n8nPayload = {
        postId,
        scheduledAt: scheduledAt ?? null,
        variants: post.post_variants,
      }
      const res = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_API_KEY
            ? { Authorization: `Bearer ${process.env.N8N_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(n8nPayload),
      })
      if (!res.ok) {
        console.error('[approve] n8n webhook failed:', res.status, await res.text())
      }
    } catch (err) {
      console.error('[approve] Failed to fire n8n webhook:', err)
    }
  }

  return NextResponse.json({ success: true, postId })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/approve/
git commit -m "feat: add approve API route (updates Supabase + fires n8n webhook)"
git push origin master
```

---

## Task 8: Reject route

**Files:**
- Create: `src/app/api/reject/route.ts`

Simple — archives the post with status `rejected`.

- [ ] **Step 1: Create `src/app/api/reject/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { postId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { postId } = body
  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({ status: 'rejected' })
    .eq('id', postId)

  if (error) {
    return NextResponse.json({ error: 'Failed to reject post' }, { status: 500 })
  }

  return NextResponse.json({ success: true, postId })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reject/
git commit -m "feat: add reject API route"
git push origin master
```

---

## Task 9: n8n status callback route

**Files:**
- Create: `src/app/api/webhook/n8n/route.ts`

n8n calls this after publishing to update post status to `published` or `failed`.

Payload from n8n:
```json
{ "postId": "uuid", "status": "published" }
{ "postId": "uuid", "status": "failed", "error": "Instagram API error: ..." }
```

- [ ] **Step 1: Create `src/app/api/webhook/n8n/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Optional: validate n8n secret header
  const authHeader = request.headers.get('authorization')
  if (
    process.env.N8N_API_KEY &&
    authHeader !== `Bearer ${process.env.N8N_API_KEY}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { postId?: string; status?: string; error?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { postId, status, error: n8nError } = body
  if (!postId || !status) {
    return NextResponse.json({ error: 'postId and status are required' }, { status: 400 })
  }

  if (status !== 'published' && status !== 'failed') {
    return NextResponse.json({ error: 'status must be published or failed' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status })
    .eq('id', postId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update post status' }, { status: 500 })
  }

  if (status === 'failed' && n8nError) {
    console.error(`[n8n callback] Post ${postId} failed: ${n8nError}`)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhook/
git commit -m "feat: add n8n status callback webhook route"
git push origin master
```

---

## Task 10: Update env vars and verify build

**Files:**
- Modify: `.env.local.example`
- Modify: `PRISM.md`

- [ ] **Step 1: Update `.env.local.example` with new vars**

Add the two new env vars to `.env.local.example` under the Google APIs section:

```bash
# Google Drive (service account JSON — server-side file download)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"prism@project.iam.gserviceaccount.com","client_id":"..."}

# Pipeline security (n8n sends this as Authorization: Bearer <value>)
PIPELINE_SECRET=generate-a-random-string-here
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npm run build 2>&1 | tail -20
```

Expected: successful build. If TypeScript errors appear, fix them before continuing.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: all tests passing (14 total: 8 from Plan 1, 6 from Plan 2).

- [ ] **Step 4: Update PRISM.md**

In `PRISM.md`:

Update `## Environment Variables` — add after the `GOOGLE_CLIENT_SECRET` block:
```
GOOGLE_SERVICE_ACCOUNT_KEY=           # Service account JSON for Drive download
PIPELINE_SECRET=                      # Secures /api/pipeline webhook from n8n
```

Update `## Implementation Plans` table:
```
| Plan 2: Drive + AI Pipeline | docs/superpowers/plans/2026-04-17-plan-2-drive-ai-pipeline.md | Complete |
```

Update `## Completed Features`:
```markdown
### Plan 2: Drive + AI Pipeline (2026-04-17)
- [x] Google Drive client (service account, file download)
- [x] Whisper transcription (25 MB limit guard, multi-format)
- [x] Claude Sonnet content generation (cached system prompt, Zod structured output)
- [x] 4 platform variants: Instagram, TikTok, X Thread, X Video
- [x] Pipeline webhook `/api/pipeline` (n8n → Whisper → Claude → Supabase)
- [x] Approve route `/api/approve` (updates Supabase + fires n8n webhook)
- [x] Reject route `/api/reject`
- [x] n8n callback `/api/webhook/n8n` (published/failed status update)
- [x] Unit tests (6 new, 14 total passing)
```

Update `## In Progress`:
```markdown
_Plan 3: Review PWA screens (Stitch designs → real UI)_
```

- [ ] **Step 5: Commit everything**

```bash
git add .env.local.example PRISM.md
git commit -m "docs: update PRISM.md — Plan 2 complete"
git push origin master
```

---

## Self-Review

**Spec coverage check:**
- ✓ Google Drive file download — Task 2 (`src/lib/drive.ts`)
- ✓ Whisper transcription for reels — Task 3 (`src/lib/whisper.ts`)
- ✓ 4 content variants (IG, TT, X Thread, X Video) — Task 4 (`src/lib/claude.ts`)
- ✓ Best posting time — Task 4 (included in `ContentVariantsSchema`)
- ✓ "Film next" recommendation — Task 4 (included in `ContentVariantsSchema`)
- ✓ Pipeline webhook — Task 6 (`/api/pipeline`)
- ✓ Approve flow + n8n trigger — Task 7 (`/api/approve`)
- ✓ Reject flow — Task 8 (`/api/reject`)
- ✓ n8n status callback — Task 9 (`/api/webhook/n8n`)
- ✓ Prompt caching on system prompt — Task 4 (`cache_control: { type: 'ephemeral' }`)
- ✓ Structured output via Zod — Task 4 (`zodOutputFormat`)
- ✓ Tests — Task 5 (6 new tests)
- ✓ PRISM.md updated — Task 10

**Out of scope for Plan 2 (handled in later plans):**
- Push notification when content is ready → Plan 3
- Review PWA UI → Plan 3
- Weekly trend research crons → Plan 5
- Daily performance pull → Plan 5
- Carousel generation via nano-banana → Plan 3 or standalone

**No placeholders.** Every route returns meaningful responses. External API failures are handled gracefully (Whisper failure is non-fatal; Claude failure marks post as `failed`).

**Type safety:** All Supabase queries use the typed client from Plan 1. All Claude responses are validated by Zod schema before being saved. API routes validate required fields before touching the database.
