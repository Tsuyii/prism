import { createClient } from '@/lib/supabase/server'
import type { NicheTrend } from '@/lib/supabase/types'

export const revalidate = 0

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  claude: 'AI Pick',
  tiktok: 'TikTok',
  google_trends: 'Google',
}

const SOURCE_COLOR: Record<string, string> = {
  youtube: 'bg-red-950 text-red-400 border-red-900',
  reddit: 'bg-orange-950 text-orange-400 border-orange-900',
  claude: 'bg-violet-950 text-violet-400 border-violet-900',
  tiktok: 'bg-sky-950 text-sky-400 border-sky-900',
  google_trends: 'bg-blue-950 text-blue-400 border-blue-900',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-zinc-500'
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>
}

function TrendCard({ trend }: { trend: NicheTrend }) {
  const sourceLabel = SOURCE_LABEL[trend.source] ?? trend.source
  const sourceColor = SOURCE_COLOR[trend.source] ?? 'bg-zinc-900 text-zinc-400 border-zinc-800'

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug">{trend.topic}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sourceColor}`}>
            {sourceLabel}
          </span>
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
    ? new Date(all[0].fetched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const aiPicks = all.filter((t) => t.source === 'claude')
  const external = all.filter((t) => t.source !== 'claude')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Research</h1>
          {lastFetched && (
            <p className="text-xs text-zinc-500 mt-0.5">Updated {lastFetched}</p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {all.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-zinc-500 text-sm">No trend data yet.</p>
          <p className="text-zinc-600 text-xs">The weekly cron runs every Monday at 9:00 AM UTC.</p>
        </div>
      )}

      {/* AI Picks */}
      {aiPicks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            AI Picks — Emerging Gaps
          </h2>
          <div className="space-y-2">
            {aiPicks.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {/* External trends */}
      {external.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Trending Now
          </h2>
          <div className="space-y-2">
            {external.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
