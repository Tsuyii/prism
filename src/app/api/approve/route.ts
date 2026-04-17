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
