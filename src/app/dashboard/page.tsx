import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import DeleteCharacterButton from '@/components/ui/DeleteCharacterButton'

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
    <main className="cs-page flex-1 p-6 max-w-6xl mx-auto w-full">
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.8rem', letterSpacing: '0.05em' }}>
            Mis Aventureros
          </h1>
          <div style={{ height: 1, background: 'var(--cs-gold)', margin: '0.4rem 0 0.3rem' }} />
          <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
            {characters?.length ?? 0} personaje{(characters?.length ?? 0) !== 1 ? 's' : ''} en el grimorio
          </p>
        </div>
        <Link href="/characters/new" style={{
          textDecoration: 'none', display: 'inline-block',
          padding: '0.45rem 1.1rem',
          background: 'var(--cs-accent)', color: '#fff',
          fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.78rem',
          fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          border: '1px solid var(--cs-accent)', borderRadius: 2,
        }}>
          + Nuevo Personaje
        </Link>
      </div>

      {!characters?.length ? (
        <div style={{
          background: 'var(--cs-card)', border: '1px solid var(--cs-gold)',
          textAlign: 'center', padding: '4rem 2rem', borderRadius: 2,
        }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</p>
          <p style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '1.2rem', color: 'var(--cs-accent)', marginBottom: '0.5rem' }}>
            El grimorio está vacío
          </p>
          <p style={{ color: 'var(--cs-text-muted)', marginBottom: '1.5rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
            Escribe tu primer aventurero en estas páginas
          </p>
          <Link href="/characters/new" style={{
            textDecoration: 'none', display: 'inline-block',
            padding: '0.5rem 1.25rem',
            background: 'var(--cs-accent)', color: '#fff',
            fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.82rem',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            borderRadius: 2,
          }}>
            Crear Personaje
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {characters.map(character => {
            const xpData = getXPProgress(character.experience_points ?? 0)
            const hpPct = Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100))
            const hpColor = hpPct > 50 ? '#2d6a2d' : hpPct > 25 ? '#b06000' : 'var(--cs-accent)'
            const classNames = classesByChar[character.id] ?? []

            return (
              <div key={character.id} style={{ position: 'relative' }}>
                <DeleteCharacterButton characterId={character.id} characterName={character.name} />
                <Link
                  href={`/characters/${character.id}`}
                  style={{
                    textDecoration: 'none', display: 'block',
                    background: 'var(--cs-card)',
                    border: '1px solid var(--cs-gold)',
                    borderRadius: 2, padding: '1.1rem',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  {/* Nombre + retrato */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        fontFamily: 'var(--font-cinzel, serif)',
                        color: 'var(--cs-accent)', fontSize: '1.05rem',
                        lineHeight: 1.2, marginBottom: '0.2rem',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {character.name}
                      </h2>
                      <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
                        {character.race}{classNames.length > 0 && ` · ${classNames.join(' / ')}`}
                      </p>
                    </div>

                    {/* Retrato + escudo nivel */}
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      {character.image_url ? (
                        <img
                          src={character.image_url}
                          alt={character.name}
                          style={{ width: 52, height: 52, objectFit: 'cover', border: '2px solid var(--cs-gold)', display: 'block' }}
                        />
                      ) : (
                        <div style={{
                          width: 52, height: 52,
                          background: 'rgba(201,173,106,0.15)',
                          border: '2px solid var(--cs-gold)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.4rem',
                        }}>
                          🧙
                        </div>
                      )}
                      {/* Escudo nivel */}
                      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
                        <div className="cs-shield cs-shield--sm" style={{ width: 36, height: 42 }}>
                          <svg className="cs-shield-svg" viewBox="0 0 36 42" style={{ position: 'absolute', inset: 0 }}>
                            <path d="M2 2 L34 2 L34 28 L18 40 L2 28 Z"
                              fill="var(--cs-gold)" stroke="var(--cs-gold-dk)" strokeWidth="1.5" />
                          </svg>
                          <span className="cs-shield-value" style={{ position: 'relative', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cs-card)', fontFamily: 'var(--font-cinzel, serif)' }}>
                            {xpData.level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'rgba(201,173,106,0.4)', marginBottom: '0.65rem' }} />

                  {/* HP */}
                  <div style={{ marginBottom: '0.55rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>PV</span>
                      <span style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.8rem', color: hpColor }}>
                        {character.hp_current}
                        <span style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga, Georgia, serif)' }}> / {character.hp_max}</span>
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(201,173,106,0.25)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {/* XP */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>XP</span>
                      <span style={{ fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.75rem', color: 'var(--cs-text-muted)' }}>
                        {(character.experience_points ?? 0).toLocaleString()}
                        {xpData.nextLevelXP ? ` / ${xpData.nextLevelXP.toLocaleString()}` : ' (máx)'}
                      </span>
                    </div>
                    {xpData.nextLevelXP && (
                      <div style={{ height: 5, background: 'rgba(201,173,106,0.25)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${xpData.pct}%`, background: 'linear-gradient(90deg, var(--cs-gold-dk), var(--cs-gold))', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
