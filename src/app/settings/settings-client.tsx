'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ScheduleConfig } from '@/lib/supabase/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

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
      // active is boolean | null in DB schema — treat null as false
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

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Schedule */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Posting Schedule
        </h2>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
          {schedule.map((day) => (
            <div key={day.day_of_week} className={cn(
              'flex items-center gap-3 px-4 py-3',
              day.active && 'border-l-2 border-violet-500',
            )}>
              <span className="text-sm font-medium text-zinc-300 w-8 shrink-0">
                {DAYS[day.day_of_week]}
              </span>

              {/* Type selector */}
              <div className="flex gap-1 flex-1">
                {(['reel', 'carousel', 'off'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDayType(day.day_of_week, type)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                      day.content_type === type
                        ? type === 'off'
                          ? 'bg-zinc-700 text-zinc-300'
                          : 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Hour picker — only when active */}
              {day.active && (
                <select
                  value={day.preferred_hour}
                  onChange={(e) => setDayHour(day.day_of_week, Number(e.target.value))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Error / save feedback */}
      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-green-950/50 border border-green-800/50 px-4 py-3 text-sm text-green-400">
          Schedule saved.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
