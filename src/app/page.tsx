import Link from 'next/link'
import { Plus, Sparkles, TrendingUp, Clock, CheckCircle2, XCircle, Zap, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/post-card'
import { PushBell } from '@/components/push-bell'
import { RepurposeButton } from '@/components/repurpose-button'
import { SectionHeading, EmptyState } from '@/components/ui/primitives'
import type { PostStatus } from '@/lib/supabase/types'

export const revalidate = 0

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
  const total = all.length
  const pendingCount = counts.pending_review ?? 0
  const publishedCount = counts.published ?? 0
  const rejectedCount = counts.rejected ?? 0

  // Derived stats
  const publishRate = total > 0 ? Math.round((publishedCount / total) * 100) : 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-sm md:hidden">
            <Sparkles size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Prism</h1>
            <p className="text-xs text-text-muted">
              {total > 0 ? `${pendingCount} pending · ${publishedCount} published` : 'Content pipeline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PushBell />
          <RepurposeButton />
          <Link
            href="/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-600 hover:bg-accent-500 transition-all duration-200 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-md active:scale-[0.98]"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">New Post</span>
          </Link>
        </div>
      </header>

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger">
        <StatCard
          icon={<Zap size={16} />}
          label="Total Posts"
          value={total}
          accent="violet"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Pending"
          value={pendingCount}
          accent="yellow"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Published"
          value={publishedCount}
          accent="green"
        />
        <StatCard
          icon={<BarChart3 size={16} />}
          label="Publish Rate"
          value={`${publishRate}%`}
          accent="default"
        />
      </div>

      {/* ── Two-column desktop layout ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: pending + recent */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending review */}
          {pending.length > 0 && (
            <section className="animate-fade-in-up">
              <SectionHeading>
                Pending Review
                <span className="ml-2 text-accent-400">{pending.length}</span>
              </SectionHeading>
              <div className="space-y-2">
                {pending.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Recent posts */}
          {recent.length > 0 && (
            <section className="animate-fade-in-up">
              <SectionHeading>Recent Activity</SectionHeading>
              <div className="glass-card p-0 overflow-hidden">
                <div className="divide-y divide-border-subtle px-4">
                  {recent.map((post) => (
                    <PostCard key={post.id} post={post} variant="compact" />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Empty state */}
          {all.length === 0 && (
            <EmptyState
              icon={<Sparkles size={24} />}
              title="No posts yet"
              description="Drop a video in Google Drive to trigger your first AI-powered content pipeline."
              action={
                <Link
                  href="/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-sm font-semibold text-white transition-all duration-200 shadow-glow-sm hover:shadow-glow-md"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Start your first post
                </Link>
              }
            />
          )}
        </div>

        {/* Sidebar: insights panel */}
        <aside className="hidden lg:block space-y-4 animate-fade-in-up">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-400" />
              <h3 className="text-sm font-semibold text-text-primary">Pipeline Health</h3>
            </div>

            <div className="space-y-3">
              <PipelineBar label="Pending" value={pendingCount} max={Math.max(total, 1)} color="bg-yellow-500" />
              <PipelineBar label="Published" value={publishedCount} max={Math.max(total, 1)} color="bg-green-500" />
              <PipelineBar label="Rejected" value={rejectedCount} max={Math.max(total, 1)} color="bg-zinc-600" />
            </div>
          </div>

          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Quick Links</h3>
            <div className="space-y-1">
              <QuickLink href="/new" label="New pipeline trigger" />
              <QuickLink href="/research" label="Trend research" />
              <QuickLink href="/settings" label="Posting schedule" />
            </div>
          </div>

          <div className="glass-card p-5 space-y-2">
            <p className="text-xs text-text-muted">Platform Status</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-text-secondary">Pipeline active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs text-text-secondary">Platform keys pending</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ── StatCard ──────────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent: 'violet' | 'yellow' | 'green' | 'default'
}) {
  const colors = {
    violet: 'from-accent-600/20 to-accent-800/10 border-accent-800/20 text-accent-400',
    yellow: 'from-yellow-600/15 to-yellow-800/10 border-yellow-800/20 text-yellow-400',
    green: 'from-green-600/15 to-green-800/10 border-green-800/20 text-green-400',
    default: 'from-surface-3 to-surface-2 border-border-default text-text-primary',
  }

  const iconBg = {
    violet: 'bg-accent-600/20',
    yellow: 'bg-yellow-600/20',
    green: 'bg-green-600/20',
    default: 'bg-surface-4',
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-b ${colors[accent]} border p-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-glow-sm`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg[accent]}`}>
        {icon}
      </div>
      <div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ── PipelineBar ───────────────────────────────────────────────────────────── */

function PipelineBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-secondary tabular-nums">{value} ({pct}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-4 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── QuickLink ─────────────────────────────────────────────────────────────── */

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all duration-200"
    >
      <span className="w-1 h-1 rounded-full bg-accent-500" />
      {label}
    </Link>
  )
}
