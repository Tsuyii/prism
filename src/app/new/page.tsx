'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Film, Image, ClipboardPaste, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, GlassCard } from '@/components/ui/primitives'

function extractFileId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return input.trim()
}

export default function NewPostPage() {
  const router = useRouter()
  const [driveInput, setDriveInput] = useState('')
  const [fileName, setFileName] = useState('')
  const [contentType, setContentType] = useState<'reel' | 'carousel'>('reel')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [postId, setPostId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fileId = extractFileId(driveInput)
    if (!fileId) {
      setError('Paste a Drive URL or file ID')
      return
    }

    setStatus('loading')
    setError('')

    const name = fileName.trim() || `${contentType}-${Date.now()}.${contentType === 'reel' ? 'mp4' : 'jpg'}`
    const driveUrl = driveInput.startsWith('http')
      ? driveInput
      : `https://drive.google.com/file/d/${fileId}/view`

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PIPELINE_SECRET ?? ''}`,
        },
        body: JSON.stringify({ fileId, fileName: name, mimeType: contentType === 'reel' ? 'video/mp4' : 'image/jpeg', driveUrl }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)

      setPostId(data.postId)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline trigger failed')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 flex flex-col items-center gap-5 text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-success-bg border border-success-border flex items-center justify-center">
          <CheckCircle2 size={32} className="text-success" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Pipeline started</h2>
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
            Claude is generating your content across Instagram, TikTok, and X. Check back in about a minute.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push(`/review/${postId}`)}
          >
            <ArrowRight size={17} strokeWidth={2.5} />
            Review when ready
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setStatus('idle'); setDriveInput(''); setFileName('') }}
          >
            Submit another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <header className="animate-fade-in">
        <h1 className="text-xl font-bold text-text-primary">New Post</h1>
        <p className="text-sm text-text-muted mt-1">
          Paste a Google Drive link to trigger the AI pipeline
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">
        {/* Drive URL */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <Upload size={12} />
            Drive URL or File ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={driveInput}
              onChange={(e) => { setDriveInput(e.target.value); setError('') }}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-500 transition-colors pr-11"
              required
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  setDriveInput(text)
                } catch { /* clipboard denied */ }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-4 transition-all"
              title="Paste from clipboard"
              aria-label="Paste from clipboard"
            >
              <ClipboardPaste size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Filename */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Filename <span className="text-text-muted/50 normal-case font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="my-video.mp4"
            className="w-full bg-surface-2 border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* Content type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Content Type
          </label>
          <div className="flex gap-2">
            {([
              { type: 'reel', Icon: Film },
              { type: 'carousel', Icon: Image },
            ] as const).map(({ type, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold capitalize transition-all duration-200',
                  contentType === type
                    ? 'bg-accent-600 text-white shadow-glow-sm'
                    : 'bg-surface-3 border border-border-default text-text-muted hover:text-text-secondary hover:border-border-accent',
                )}
              >
                <Icon size={16} strokeWidth={2.5} />
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {(status === 'error' || error) && (
          <div className="rounded-xl bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger animate-fade-in">
            {error || 'Something went wrong. Try again.'}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={status === 'loading'}
          className="!py-4"
        >
          <Sparkles size={17} strokeWidth={2.5} />
          {status === 'loading' ? 'Starting pipeline...' : 'Start Pipeline'}
        </Button>
      </form>

      {/* Info */}
      <GlassCard className="!p-4 animate-fade-in-up">
        <p className="text-xs text-text-muted leading-relaxed">
          File must be in your Google Drive folder. Claude transcribes, generates platform-native captions, and queues everything for your review.
        </p>
      </GlassCard>
    </div>
  )
}
