import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/post-card'
import { PushBell } from '@/components/push-bell'
import { RepurposeButton } from '@/components/repurpose-button'
import type { PostStatus } from '@/lib/supabase/types'

export const revalidate = 0

interface StatCardProps {
  label: string
  value: number
  color?: 'default' | 'yellow' | 'green' | 'zinc'
}

function StatCard({ label, value, color = 'default' }: StatCardProps) {
  const valueColor = {
    default: 'text-white',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    zinc: 'text-zinc-500',
  }[color]

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex flex-col gap-1">
      <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const all = posts ?? []

  const counts = all.reduce(
    (acc, p) => {
      const s = p.status as PostStatus
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    },
    {} as Partial<Record<PostStatus, number>>,
  )

  const pending = all.filter((p) => p.status === 'pending_review')
  const recent = all.filter((p) => p.status !== 'pending_review').slice(0, 10)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <PushBell />
          <RepurposeButton />
          <Link
            href="/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Post
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Posts" value={all.length} />
        <StatCard label="Pending Review" value={counts.pending_review ?? 0} color="yellow" />
        <StatCard label="Published" value={counts.published ?? 0} color="green" />
        <StatCard label="Rejected" value={counts.rejected ?? 0} color="zinc" />
      </div>

      {/* Pending review */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Pending Review
          </h2>
          <div className="space-y-2">
            {pending.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Recent posts */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Recent Posts
          </h2>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 divide-y divide-zinc-800">
            {recent.map((post) => (
              <PostCard key={post.id} post={post} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {all.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">No posts yet.</p>
          <Link href="/new" className="inline-block text-violet-400 hover:text-violet-300 text-sm transition-colors">
            Trigger your first pipeline →
          </Link>
        </div>
      )}
    </div>
  )
}
