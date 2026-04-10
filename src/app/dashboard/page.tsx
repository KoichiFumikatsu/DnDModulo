import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'

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
    acc[cls.character_id].push(cls.class_name)
    return acc
  }, {} as Record<string, string[]>)

  return (
    <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.8rem' }}>
            Mis Aventureros
          </h1>
          <div className="ornate-divider" style={{ margin: '0.5rem 0 0' }}>
            <span style={{ color: 'var(--gold-dark)', fontSize: '0.8rem', fontStyle: 'italic' }}>
              {characters?.length ?? 0} personaje{(characters?.length ?? 0) !== 1 ? 's' : ''} en el grimorio
            </span>
          </div>
        </div>
        <Link href="/characters/new" className="btn-crimson" style={{ textDecoration: 'none', display: 'inline-block' }}>
          + Nuevo Personaje
        </Link>
      </div>

      {!characters?.length ? (
        <div className="parchment-page ornate-border text-center py-20 px-8 rounded-sm">
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</p>
          <p style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '1.2rem', color: 'var(--crimson)', marginBottom: '0.5rem' }}>
            El grimorio está vacío
          </p>
          <p style={{ color: 'var(--ink-faded)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
            Escribe tu primer aventurero en estas páginas
          </p>
          <Link href="/characters/new" className="btn-crimson" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Crear Personaje
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {characters.map(character => {
            const xpData = getXPProgress(character.experience_points ?? 0)
            const hpPct = Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100))
            const hpColor = hpPct > 50 ? 'var(--hp-good)' : hpPct > 25 ? 'var(--hp-warn)' : 'var(--hp-danger)'
            const classNames = classesByChar[character.id] ?? []

            return (
              <Link
                key={character.id}
                href={`/characters/${character.id}`}
                className="parchment-page char-card"
                style={{
                  textDecoration: 'none',
                  display: 'block',
                  borderRadius: '2px',
                  padding: '1.25rem',
                }}
              >
                {/* Nombre + nivel */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h2 style={{
                      fontFamily: 'var(--font-cinzel, serif)',
                      color: 'var(--crimson)',
                      fontSize: '1.1rem',
                      lineHeight: 1.2,
                      marginBottom: '0.25rem',
                    }}>
                      {character.name}
                    </h2>
                    <p style={{ color: 'var(--ink-faded)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      {character.race}
                      {classNames.length > 0 && ` · ${classNames.join(' / ')}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    {character.image_url ? (
                      <img
                        src={character.image_url}
                        alt={character.name}
                        style={{ width: 52, height: 52, objectFit: 'cover', border: '2px solid var(--gold-dark)', borderRadius: '2px' }}
                      />
                    ) : (
                      <div style={{
                        width: 52, height: 52,
                        background: 'var(--parchment-dark)',
                        border: '2px solid var(--gold-dark)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem',
                        borderRadius: '2px',
                      }}>
                        🧙
                      </div>
                    )}
                    <div className="level-badge" style={{ marginTop: 4 }}>
                      Nv {xpData.level}
                    </div>
                  </div>
                </div>

                {/* HP */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ink-faded)', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>PV</span>
                    <span>{character.hp_current} / {character.hp_max}</span>
                  </div>
                  <div className="ancient-bar-track">
                    <div className="ancient-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                  </div>
                </div>

                {/* XP */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ink-faded)', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>XP</span>
                    <span>
                      {character.experience_points.toLocaleString()}
                      {xpData.nextLevelXP
                        ? ` / ${xpData.nextLevelXP.toLocaleString()}`
                        : ' (nivel máximo)'}
                    </span>
                  </div>
                  {xpData.nextLevelXP && (
                    <div className="ancient-bar-track">
                      <div
                        className="ancient-bar-fill"
                        style={{
                          width: `${xpData.pct}%`,
                          background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                        }}
                      />
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
