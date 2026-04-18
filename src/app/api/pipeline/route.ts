import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateContentVariants, type ContentVariants } from '@/lib/claude'
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
  if (
    !process.env.PIPELINE_SECRET ||
    !authHeader ||
    authHeader !== `Bearer ${process.env.PIPELINE_SECRET}`
  ) {
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
  const supabase = createServiceClient()

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
      transcript = (await transcribeBuffer(buffer, fileName)) || undefined
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
  let variants: ContentVariants
  try {
    variants = await generateContentVariants({
      contentType,
      filename: fileName,
      transcript,
      trendData: trendsResult.data ?? [],
      performanceData: (perfResult.data ?? []).map(p => ({
        platform: p.platform,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
      })),
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
  const { error: filmNextError } = await supabase.from('niche_trends').insert({
    source: 'claude',
    topic: variants.film_next,
    score: null,
    raw_data: { type: 'film_next_recommendation', post_id: post.id },
  })
  if (filmNextError) {
    console.warn('[pipeline] Failed to store film_next recommendation (non-fatal):', filmNextError)
  }

  console.log(`[pipeline] Post ${post.id} created with ${variantRows.length} variants`)

  // Fire push notification (non-fatal)
  try {
    const { sendPushToAll } = await import('@/lib/push')
    await sendPushToAll({
      title: 'Prism — Content ready',
      body: `${contentType === 'reel' ? 'Reel' : 'Carousel'} is ready to review`,
      postId: post.id,
    })
  } catch (err) {
    console.warn('[pipeline] Push notification failed (non-fatal):', err)
  }

  return NextResponse.json({
    postId: post.id,
    bestPostTime: variants.best_post_time,
    filmNext: variants.film_next,
  })
}
