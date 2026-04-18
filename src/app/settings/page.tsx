import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: schedule } = await supabase
    .from('schedule_config')
    .select('*')
    .order('day_of_week')

  return <SettingsClient initialSchedule={schedule ?? []} />
}
