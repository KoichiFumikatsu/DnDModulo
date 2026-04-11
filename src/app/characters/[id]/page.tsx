import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import { ABILITY_NAMES, SKILLS_BY_ABILITY, ABILITY_ORDER } from '@/lib/constants'

/* ── Helpers ── */

function modNum(score: number) { return Math.floor((score - 10) / 2) }
function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function passiveScore(
  abilityScore: number, profBonus: number,
  skillKey: string, profs: { name: string; proficiency_level: string }[],
) {
  const m = modNum(abilityScore)
  const p = profs.find(p => p.name === skillKey)
  const bonus = p?.proficiency_level === 'expertise' ? profBonus * 2
    : p?.proficiency_level === 'proficient' ? profBonus : 0
  return 10 + m + bonus
}

/* ══════════════════════════════════════════════════════════════ */

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: character } = await supabase
    .from('characters').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!character) notFound()

  const [
    { data: classes },
    { data: spellSlots },
    { data: spells },
    { data: weapons },
    { data: features },
    { data: proficiencies },
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
  ])

  const classLabel = (classes ?? []).map(c => `${c.class_name} ${c.level}`).join(' / ')
  const xpData = getXPProgress(character.experience_points ?? 0)
  const skillProfs = (proficiencies ?? []).filter(p => p.type === 'skill')
  const langProfs = (proficiencies ?? []).filter(p => p.type === 'language')
  const saveProfs = (proficiencies ?? []).filter(p => p.type === 'saving_throw')

  type SpellRow = NonNullable<typeof spells>[number]
  type ClassRow = NonNullable<typeof classes>[number]
  const spellsByClass: Record<string, { cls: ClassRow; spells: SpellRow[] }> = {}
  for (const cls of (classes ?? [])) {
    const cs = (spells ?? []).filter(s => s.class_id === cls.id)
    if (cs.length > 0) spellsByClass[cls.id] = { cls, spells: cs }
  }

  const abilities: Record<string, number> = {
    str: character.str, dex: character.dex, con: character.con,
    int: character.int, wis: character.wis, cha: character.cha,
  }
  const profBonus = character.proficiency_bonus
  const hitDie = (classes ?? [])[0]?.level ? `d${(classes ?? [])[0]?.level}` : ''

  return (
    <div className="min-h-screen cs-page">
      {/* ── Nav bar (dark, unchanged) ── */}
      <div className="book-nav px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/dashboard"
              style={{ color: 'var(--gold-light)', fontSize: '0.8rem', textDecoration: 'none', opacity: 0.7, fontFamily: 'Cinzel, serif' }}>
              ← Grimorio
            </Link>
            <div>
              <h1 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1.2rem', lineHeight: 1.1 }}>
                {character.name}
              </h1>
              <p style={{ color: 'var(--gold-light)', fontSize: '0.78rem', opacity: 0.75, fontStyle: 'italic' }}>
                {character.race} · {classLabel} · Level {xpData.level}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href={`/characters/${id}/play`} className="btn-crimson" style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
              Modo Mesa
            </Link>
            <Link href={`/characters/${id}/edit`} className="btn-parchment" style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ═══ TOP: Level / Prof / XP ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="cs-heading">Prof</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', fontWeight: 700, color: 'var(--cs-accent)' }}>
              +{profBonus}
            </div>
          </div>
          <div className="cs-shield cs-shield--lg">
            <span className="cs-shield-label">Level</span>
            <span className="cs-shield-value">{xpData.level}</span>
            <span className="cs-shield-sub">{character.experience_points.toLocaleString()} XP</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="cs-heading">Speed</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', fontWeight: 700, color: 'var(--cs-accent)' }}>
              {character.speed}
            </div>
          </div>
        </div>

        {/* ═══ COMBAT ROW: Ini / HP / AC / Hit Die ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="cs-heading">Ini</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cs-text)' }}>
              {sign(modNum(character.dex) + (character.initiative_bonus ?? 0))}
            </div>
          </div>

          <div className="cs-shield cs-shield--lg">
            <span className="cs-shield-label">HP</span>
            <span className="cs-shield-value">{character.hp_current}</span>
            <span className="cs-shield-sub">/ {character.hp_max}{character.hp_temp > 0 ? ` +${character.hp_temp}` : ''}</span>
          </div>

          <div className="cs-shield">
            <span className="cs-shield-label">AC</span>
            <span className="cs-shield-value">{character.ac}</span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="cs-heading">Hit Die</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cs-text)' }}>
              {character.hit_dice_total || '—'}
            </div>
          </div>
        </div>

        {/* ═══ PASSIVE SCORES ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Passive Perception', key: 'Perception', ab: 'wis' },
            { label: 'Passive Investigation', key: 'Investigation', ab: 'int' },
            { label: 'Passive Insight', key: 'Insight', ab: 'wis' },
          ].map(({ label, key, ab }) => (
            <div key={key} className="cs-passive">
              <div className="cs-passive-label">{label}</div>
              <div className="cs-passive-value">{passiveScore(abilities[ab], profBonus, key, skillProfs)}</div>
            </div>
          ))}
        </div>

        <div className="cs-divider" />

        {/* ═══ 3-COLUMN LAYOUT ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: '1.5rem', marginTop: '1.5rem' }}>

          {/* ── LEFT: Portrait + Money + Languages ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Portrait */}
            <div className="cs-frame cs-frame-corners" style={{ position: 'relative', border: '2px solid var(--cs-gold)' }}>
              <div style={{ aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cs-bg)', overflow: 'hidden' }}>
                {character.image_url ? (
                  <img src={character.image_url} alt={character.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '4rem' }}>🧙</span>
                )}
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                padding: '2rem 0.75rem 0.75rem', color: 'white',
              }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700 }}>
                  {character.name}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {character.race} · {classLabel}
                </div>
              </div>
            </div>

            {/* Money */}
            <div className="cs-card">
              <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Money</h3>
              {[
                { label: 'Copper Coins', value: character.cp, color: '#b87333' },
                { label: 'Silver Coins', value: character.sp, color: '#C0C0C0' },
                { label: 'Gold Coins', value: character.gp, color: '#D4A017' },
                { label: 'Platinum Coins', value: character.pp, color: '#E5E4E2' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', borderBottom: '1px solid var(--cs-gold)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--cs-text)' }}>{label}</span>
                  <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color, fontSize: '1rem' }}>
                    {String(value ?? 0).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>

            {/* Languages */}
            {langProfs.length > 0 && (
              <div className="cs-card">
                <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Languages</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {langProfs.map(p => (
                    <span key={p.id} style={{ fontSize: '0.85rem', color: 'var(--cs-text)' }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER: Abilities grouped with skills ── */}
          <div>
            {/* 2x3 grid of ability groups */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {ABILITY_ORDER.map(ab => {
                const score = abilities[ab]
                const m = modNum(score)
                const hasSave = saveProfs.some(p => p.name === ab)
                const saveMod = hasSave ? m + profBonus : m
                const skills = SKILLS_BY_ABILITY[ab]

                return (
                  <div key={ab} className="cs-ability-row" style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
                    {/* Shield */}
                    <div style={{ textAlign: 'center', minWidth: 65, flexShrink: 0 }}>
                      <div className="cs-heading" style={{ marginBottom: 2 }}>{ABILITY_NAMES[ab]}</div>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', fontWeight: 700, color: 'var(--cs-accent)', lineHeight: 1 }}>
                        {sign(m)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cs-text-muted)' }}>{score}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', marginTop: 2 }}>
                        Save {sign(saveMod)}
                      </div>
                      {hasSave && (
                        <span className="cs-dot cs-dot--proficient" style={{ marginTop: 2 }} />
                      )}
                    </div>

                    {/* Skills list */}
                    {skills.length > 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
                        {skills.map(skill => {
                          const prof = skillProfs.find(p => p.name === skill.key)
                          const level = prof?.proficiency_level ?? 'none'
                          const bonus = m + (level === 'expertise' ? profBonus * 2 : level === 'proficient' ? profBonus : 0)
                          return (
                            <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                              <span className={`cs-dot cs-dot--${level}`} />
                              <span style={{
                                flex: 1,
                                color: level !== 'none' ? 'var(--cs-text)' : 'var(--cs-text-muted)',
                                fontWeight: level !== 'none' ? 600 : 400,
                              }}>
                                {skill.name}
                              </span>
                              <span style={{
                                fontWeight: 600, minWidth: 20, textAlign: 'right',
                                color: level === 'expertise' ? 'var(--cs-gold)' : level === 'proficient' ? 'var(--cs-accent)' : 'var(--cs-text-muted)',
                              }}>
                                {sign(bonus)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* CON — show hit die instead */
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="cs-heading" style={{ fontSize: '0.6rem' }}>Hit Die</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cs-accent)' }}>
                          {character.hit_dice_total || '—'}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Weapons */}
            {weapons && weapons.length > 0 && (
              <div className="cs-card" style={{ marginTop: '1rem' }}>
                <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Weapons</h3>
                {weapons.map(w => (
                  <div key={w.id} style={{ display: 'flex', gap: '1rem', padding: '0.3rem 0', borderBottom: '1px solid var(--cs-gold)', fontSize: '0.85rem' }}>
                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--cs-accent)' }}>{w.name}</span>
                    <span style={{ color: 'var(--cs-text-muted)' }}>{w.atk_bonus}</span>
                    <span style={{ color: 'var(--cs-text-muted)' }}>{w.damage}</span>
                    {w.range && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.75rem' }}>{w.range}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Features + Spells + Personality ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Spells */}
            {Object.values(spellsByClass).map(({ cls, spells: clsSpells }) => {
              const byLevel: Record<number, typeof clsSpells> = {}
              clsSpells.forEach(s => {
                if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
                byLevel[s.spell_level].push(s)
              })
              return (
                <div key={cls.id} className="cs-card">
                  <h3 className="cs-heading" style={{ marginBottom: '0.25rem' }}>
                    Spells — {cls.class_name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cs-accent)', marginBottom: '0.5rem' }}>
                    DC {cls.spell_save_dc} · Atk +{cls.spell_attack_mod} · {cls.spellcasting_ability?.toUpperCase()}
                  </div>
                  {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, list]) => (
                    <div key={level} style={{ marginBottom: '0.5rem' }}>
                      <div className="cs-heading" style={{ fontSize: '0.6rem', marginBottom: 2 }}>
                        {level === '0' ? 'Cantrips' : `Level ${level}`}
                      </div>
                      {list.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.15rem 0', borderBottom: '1px solid var(--cs-gold)' }}>
                          <span style={{ color: 'var(--cs-accent)', fontWeight: 500 }}>{s.name}</span>
                          {s.custom_notes && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.7rem' }}>{s.custom_notes}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })}

            {/* Features */}
            {features && features.length > 0 && (
              <div className="cs-frame cs-frame-corners" style={{ position: 'relative', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
                <h3 className="cs-heading" style={{ marginBottom: '0.75rem' }}>Features & Traits</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {features.map(f => (
                    <div key={f.id}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--cs-accent)', fontStyle: 'italic' }}>
                        {f.name}
                      </p>
                      {f.description && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--cs-text)', lineHeight: 1.4, marginTop: '0.15rem' }}>
                          {f.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personality */}
            {(character.personality || character.ideals || character.bonds || character.flaws) && (
              <div className="cs-card">
                <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Personality</h3>
                {[
                  ['Traits', character.personality],
                  ['Ideals', character.ideals],
                  ['Bonds', character.bonds],
                  ['Flaws', character.flaws],
                ].map(([label, value]) => value && (
                  <div key={label as string} style={{ marginBottom: '0.4rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--cs-gold-dk)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--cs-text)' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
