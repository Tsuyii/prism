import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { endpoint?: string; p256dh?: string; auth?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { endpoint, p256dh, auth } = body

  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }
  if (!p256dh || typeof p256dh !== 'string' || p256dh.trim() === '') {
    return NextResponse.json({ error: 'p256dh is required' }, { status: 400 })
  }
  if (!auth || typeof auth !== 'string' || auth.trim() === '') {
    return NextResponse.json({ error: 'auth is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' })

  if (dbError) {
    console.error('[push/subscribe] Failed to upsert subscription:', dbError)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  let body: { endpoint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { endpoint } = body

  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (dbError) {
    console.error('[push/subscribe] Failed to delete subscription:', dbError)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
