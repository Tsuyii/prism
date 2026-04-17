import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Validate n8n secret header — set N8N_API_KEY in production
  const authHeader = request.headers.get('authorization')
  if (!process.env.N8N_API_KEY) {
    console.warn('[n8n callback] N8N_API_KEY is not set — accepting unauthenticated requests (set in production)')
  } else if (authHeader !== `Bearer ${process.env.N8N_API_KEY}`) {
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
    return NextResponse.json(
      { error: 'postId and status are required' },
      { status: 400 }
    )
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(postId)) {
    return NextResponse.json(
      { error: 'postId must be a valid UUID' },
      { status: 400 }
    )
  }

  if (status !== 'published' && status !== 'failed') {
    return NextResponse.json(
      { error: 'status must be published or failed' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status })
    .eq('id', postId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update post status' },
      { status: 500 }
    )
  }

  if (status === 'failed' && n8nError) {
    console.error(`[n8n callback] Post ${postId} failed: ${n8nError}`)
  } else {
    console.log(`[n8n callback] Post ${postId} status updated to ${status}`)
  }

  return NextResponse.json({ success: true })
}
