import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { postInstagram } from '@/lib/post-instagram'
import { postX } from '@/lib/post-x'
import { postTikTok } from '@/lib/post-tiktok'
import type { PostVariant } from '@/lib/supabase/types'

type PlatformOutcome =
  | { status: 'success'; platform: string }
  | { status: 'skipped'; platform: string }
  | { status: 'failed'; platform: string; error: string }

/**
 * POST cron: pick up approved posts whose scheduled_at is due (or NULL) and
 * publish them to Instagram, X, and TikTok in parallel.
 *
 * Called by Vercel Cron — must validate Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // ── Query due approved posts ────────────────────────────────────────────────
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'approved')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)

  if (postsError) {
    console.error('[cron/post] Failed to fetch posts:', postsError)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  if (!posts || posts.length === 0) {
    console.log('[cron/post] No due posts found')
    return NextResponse.json({ processed: 0, published: 0, failed: 0 })
  }

  let published = 0
  let failed = 0

  // ── Process posts sequentially to respect platform rate limits ──────────────
  for (const post of posts) {
    // Fetch variants for this post
    const { data: variants, error: variantsError } = await supabase
      .from('post_variants')
      .select('*')
      .eq('post_id', post.id)

    if (variantsError) {
      console.error(`[cron/post] Failed to fetch variants for post ${post.id}:`, variantsError)
      failed++
      await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id)
      continue
    }

    const variantMap = new Map<string, PostVariant>()
    for (const v of variants ?? []) {
      variantMap.set(v.platform, v)
    }

    // ── Post to all three platforms in parallel ─────────────────────────────
    const results = await Promise.allSettled([
      // Instagram
      (async (): Promise<PlatformOutcome> => {
        const v = variantMap.get('instagram')
        if (!v) return { status: 'skipped', platform: 'instagram' }
        const result = await postInstagram({
          caption: v.caption,
          hashtags: v.hashtags,
          media_url: v.media_url,
        })
        if (result.success) return { status: 'success', platform: 'instagram' }
        return { status: 'failed', platform: 'instagram', error: result.error }
      })(),

      // X (prefer x_thread, fall back to x_video)
      (async (): Promise<PlatformOutcome> => {
        const v = variantMap.get('x_thread') ?? variantMap.get('x_video')
        if (!v) return { status: 'skipped', platform: 'x' }
        const result = await postX({
          caption: v.caption,
          hashtags: v.hashtags,
        })
        if (result.success) return { status: 'success', platform: 'x' }
        return { status: 'failed', platform: 'x', error: result.error }
      })(),

      // TikTok
      (async (): Promise<PlatformOutcome> => {
        const v = variantMap.get('tiktok')
        if (!v) return { status: 'skipped', platform: 'tiktok' }
        const result = await postTikTok({
          caption: v.caption,
          hashtags: v.hashtags,
          media_url: v.media_url,
        })
        if (result.success) return { status: 'success', platform: 'tiktok' }
        // skipped flag means soft-skip (not configured / access issue)
        if (!result.success && result.skipped) {
          return { status: 'skipped', platform: 'tiktok' }
        }
        return { status: 'failed', platform: 'tiktok', error: result.error }
      })(),
    ])

    // ── Determine final status ───────────────────────────────────────────────
    // Extract outcomes from settled promises
    const outcomes: PlatformOutcome[] = results.map((r) => {
      if (r.status === 'fulfilled') return r.value
      // Promise itself rejected (unexpected) — treat as failure
      const err = r.reason instanceof Error ? r.reason.message : String(r.reason)
      return { status: 'failed', platform: 'unknown', error: err } as PlatformOutcome
    })

    const anyHardFailure = outcomes.some((o) => o.status === 'failed')
    const finalStatus = anyHardFailure ? 'failed' : 'published'

    console.log(`[cron/post] Post ${post.id} → ${finalStatus}`, {
      outcomes: outcomes.map((o) =>
        o.status === 'failed'
          ? { platform: o.platform, status: o.status, error: o.error }
          : { platform: o.platform, status: o.status },
      ),
    })

    // ── Update post status ───────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: finalStatus })
      .eq('id', post.id)

    if (updateError) {
      console.error(`[cron/post] Failed to update status for post ${post.id}:`, updateError)
    }

    if (finalStatus === 'published') {
      published++
    } else {
      failed++
    }
  }

  const summary = { processed: posts.length, published, failed }
  console.log('[cron/post] Done', summary)
  return NextResponse.json(summary)
}
