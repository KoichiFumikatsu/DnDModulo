import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuickStats from '@/modules/characters/components/QuickStats'

const ABILITY_NAMES = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' }
const SKILLS = [
  { name: 'Acrobacias', ability: 'dex', key: 'Acrobatics' },
  { name: 'Adiestramiento', ability: 'wis', key: 'Animal Handling' },
  { name: 'Arcanos', ability: 'int', key: 'Arcana' },
  { name: 'Atletismo', ability: 'str', key: 'Athletics' },
  { name: 'Engaño', ability: 'cha', key: 'Deception' },
  { name: 'Historia', ability: 'int', key: 'History' },
  { name: 'Intuición', ability: 'wis', key: 'Insight' },
  { name: 'Intimidación', ability: 'cha', key: 'Intimidation' },
  { name: 'Investigación', ability: 'int', key: 'Investigation' },
  { name: 'Medicina', ability: 'wis', key: 'Medicine' },
  { name: 'Naturaleza', ability: 'int', key: 'Nature' },
  { name: 'Percepción', ability: 'wis', key: 'Perception' },
  { name: 'Perspicacia', ability: 'wis', key: 'Insight' },
  { name: 'Persuasión', ability: 'cha', key: 'Persuasion' },
  { name: 'Religión', ability: 'int', key: 'Religion' },
  { name: 'Sigilo', ability: 'dex', key: 'Stealth' },
  { name: 'Juego de Manos', ability: 'dex', key: 'Sleight of Hand' },
  { name: 'Supervivencia', ability: 'wis', key: 'Survival' },
  { name: 'Actuación', ability: 'cha', key: 'Performance' },
]

function mod(score: number) {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function AbilityBox({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border py-3 px-2"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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

  const spellsByClass: Record<string, { class: typeof classes[0]; spells: typeof spells }> = {}
  for (const cls of (classes ?? [])) {
    const classSpells = (spells ?? []).filter(s => s.class_id === cls.id)
    if (classSpells.length > 0) {
      spellsByClass[cls.id] = { class: cls, spells: classSpells }
    }
  }

  const langProfs = (proficiencies ?? []).filter(p => p.type === 'language')
  const otherProfs = (proficiencies ?? []).filter(p => p.type !== 'language' && p.type !== 'skill' && p.type !== 'saving_throw')
  const skillProfs = (proficiencies ?? []).filter(p => p.type === 'skill')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard"
              className="text-sm opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-primary)' }}>
              ← Mis PJs
            </Link>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--accent-gold)' }}>
                {character.name}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {character.race} · {classLabel}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/characters/${id}/play`}
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}>
              Modo Mesa ⚡
            </Link>
            <Link href={`/characters/${id}/edit`}
              className="px-4 py-2 rounded-lg font-semibold text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Portrait */}
          <div className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
                ['XP', character.experience_points?.toLocaleString()],
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
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
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
              <div key={label} className="rounded-lg border p-3 text-center"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="rounded-xl border p-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-muted)' }}>Habilidades</h3>
            <div className="space-y-1">
              {SKILLS.map(skill => {
                const prof = skillProfs.find(p => p.name === skill.key)
                const abilityMod = Math.floor((character[skill.ability as keyof typeof character] as number - 10) / 2)
                const bonus = prof
                  ? abilityMod + (prof.proficiency_level === 'expertise' ? character.proficiency_bonus * 2 : character.proficiency_bonus)
                  : abilityMod
                const sign = bonus >= 0 ? '+' : ''
                return (
                  <div key={skill.key} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: prof
                          ? prof.proficiency_level === 'expertise'
                            ? 'var(--accent-gold)'
                            : 'var(--accent)'
                          : 'var(--border)',
                      }} />
                    <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                    <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>
                      {sign}{bonus}
                    </span>
                    <span className="text-xs w-8 text-right" style={{ color: 'var(--text-muted)' }}>
                      {ABILITY_NAMES[skill.ability as keyof typeof ABILITY_NAMES]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

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
