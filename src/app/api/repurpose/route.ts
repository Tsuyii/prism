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
