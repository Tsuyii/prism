import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// TODO(Plan 3): Add authentication guard (REVIEW_SECRET or session-based auth)
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

  const supabase = createServiceClient()

  // Fetch post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, status')
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

  // Update post status to rejected
  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'rejected' })
    .eq('id', postId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to reject post' }, { status: 500 })
  }

  return NextResponse.json({ success: true, postId })
}
