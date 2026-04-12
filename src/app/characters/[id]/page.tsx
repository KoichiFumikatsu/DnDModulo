import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import AbilitySkillsGrid from '@/components/ui/AbilitySkillsGrid'
import CharacterPortrait from '@/components/ui/CharacterPortrait'
import FeaturesCompact from '@/components/ui/FeaturesCompact'

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

/* SVG medieval shield outline */
function ShieldSvg() {
  return (
    <svg className="cs-shield-svg" viewBox="0 0 100 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4,2 L96,2 Q98,2 98,4 L98,65 Q98,80 50,116 Q2,80 2,65 L2,4 Q2,2 4,2 Z"
        fill="var(--cs-card, #FBF3E4)"
        stroke="var(--cs-gold, #C8A855)"
        strokeWidth="2.5"
      />
      <path
        d="M8,6 L92,6 Q94,6 94,8 L94,63 Q94,77 50,111 Q6,77 6,63 L6,8 Q6,6 8,6 Z"
        fill="none"
        stroke="var(--cs-gold, #C8A855)"
        strokeWidth="0.7"
        opacity="0.5"
      />
    </svg>
  )
}

/* Small shield for secondary stats */
function ShieldSmallSvg() {
  return (
    <svg className="cs-shield-svg" viewBox="0 0 100 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4,2 L96,2 Q98,2 98,4 L98,65 Q98,80 50,116 Q2,80 2,65 L2,4 Q2,2 4,2 Z"
        fill="var(--cs-card, #FBF3E4)"
        stroke="var(--cs-gold, #C8A855)"
        strokeWidth="3"
      />
    </svg>
  )
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
    { data: charImages },
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
    supabase.from('character_images').select('*').eq('character_id', id).order('sort_order'),
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

        {/* ═══ ROW 1: Prof — Level — Hit Die ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: '1.5rem', marginBottom: '0.75rem' }}>
          <div className="cs-shield cs-shield--sm">
            <ShieldSmallSvg />
            <span className="cs-shield-label">Prof</span>
            <span className="cs-shield-value">+{profBonus}</span>
          </div>

          <div className="cs-shield cs-shield--lg">
            <ShieldSvg />
            <span className="cs-shield-label">Level</span>
            <span className="cs-shield-value">{xpData.level}</span>
            <span className="cs-shield-sub">{character.experience_points.toLocaleString()} XP</span>
          </div>

          <div className="cs-shield cs-shield--sm">
            <ShieldSmallSvg />
            <span className="cs-shield-label">Hit Die</span>
            <span className="cs-shield-value" style={{ fontSize: '0.85rem' }}>{character.hit_dice_total || '—'}</span>
          </div>
        </div>

        {/* ═══ ROW 2: Ini — HP — AC — Spd ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="cs-shield cs-shield--sm">
            <ShieldSmallSvg />
            <span className="cs-shield-label">Ini</span>
            <span className="cs-shield-value">{sign(modNum(character.dex) + (character.initiative_bonus ?? 0))}</span>
          </div>

          <div className="cs-shield cs-shield--xl">
            <ShieldSvg />
            <span className="cs-shield-label">HP</span>
            <span className="cs-shield-value">{character.hp_current}</span>
            <div className="cs-shield-details">
              <span>{character.hp_max}</span>
              <span>+{character.hp_temp || 0}</span>
            </div>
          </div>

          <div className="cs-shield cs-shield--xl">
            <ShieldSvg />
            <span className="cs-shield-label">AC</span>
            <span className="cs-shield-value">{character.ac}</span>
          </div>

          <div className="cs-shield cs-shield--sm">
            <ShieldSmallSvg />
            <span className="cs-shield-label">Spd</span>
            <span className="cs-shield-value">{character.speed}</span>
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
            <CharacterPortrait
              characterId={id}
              userId={user.id}
              characterName={character.name}
              classLabel={classLabel}
              race={character.race}
              mainImageUrl={character.image_url}
              images={(charImages ?? []).map(img => ({
                id: img.id,
                image_url: img.image_url,
                label: img.label,
                sort_order: img.sort_order,
                is_active: img.is_active,
              }))}
            />

            {/* Money */}
            <div className="cs-card--notched">
              <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Money</h3>
              {[
                { label: 'CP', value: character.cp, color: '#b87333' },
                { label: 'SP', value: character.sp, color: '#C0C0C0' },
                { label: 'GP', value: character.gp, color: '#D4A017' },
                { label: 'PP', value: character.pp, color: '#E5E4E2' },
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
              <div className="cs-card--notched">
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

          {/* ── CENTER: Abilities grouped with skills + dice roller ── */}
          <div>
            <AbilitySkillsGrid
              abilities={abilities}
              proficiencyBonus={profBonus}
              skillProfs={skillProfs.map(p => ({ name: p.name, proficiency_level: p.proficiency_level, has_advantage: p.has_advantage }))}
              saveProfs={saveProfs.map(p => ({ name: p.name }))}
              hitDiceTotal={character.hit_dice_total || ''}
            />

            {/* Weapons */}
            {weapons && weapons.length > 0 && (
              <div className="cs-card--notched" style={{ marginTop: '1rem' }}>
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
                <div key={cls.id} className="cs-card--notched">
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

            {/* Features — compact with click-to-expand modal */}
            <FeaturesCompact
              features={(features ?? []).map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                source: f.source,
                summary: f.summary ?? null,
              }))}
            />

            {/* Personality */}
            {(character.personality || character.ideals || character.bonds || character.flaws) && (
              <div className="cs-card--notched">
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
