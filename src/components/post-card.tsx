import Link from 'next/link'
import { Film, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import type { Post, PostStatus } from '@/lib/supabase/types'

const STATUS_VARIANT: Record<PostStatus, 'warning' | 'success' | 'muted' | 'danger' | 'default' | 'accent'> = {
  pending_review: 'warning',
  approved: 'accent',
  rejected: 'muted',
  published: 'success',
  failed: 'danger',
}

const STATUS_LABELS: Record<PostStatus, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  failed: 'Failed',
}

interface PostCardProps {
  post: Post
  variant?: 'compact' | 'full'
}

export function PostCard({ post, variant = 'full' }: PostCardProps) {
  const isPending = post.status === 'pending_review'
  const createdDate = post.created_at
    ? new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : null
  const scheduledTime = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0 animate-fade-in">
        <Badge variant={STATUS_VARIANT[post.status as PostStatus] ?? 'default'} size="sm">
          {STATUS_LABELS[post.status as PostStatus] ?? post.status}
        </Badge>
        <div className="flex items-center gap-2 min-w-0">
          {post.type === 'reel' ? (
            <Film size={14} className="text-accent-400 shrink-0" />
          ) : (
            <Image size={14} className="text-blue-400 shrink-0" />
          )}
          <span className="text-xs text-text-secondary truncate">
            {post.drive_url.split('/').at(-2) ?? 'Untitled'}
          </span>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-text-muted tabular-nums shrink-0">{createdDate}</span>
        {scheduledTime && (
          <span className="text-xs text-text-muted tabular-nums shrink-0 hidden sm:inline">{scheduledTime}</span>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'glass-card p-4 flex items-center gap-4 transition-all duration-200',
        isPending && 'border-accent-800/20 hover:border-accent-700/30',
      )}
    >
      {/* Type icon */}
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        post.type === 'reel'
          ? 'bg-accent-600/15 text-accent-400'
          : 'bg-blue-600/15 text-blue-400',
      )}>
        {post.type === 'reel' ? <Film size={18} /> : <Image size={18} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {post.drive_url.split('/').at(-2) ?? 'Untitled'}
        </p>
        <p className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
          {createdDate && <span>{createdDate}</span>}
          {scheduledTime && (
            <>
              <span className="text-border-default">|</span>
              <span>{scheduledTime}</span>
            </>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={STATUS_VARIANT[post.status as PostStatus] ?? 'default'} size="sm">
          {STATUS_LABELS[post.status as PostStatus] ?? post.status}
        </Badge>
        {isPending && (
          <Link
            href={`/review/${post.id}`}
            className="text-sm font-semibold text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap"
          >
            Review
          </Link>
        )}
      </div>
    </div>
  )
}
