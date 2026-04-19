import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// TODO(Plan 3): Add authentication guard (REVIEW_SECRET or session-based auth)
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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(postId)) {
    return NextResponse.json({ error: 'postId must be a valid UUID' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch post + variants
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*, post_variants(*)')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'pending_review') {
    return NextResponse.json(
      { error: `Post is already ${post.status}` },
      { status: 409 },
    )
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
  const { error: variantsError } = await supabase
    .from('post_variants')
    .update({ approved: true })
    .eq('post_id', postId)
  if (variantsError) {
    console.error('[approve] Failed to mark variants approved:', variantsError)
  }

  return NextResponse.json({ success: true, postId })
}
