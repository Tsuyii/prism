import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewClient, PLATFORMS } from './review-client'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError || !post) {
    notFound()
  }

  const { data: variants } = await supabase
    .from('post_variants')
    .select('*')
    .eq('post_id', id)
    .in('platform', PLATFORMS)

  // Fetch latest film_next recommendation for this post
  const { data: filmNextRow } = await supabase
    .from('niche_trends')
    .select('topic')
    .eq('source', 'claude')
    .contains('raw_data', { type: 'film_next_recommendation', post_id: id })
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ReviewClient
      post={post}
      variants={variants ?? []}
      filmNext={filmNextRow?.topic ?? null}
    />
  )
}
