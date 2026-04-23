import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { NicheTrend } from './supabase/types'

// ─── Output schema ────────────────────────────────────────────────────────────

export const ContentVariantsSchema = z.object({
  instagram: z.object({
    caption: z.string().describe('2–3 sentence storytelling caption with a CTA at the end'),
    hashtags: z.array(z.string()).describe('15–20 hashtags: mix of niche and broad'),
  }),
  tiktok: z.object({
    caption: z.string().describe('Punchy 1-liner hook caption'),
    hashtags: z.array(z.string()).describe('3–5 trending TikTok-specific hashtags'),
  }),
  x_thread: z.object({
    tweets: z
      .array(z.string())
      .describe('Twitter thread: 3–7 tweets, each under 280 chars. Pure value, no hashtags.'),
  }),
  x_video: z.object({
    caption: z.string().max(280).describe('Short conversational caption, max 280 chars, no hashtags'),
  }),
  best_post_time: z.string().describe('Best day and hour in "Monday at 6:00 PM" format'),
  film_next: z.string().describe('One sentence: the specific video topic to film next'),
})

export type ContentVariants = z.infer<typeof ContentVariantsSchema>

// ─── System prompt (stable — benefits from prompt caching) ───────────────────

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
Identify the #1 gap between trending topics in the niche and what is underserved. Recommend a specific, filmable topic.

## Rules
- Match each platform's native voice. TikTok speaks to Gen Z. Instagram is slightly more polished. X is for fellow creators.
- Never use the phrase "In this video". Never start captions with "I".
- Hashtags must be lowercase with no spaces or punctuation inside.
- Carousel content gets slightly more educational captions; reel content gets more hook-driven captions.`

// ─── Input / prompt builder ───────────────────────────────────────────────────

export interface RepurposeInput {
  contentType: 'reel' | 'carousel'
  originalCaption: string
  trendData?: Array<Pick<NicheTrend, 'topic' | 'source'>>
}

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

// ─── Main export ──────────────────────────────────────────────────────────────

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
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    output_config: {
      format: zodOutputFormat(ContentVariantsSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error(`Claude returned no parsed output. Stop reason: ${response.stop_reason}`)
  }

  return response.parsed_output
}

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
