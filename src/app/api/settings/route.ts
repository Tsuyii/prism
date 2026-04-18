import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ScheduleRow {
  day_of_week: number
  content_type: string
  preferred_hour: number
  active: boolean
}

export async function PATCH(request: NextRequest) {
  let body: { schedule?: ScheduleRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { schedule } = body
  if (!Array.isArray(schedule)) {
    return NextResponse.json({ error: 'schedule must be an array' }, { status: 400 })
  }

  const supabase = await createClient()

  // Delete all rows then re-insert (simple replace pattern)
  const { error: deleteError } = await supabase
    .from('schedule_config')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to clear schedule' }, { status: 500 })
  }

  const rows = schedule.map(({ day_of_week, content_type, preferred_hour, active }) => ({
    day_of_week,
    content_type,
    preferred_hour,
    active,
  }))

  const { error: insertError } = await supabase.from('schedule_config').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
