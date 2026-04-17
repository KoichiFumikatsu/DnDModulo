import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rawChars } = await supabase
    .from('characters')
    .select('id, name, race, image_url, hp_current, hp_max, experience_points')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const { data: classes } = await supabase
    .from('character_classes')
    .select('character_id, class_name, level')
    .in('character_id', (rawChars ?? []).map(c => c.id))

  const classesByChar = (classes ?? []).reduce((acc, cls) => {
    if (!acc[cls.character_id]) acc[cls.character_id] = []
    acc[cls.character_id].push(cls.class_name)
    return acc
  }, {} as Record<string, string[]>)

  const characters = (rawChars ?? []).map(c => {
    const xp = getXPProgress(c.experience_points ?? 0)
    return { ...c, level: xp.level, pct: xp.pct, nextLevelXP: xp.nextLevelXP ?? null }
  })

  return (
    <main className="cs-page flex-1 p-6 max-w-7xl mx-auto w-full">
      <DashboardClient characters={characters} classesByChar={classesByChar} />
    </main>
  )
}
