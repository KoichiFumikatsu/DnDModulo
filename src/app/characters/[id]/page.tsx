import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuickStats from '@/modules/characters/components/QuickStats'
import SkillsPanel from '@/components/ui/SkillsPanel'
import { getXPProgress } from '@/lib/5etools/xp'
import { ABILITY_NAMES } from '@/lib/constants'

function mod(score: number) {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function AbilityBox({ label, score }: { label: string; score: number }) {
  return (
    <div className="stat-box">
      <span className="text-xs font-bold uppercase tracking-wide mb-1"
        style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{score}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--accent-gold)' }}>{mod(score)}</span>
    </div>
  )
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: character } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!character) notFound()

  const [
    { data: classes },
    { data: spellSlots },
    { data: spells },
    { data: weapons },
    { data: equipment },
    { data: features },
    { data: proficiencies },
    { data: classResources },
    { data: customStats },
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_equipment').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
    supabase.from('character_class_resources').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_custom_stats').select('*').eq('character_id', id).order('sort_order'),
  ])

  const classLabel = (classes ?? []).map(c => `${c.class_name} ${c.level}`).join(' / ')
  const xpData = getXPProgress(character.experience_points ?? 0)

  type ClassRow = NonNullable<typeof classes>[number]
  type SpellRow = NonNullable<typeof spells>[number]
  const spellsByClass: Record<string, { class: ClassRow; spells: SpellRow[] }> = {}
  for (const cls of (classes ?? [])) {
    const classSpells = (spells ?? []).filter(s => s.class_id === cls.id)
    if (classSpells.length > 0) {
      spellsByClass[cls.id] = { class: cls, spells: classSpells }
    }
  }

  const langProfs = (proficiencies ?? []).filter(p => p.type === 'language')
  const skillProfs = (proficiencies ?? []).filter(p => p.type === 'skill')

  return (
    <div className="min-h-screen" style={{ background: 'var(--cover)' }}>
      {/* Header estilo grimorio */}
      <div className="book-nav px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/dashboard"
              style={{ color: 'var(--gold-light)', fontSize: '0.8rem', textDecoration: 'none', opacity: 0.7, fontFamily: 'var(--font-cinzel, serif)' }}>
              ← Grimorio
            </Link>
            <div>
              <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.2rem', lineHeight: 1.1 }}>
                {character.name}
              </h1>
              <p style={{ color: 'var(--gold-light)', fontSize: '0.78rem', opacity: 0.75, fontStyle: 'italic' }}>
                {character.race} · {classLabel} · <span style={{ color: 'var(--gold)' }}>Nivel {xpData.level}</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link href={`/characters/${id}/play`} className="btn-crimson"
              style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
              ⚡ Modo Mesa
            </Link>
            <Link href={`/characters/${id}/edit`} className="btn-parchment"
              style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div style={{ background: 'var(--cover-mid)', borderBottom: '1px solid var(--gold-dark)', padding: '0.4rem 1.5rem' }}>
        <div className="max-w-7xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold-light)', fontSize: '0.7rem', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            XP
          </span>
          <div style={{ flex: 1, maxWidth: 300 }}>
            <div className="ancient-bar-track" style={{ height: 6 }}>
              {xpData.nextLevelXP && (
                <div className="ancient-bar-fill" style={{
                  width: `${xpData.pct}%`,
                  background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                }} />
              )}
            </div>
          </div>
          <span style={{ color: 'var(--gold-light)', fontSize: '0.75rem', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
            {character.experience_points.toLocaleString()}
            {xpData.nextLevelXP
              ? ` / ${xpData.nextLevelXP.toLocaleString()} para nivel ${xpData.level + 1}`
              : ' — nivel máximo'}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Portrait */}
          <div className="parchment-page ornate-border overflow-hidden">
            <div className="aspect-square flex items-center justify-center"
              style={{ background: 'var(--bg-secondary)' }}>
              {character.image_url ? (
                <img src={character.image_url} alt={character.name}
                  className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl">🧙</span>
              )}
            </div>
            <div className="p-4 space-y-2 text-sm">
              {[
                ['Raza', character.race],
                ['Trasfondo', character.background],
                ['Alineamiento', character.alignment],
                ['Velocidad', character.speed ? `${character.speed} ft` : null],
                ['Nivel', `${xpData.level}`],
                ['XP', `${character.experience_points?.toLocaleString()}${xpData.nextLevelXP ? ` / ${xpData.nextLevelXP.toLocaleString()}` : ''}`],
              ].map(([label, value]) => value && (
                <div key={label as string} className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Physical */}
          {(character.age || character.height || character.eyes) && (
            <div className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-muted)' }}>Apariencia</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Edad', character.age],
                  ['Altura', character.height],
                  ['Peso', character.weight],
                  ['Ojos', character.eyes],
                  ['Piel', character.skin],
                  ['Cabello', character.hair],
                ].map(([label, value]) => value && (
                  <div key={label as string} className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {langProfs.length > 0 && (
            <div className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-muted)' }}>Idiomas</h3>
              <div className="flex flex-wrap gap-2">
                {langProfs.map(p => (
                  <span key={p.id} className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center Column */}
        <div className="space-y-4">
          {/* Ability Scores */}
          <div className="grid grid-cols-3 gap-2">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
              <AbilityBox key={ab}
                label={ABILITY_NAMES[ab]}
                score={character[ab]} />
            ))}
          </div>

          {/* Combat Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'CA', value: character.ac },
              { label: 'Iniciativa', value: mod(character.dex + (character.initiative_bonus ?? 0)) },
              { label: 'Bonus Prof.', value: `+${character.proficiency_bonus}` },
            ].map(({ label, value }) => (
              <div key={label} className="stat-box">
                <div className="text-xs font-bold uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <SkillsPanel
            abilities={{
              str: character.str, dex: character.dex, con: character.con,
              int: character.int, wis: character.wis, cha: character.cha,
            }}
            proficiencyBonus={character.proficiency_bonus}
            skillProfs={skillProfs}
          />

          {/* Weapons */}
          {weapons && weapons.length > 0 && (
            <div className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-muted)' }}>Ataques</h3>
              <div className="space-y-2">
                {weapons.map(w => (
                  <div key={w.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                    <span style={{ color: 'var(--accent-gold)' }}>{w.atk_bonus}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{w.damage}</span>
                    {w.range && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.range}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <QuickStats
            character={character}
            classResources={classResources ?? []}
            spellSlots={spellSlots ?? []}
            classes={classes ?? []}
            customStats={customStats ?? []}
          />

          {/* Spells */}
          {Object.values(spellsByClass).map(({ class: cls, spells: clsSpells }) => {
            const byLevel: Record<number, typeof clsSpells> = {}
            clsSpells.forEach(s => {
              if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
              byLevel[s.spell_level].push(s)
            })
            return (
              <div key={cls.id} className="rounded-xl border p-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-muted)' }}>
                  Hechizos — {cls.class_name}
                </h3>
                <p className="text-xs mb-3"
                  style={{ color: 'var(--accent-gold)' }}>
                  DC {cls.spell_save_dc} · Ataque +{cls.spell_attack_mod} · {cls.spellcasting_ability?.toUpperCase()}
                </p>
                {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, spellList]) => (
                  <div key={level} className="mb-3">
                    <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      {level === '0' ? 'Trucos' : `Nivel ${level}`}
                    </div>
                    {spellList.map(s => (
                      <div key={s.id} className="flex items-start gap-2 py-1 text-sm border-b last:border-0"
                        style={{ borderColor: 'var(--border)' }}>
                        <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.name}
                        </span>
                        {s.custom_notes && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {s.custom_notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}

          {/* Features */}
          {features && features.length > 0 && (
            <div className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-muted)' }}>Rasgos y habilidades</h3>
              <div className="space-y-3">
                {features.map(f => (
                  <div key={f.id}>
                    <p className="font-semibold text-sm" style={{ color: 'var(--accent-gold)' }}>
                      {f.name}
                      {f.source && <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>({f.source})</span>}
                    </p>
                    {f.description && (
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {f.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roleplay */}
          {(character.personality || character.ideals || character.bonds || character.flaws) && (
            <div className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-muted)' }}>Personalidad</h3>
              {[
                ['Rasgos', character.personality],
                ['Ideales', character.ideals],
                ['Vínculos', character.bonds],
                ['Defectos', character.flaws],
              ].map(([label, value]) => value && (
                <div key={label as string} className="mb-3">
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-gold)' }}>{label}</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
