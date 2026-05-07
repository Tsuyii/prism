import { Sparkles, TrendingUp, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { GlassCard, SectionHeading, EmptyState, Badge } from '@/components/ui/primitives'
import type { NicheTrend } from '@/lib/supabase/types'

export const revalidate = 0

const SOURCE_CONFIG: Record<string, { label: string; variant: 'accent' | 'danger' | 'warning' | 'default' }> = {
  youtube: { label: 'YouTube', variant: 'danger' },
  reddit: { label: 'Reddit', variant: 'warning' },
  claude: { label: 'AI Pick', variant: 'accent' },
  tiktok: { label: 'TikTok', variant: 'default' },
  google_trends: { label: 'Google', variant: 'default' },
  perplexity: { label: 'Perplexity', variant: 'accent' },
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-text-muted'
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>
      {score}
    </span>
  )
}

function TrendCard({ trend }: { trend: NicheTrend }) {
  const config = SOURCE_CONFIG[trend.source] ?? { label: trend.source, variant: 'default' as const }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0 animate-fade-in">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary leading-snug">{trend.topic}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant={config.variant} size="sm">{config.label}</Badge>
        </div>
      </div>
      <ScoreBadge score={trend.score} />
    </div>
  )
}

export default async function ResearchPage() {
  const supabase = await createClient()

  const { data: trends } = await supabase
    .from('niche_trends')
    .select('*')
    .order('score', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(60)

  const all = trends ?? []
  const lastFetched = all[0]?.fetched_at
    ? new Date(all[0].fetched_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const aiPicks = all.filter((t) => t.source === 'claude')
  const external = all.filter((t) => t.source !== 'claude')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Research</h1>
          {lastFetched && (
            <p className="text-xs text-text-muted mt-0.5">Updated {lastFetched}</p>
          )}
        </div>
        {all.length > 0 && (
          <span className="text-xs text-text-muted tabular-nums">{all.length} topics</span>
        )}
      </header>

      {/* Empty state */}
      {all.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="No trend data yet"
          description="Weekly research cron runs every Monday at 9:00 AM UTC. Trends from YouTube, Reddit, Perplexity, and Claude AI will appear here."
        />
      )}

      {/* AI Picks */}
      {aiPicks.length > 0 && (
        <section className="animate-fade-in-up">
          <SectionHeading>AI Picks — Emerging Gaps</SectionHeading>
          <GlassCard glow className="divide-y divide-border-subtle !p-0">
            <div className="px-4">
              {aiPicks.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* External trends */}
      {external.length > 0 && (
        <section className="animate-fade-in-up">
          <SectionHeading>Trending Now</SectionHeading>
          <GlassCard className="divide-y divide-border-subtle !p-0">
            <div className="px-4">
              {external.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* Footer info */}
      <div className="flex items-center gap-2 text-xs text-text-muted animate-fade-in-up">
        <ExternalLink size={12} />
        Sourced from YouTube, Reddit, Perplexity, and Claude analysis. Refreshed weekly.
      </div>
    </div>
  )
}
