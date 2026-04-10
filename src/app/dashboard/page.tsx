import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, race, image_url, hp_current, hp_max, experience_points')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const { data: classes } = await supabase
    .from('character_classes')
    .select('character_id, class_name, level')
    .in('character_id', (characters ?? []).map(c => c.id))

  const classesByChar = (classes ?? []).reduce((acc, cls) => {
    if (!acc[cls.character_id]) acc[cls.character_id] = []
    acc[cls.character_id].push(`${cls.class_name} ${cls.level}`)
    return acc
  }, {} as Record<string, string[]>)

  return (
    <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Mis Personajes
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {characters?.length ?? 0} personaje{(characters?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/characters/new"
          className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}>
          + Nuevo personaje
        </Link>
      </div>

      {!characters?.length ? (
        <div className="text-center py-20 rounded-xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="text-5xl mb-4">🎭</div>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Aún no tienes personajes
          </p>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
            ¡Crea tu primer aventurero!
          </p>
          <Link href="/characters/new"
            className="px-6 py-2.5 rounded-lg font-semibold"
            style={{ background: 'var(--accent)', color: 'white' }}>
            Crear personaje
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(character => (
            <Link key={character.id} href={`/characters/${character.id}`}
              className="rounded-xl border p-5 transition-all hover:border-purple-500 group block"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--bg-secondary)' }}>
                  {character.image_url ? (
                    <img src={character.image_url} alt={character.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🧙</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-lg truncate group-hover:text-purple-300 transition-colors"
                    style={{ color: 'var(--text-primary)' }}>
                    {character.name}
                  </h2>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {character.race}
                    {classesByChar[character.id]?.length ? ' · ' + classesByChar[character.id].join(' / ') : ''}
                  </p>
                </div>
              </div>

              {/* HP bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  <span>HP</span>
                  <span>{character.hp_current} / {character.hp_max}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-secondary)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100))}%`,
                      background: character.hp_current / character.hp_max > 0.5
                        ? 'var(--success)'
                        : character.hp_current / character.hp_max > 0.25
                        ? 'var(--accent-gold)'
                        : 'var(--danger)',
                    }} />
                </div>
              </div>

              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {character.experience_points.toLocaleString()} XP
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
