'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

function extractFileId(input: string): string {
  // Handle full Drive URLs like https://drive.google.com/file/d/<ID>/view
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // Assume raw fileId if no URL pattern
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

    const mimeType = contentType === 'reel' ? 'video/mp4' : 'image/jpeg'
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
        body: JSON.stringify({ fileId, fileName: name, mimeType, driveUrl }),
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
      <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-600/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Pipeline started!</h2>
        <p className="text-sm text-zinc-500">Claude is generating your content. Check back in a minute.</p>
        <button
          onClick={() => router.push(`/review/${postId}`)}
          className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors text-sm"
        >
          Review when ready →
        </button>
        <button
          onClick={() => { setStatus('idle'); setDriveInput(''); setFileName('') }}
          className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">New Post</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drive input */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Google Drive URL or File ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={driveInput}
              onChange={(e) => { setDriveInput(e.target.value); setError('') }}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors pr-10"
              required
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  setDriveInput(text)
                } catch { /* permission denied */ }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Paste from clipboard"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filename (optional) */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Filename <span className="text-zinc-600 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="my-video.mp4"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Content type */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Content Type
          </label>
          <div className="flex gap-2">
            {(['reel', 'carousel'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize',
                  contentType === type
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {(status === 'error' || error) && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error || 'Something went wrong. Try again.'}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors mt-2"
        >
          {status === 'loading' ? (
            <span className="animate-pulse">Starting pipeline...</span>
          ) : (
            'Start Pipeline'
          )}
        </button>
      </form>

      <p className="text-xs text-zinc-600 text-center leading-relaxed">
        The file must be in your Google Drive folder. Claude will transcribe, generate captions, and queue it for your review.
      </p>
    </div>
  )
}
