import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Post, PostStatus } from '@/lib/supabase/types'

const STATUS_STYLES: Record<PostStatus, string> = {
  pending_review: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
  approved: 'bg-blue-900/40 text-blue-400 border-blue-800/40',
  rejected: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  published: 'bg-green-900/40 text-green-400 border-green-800/40',
  failed: 'bg-red-900/40 text-red-400 border-red-800/40',
}

const STATUS_LABELS: Record<PostStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: string }) {
  const s = status as PostStatus
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      STATUS_STYLES[s] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700',
    )}>
      {STATUS_LABELS[s] ?? status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      type === 'reel'
        ? 'bg-violet-900/40 text-violet-400'
        : 'bg-blue-900/40 text-blue-400',
    )}>
      {type === 'reel' ? 'Reel' : 'Carousel'}
    </span>
  )
}

interface PostCardProps {
  post: Post
  variant?: 'compact' | 'full'
}

export function PostCard({ post, variant = 'full' }: PostCardProps) {
  const isPending = post.status === 'pending_review'
  const createdDate = post.created_at
    ? new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '—'
  const scheduledDate = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0">
        <TypeBadge type={post.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 truncate">{post.drive_url.split('/').at(-2) ?? 'File'}</p>
          <p className="text-xs text-zinc-600">{createdDate} · {scheduledDate}</p>
        </div>
        <StatusBadge status={post.status} />
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-center gap-4 transition-colors',
      isPending
        ? 'bg-zinc-900 border-yellow-800/30 hover:border-yellow-700/50'
        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
    )}>
      <TypeBadge type={post.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {post.drive_url.split('/').at(-2) ?? 'Untitled'}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Created {createdDate}
          {post.scheduled_at ? ` · Scheduled ${scheduledDate}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={post.status} />
        {isPending && (
          <Link
            href={`/review/${post.id}`}
            className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
          >
            Review →
          </Link>
        )}
      </div>
    </div>
  )
}
