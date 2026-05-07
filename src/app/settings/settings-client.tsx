'use client'

import { useState } from 'react'
import { Save, CheckCircle2, AlertCircle, Calendar, Clock, Film, Image, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, GlassCard, SectionHeading } from '@/components/ui/primitives'
import type { ScheduleConfig } from '@/lib/supabase/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

function formatHour(h: number): string {
  if (h === 12) return '12 PM'
  if (h === 0) return '12 AM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

interface SettingsClientProps {
  initialSchedule: ScheduleConfig[]
}

interface DayConfig {
  day_of_week: number
  content_type: 'reel' | 'carousel' | 'off'
  preferred_hour: number
  active: boolean
}

export function SettingsClient({ initialSchedule }: SettingsClientProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<DayConfig[]>(() =>
    DAYS.map((_, i) => {
      const existing = initialSchedule.find((s) => s.day_of_week === i)
      const isActive = existing?.active === true
      return {
        day_of_week: i,
        content_type: isActive
          ? (existing!.content_type as 'reel' | 'carousel')
          : 'off',
        preferred_hour: existing?.preferred_hour ?? 18,
        active: isActive,
      }
    }),
  )

  function setDayType(dayIndex: number, type: DayConfig['content_type']) {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === dayIndex
          ? { ...d, content_type: type, active: type !== 'off' }
          : d,
      ),
    )
    setSaved(false)
  }

  function setDayHour(dayIndex: number, hour: number) {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, preferred_hour: hour } : d)),
    )
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const rows = schedule
        .filter((d) => d.content_type !== 'off')
        .map(({ day_of_week, content_type, preferred_hour, active }) => ({
          day_of_week,
          content_type,
          preferred_hour,
          active,
        }))

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: rows }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = schedule.filter((d) => d.active).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-8">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="animate-fade-in">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          {activeCount} of 7 days active
        </p>
      </header>

      {/* ── Bento grid: desktop ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger">
        {/* Schedule card — spans 3 cols */}
        <GlassCard className="md:col-span-3 space-y-4 !p-5" glow>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-accent-400" />
            <h2 className="text-sm font-semibold text-text-primary">Weekly Schedule</h2>
          </div>

          <div className="divide-y divide-border-subtle -mx-1">
            {schedule.map((day) => (
              <div
                key={day.day_of_week}
                className={cn(
                  'flex items-center gap-3 px-1 py-3.5 transition-all duration-200 rounded-lg',
                  day.active && 'bg-accent-600/5',
                )}
              >
                {/* Day label */}
                <span className={cn(
                  'text-sm font-semibold w-8 shrink-0 tabular-nums',
                  day.active ? 'text-text-primary' : 'text-text-muted',
                )}>
                  {DAYS[day.day_of_week]}
                </span>

                {/* Type toggle pills */}
                <div className="flex gap-1 flex-1">
                  {([
                    { type: 'reel', Icon: Film },
                    { type: 'carousel', Icon: Image },
                    { type: 'off', Icon: Power },
                  ] as const).map(({ type, Icon }) => {
                    const isActive = day.content_type === type
                    const isOff = type === 'off'
                    return (
                      <button
                        key={type}
                        onClick={() => setDayType(day.day_of_week, type)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize',
                          isActive
                            ? isOff
                              ? 'bg-surface-4 text-text-secondary'
                              : 'bg-accent-600 text-white shadow-glow-sm'
                            : 'bg-surface-3 text-text-muted hover:text-text-secondary hover:bg-surface-4',
                        )}
                      >
                        <Icon size={12} strokeWidth={2.5} />
                        {type}
                      </button>
                    )
                  })}
                </div>

                {/* Hour picker */}
                {day.active && (
                  <select
                    value={day.preferred_hour}
                    onChange={(e) => setDayHour(day.day_of_week, Number(e.target.value))}
                    className="bg-surface-3 border border-border-default rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary focus:outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
                    aria-label={`Posting hour for ${DAYS[day.day_of_week]}`}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Summary card — 1 col */}
        <div className="space-y-4">
          <GlassCard className="!p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-accent-400" />
              <h3 className="text-sm font-semibold text-text-primary">Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Active days</span>
                <span className="font-semibold text-text-primary tabular-nums">{activeCount}/7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Reels</span>
                <span className="font-semibold text-accent-400 tabular-nums">
                  {schedule.filter((d) => d.content_type === 'reel').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Carousels</span>
                <span className="font-semibold text-blue-400 tabular-nums">
                  {schedule.filter((d) => d.content_type === 'carousel').length}
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="!p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Quick tip</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Schedule reels for high-engagement windows (6-8 PM). Carousels perform well midweek mornings.
            </p>
          </GlassCard>
        </div>
      </div>

      {/* ── Feedback ──────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger animate-fade-in">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-success-bg border border-success-border px-4 py-3 text-sm text-success animate-fade-in">
          <CheckCircle2 size={14} />
          Schedule saved successfully
        </div>
      )}

      {/* ── Save button ───────────────────────────────────────── */}
      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          loading={saving}
        >
          <Save size={17} strokeWidth={2.5} />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
