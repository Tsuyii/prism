'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Film, Image, Send, X, Hash, Clock, Lightbulb } from 'lucide-react'
import { cn, platformLabel, PLATFORMS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button, GlassCard } from '@/components/ui/primitives'
import type { Post, PostVariant, Platform } from '@/lib/supabase/types'

export { PLATFORMS }

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
      ? isoToLocalDatetime(post.scheduled_at)
      : getDefaultSchedule(),
  )

  function getDefaultSchedule(): string {
    const d = new Date()
    d.setHours(18, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function isoToLocalDatetime(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const isReel = post.type === 'reel'

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      {/* ── Violet nebula background ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-30%] w-[80%] h-[60%] rounded-full bg-accent-700/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] rounded-full bg-accent-600/8 blur-[100px]" />
      </div>

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-default glass-strong">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors p-1.5 -ml-1.5 rounded-xl hover:bg-surface-3"
          aria-label="Go back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-text-primary">Review</h1>
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5',
            isReel
              ? 'bg-accent-600/20 text-accent-300 border border-accent-800/30'
              : 'bg-blue-600/20 text-blue-300 border border-blue-800/30',
          )}>
            {isReel ? <Film size={12} /> : <Image size={12} />}
            {isReel ? 'Reel' : 'Carousel'}
          </span>
        </div>
        <div className="w-9" />
      </header>

      {/* ── Platform Tabs ─────────────────────────────────────── */}
      <div className="relative z-10 flex border-b border-border-default overflow-x-auto scrollbar-none glass-strong">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActiveTab(p)}
            className={cn(
              'flex-1 min-w-0 py-3.5 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px',
              activeTab === p
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-28">
        {/* Video preview */}
        {post.drive_url ? (
          <GlassCard padding="sm" className="overflow-hidden !p-0 aspect-video">
            <iframe
              src={post.drive_url.replace('/view', '/preview').split('?')[0]}
              className="w-full h-full"
              allow="autoplay"
              allowFullScreen
            />
          </GlassCard>
        ) : (
          <div className="w-full aspect-video rounded-xl bg-surface-3 border border-border-default flex items-center justify-center">
            <Film size={40} className="text-text-muted" strokeWidth={1.5} />
          </div>
        )}

        {/* Caption */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
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
                  className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary resize-none focus:outline-none focus:border-accent-500 transition-colors placeholder:text-text-muted"
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
              className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary resize-none focus:outline-none focus:border-accent-500 transition-colors placeholder:text-text-muted"
              placeholder="Caption..."
            />
          )}
        </div>

        {/* Hashtags */}
        {hasHashtags && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              <Hash size={12} />
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
              className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3 text-sm text-accent-300 resize-none focus:outline-none focus:border-accent-500 transition-colors font-mono placeholder:text-text-muted"
              placeholder="#hashtag1 #hashtag2..."
            />
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <Clock size={12} />
            Post Time
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* Film Next tip */}
        {filmNext && (
          <GlassCard glow>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb size={14} className="text-accent-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-accent-400 mb-1">Film Next</p>
                <p className="text-sm text-text-secondary italic leading-relaxed">{filmNext}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger flex items-center gap-2">
            <X size={14} />
            {error}
          </div>
        )}
      </div>

      {/* ── Floating CTA bar ──────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:left-16">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button
            variant="danger"
            size="lg"
            onClick={handleReject}
            loading={loading === 'reject'}
            className="flex-[0.35] !py-4"
          >
            <X size={17} strokeWidth={2.5} />
            Reject
          </Button>
          <Button
            variant="success"
            size="lg"
            onClick={handleApprove}
            loading={loading === 'approve'}
            className="flex-1 !py-4 shadow-glow-sm hover:shadow-glow-md !bg-green-600 hover:!bg-green-500"
          >
            <Send size={17} strokeWidth={2.5} />
            Approve & Post
          </Button>
        </div>
      </div>
    </div>
  )
}
