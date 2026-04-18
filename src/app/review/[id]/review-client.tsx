'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, platformLabel } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Post, PostVariant, Platform } from '@/lib/supabase/types'

export const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'x_thread', 'x_video']

interface ReviewClientProps {
  post: Post
  variants: PostVariant[]
  filmNext: string | null
}

interface EditState {
  caption: string
  hashtags: string
}

export function ReviewClient({ post, variants, filmNext }: ReviewClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Platform>('instagram')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [edits, setEdits] = useState<Record<Platform, EditState>>(() => {
    const initial = {} as Record<Platform, EditState>
    for (const platform of PLATFORMS) {
      const v = variants.find((v) => v.platform === platform)
      initial[platform] = {
        caption: v?.caption ?? '',
        hashtags: (v?.hashtags ?? []).join(' '),
      }
    }
    return initial
  })

  const [scheduledAt, setScheduledAt] = useState<string>(
    post.scheduled_at
      ? new Date(post.scheduled_at).toISOString().slice(0, 16)
      : getDefaultSchedule(),
  )

  function getDefaultSchedule(): string {
    const d = new Date()
    d.setHours(18, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 16)
  }

  function localDatetimeToISO(localStr: string): string {
    const [datePart, timePart] = localStr.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = timePart.split(':').map(Number)
    return new Date(year, month - 1, day, hour, minute).toISOString()
  }

  async function handleApprove() {
    setError(null)
    setLoading('approve')
    try {
      const supabase = createClient()
      for (const platform of PLATFORMS) {
        const edit = edits[platform]
        const hashtags = edit.hashtags.split(/\s+/).filter(Boolean)
        const { error: updateError } = await supabase
          .from('post_variants')
          .update({ caption: edit.caption, hashtags })
          .eq('post_id', post.id)
          .eq('platform', platform)
        if (updateError) throw new Error(`Failed to save ${platform} edits`)
      }

      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          scheduledAt: localDatetimeToISO(scheduledAt),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setError(null)
    setLoading('reject')
    try {
      const res = await fetch('/api/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setLoading(null)
    }
  }

  const current = edits[activeTab]
  const isThread = activeTab === 'x_thread'
  const hasHashtags = activeTab === 'instagram' || activeTab === 'tiktok'

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800">
        <button
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">Review Post</h1>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          post.type === 'reel'
            ? 'bg-violet-900/50 text-violet-300'
            : 'bg-blue-900/50 text-blue-300',
        )}>
          {post.type === 'reel' ? 'Reel' : 'Carousel'}
        </span>
      </header>

      {/* Platform Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto scrollbar-none">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActiveTab(p)}
            className={cn(
              'flex-1 min-w-0 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === p
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-40">

        {/* Video thumbnail placeholder */}
        <div className="w-full aspect-video rounded-xl bg-zinc-800 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>

        {/* Caption */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            {isThread ? 'Thread Tweets' : 'Caption'}
          </label>
          {isThread ? (
            <div className="space-y-2">
              {current.caption.split('\n\n---\n\n').map((tweet, i) => (
                <textarea
                  key={i}
                  value={tweet}
                  onChange={(e) => {
                    const tweets = current.caption.split('\n\n---\n\n')
                    tweets[i] = e.target.value
                    setEdits((prev) => ({
                      ...prev,
                      [activeTab]: { ...prev[activeTab], caption: tweets.join('\n\n---\n\n') },
                    }))
                  }}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder={`Tweet ${i + 1}`}
                />
              ))}
            </div>
          ) : (
            <textarea
              value={current.caption}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeTab]: { ...prev[activeTab], caption: e.target.value },
                }))
              }
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="Caption..."
            />
          )}
        </div>

        {/* Hashtags (IG + TT only) */}
        {hasHashtags && (
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">
              Hashtags
            </label>
            <textarea
              value={current.hashtags}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeTab]: { ...prev[activeTab], hashtags: e.target.value },
                }))
              }
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-300 resize-none focus:outline-none focus:border-violet-500 transition-colors font-mono"
              placeholder="#hashtag1 #hashtag2..."
            />
          </div>
        )}

        {/* Schedule time */}
        <div>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">
            Post Time
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Film Next */}
        {filmNext && (
          <div className="rounded-xl bg-violet-950/40 border border-violet-800/30 px-4 py-3">
            <p className="text-xs font-medium text-violet-400 mb-1">Film next</p>
            <p className="text-sm text-zinc-300 italic">{filmNext}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Sticky bottom CTAs */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 pb-[env(safe-area-inset-bottom,16px)] bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 space-y-3 md:absolute md:left-16">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors"
        >
          {loading === 'approve' ? <span className="animate-pulse">Processing...</span> : 'Approve'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-zinc-300 transition-colors"
        >
          {loading === 'reject' ? <span className="animate-pulse">Processing...</span> : 'Reject'}
        </button>
      </div>
    </div>
  )
}
