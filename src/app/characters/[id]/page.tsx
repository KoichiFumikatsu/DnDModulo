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

/* Figma shield assets */
function ShieldXl() {
  return <img className="cs-shield-svg" src="/assets/dnd/shield-md.svg" alt="" aria-hidden="true" />
}
function ShieldLg() {
  return <img className="cs-shield-svg" src="/assets/dnd/shield-sm.svg" alt="" aria-hidden="true" />
}
function ShieldSm() {
  return <img className="cs-shield-svg" src="/assets/dnd/shield-sm.svg" alt="" aria-hidden="true" />
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

        {/* ═══ MAIN ROW: Portrait | Combat stats + Ability grid | Additional stats ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr 210px', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── LEFT: Portrait ── */}
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

          {/* ── CENTER: All stats ── */}
          <div style={{ position: 'relative' }}>

            {/* Dragon ornaments — absolute at top corners of stats area */}
            <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
              style={{ position: 'absolute', right: 0, top: 0, width: 100, height: 100, pointerEvents: 'none', opacity: 0.9, zIndex: 0 }} />
            <img src="/assets/dnd/dragon-left.svg" alt="" aria-hidden="true"
              style={{ position: 'absolute', left: 0, top: 0, width: 100, height: 100, pointerEvents: 'none', opacity: 0.9, zIndex: 0, transform: 'scaleX(-1)' }} />

            {/* ROW 1: Prof — Level — Hit Die */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>
              <div className="cs-shield cs-shield--sm">
                <ShieldSm />
                <span className="cs-shield-label">Prof</span>
                <span className="cs-shield-value cs-num">+{profBonus}</span>
              </div>
              <div className="cs-shield cs-shield--lg">
                <ShieldLg />
                <span className="cs-shield-label">Level</span>
                <span className="cs-shield-value cs-num">{xpData.level}</span>
                <span className="cs-shield-sub">{character.experience_points.toLocaleString()} XP</span>
              </div>
              <div className="cs-shield cs-shield--sm">
                <ShieldSm />
                <span className="cs-shield-label">Hit Die</span>
                <span className="cs-shield-value cs-num" style={{ fontSize: '0.85rem' }}>{character.hit_dice_total || '—'}</span>
              </div>
            </div>

            {/* ROW 2: Ini — HP — AC — Spd */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
              <div className="cs-shield cs-shield--sm">
                <ShieldSm />
                <span className="cs-shield-label">Ini</span>
                <span className="cs-shield-value cs-num">{sign(modNum(character.dex) + (character.initiative_bonus ?? 0))}</span>
              </div>
              <div className="cs-shield cs-shield--xl">
                <ShieldXl />
                <span className="cs-shield-label">HP</span>
                <span className="cs-shield-value cs-num">{character.hp_current}</span>
                <div className="cs-shield-details">
                  <span style={{ fontFamily: 'var(--font-montaga)' }}>{character.hp_max}</span>
                  <span style={{ fontFamily: 'var(--font-montaga)' }}>+{character.hp_temp || 0}</span>
                </div>
              </div>
              <div className="cs-shield cs-shield--xl">
                <ShieldXl />
                <span className="cs-shield-label">AC</span>
                <span className="cs-shield-value cs-num">{character.ac}</span>
              </div>
              <div className="cs-shield cs-shield--sm">
                <ShieldSm />
                <span className="cs-shield-label">Spd</span>
                <span className="cs-shield-value cs-num">{character.speed}</span>
              </div>
            </div>

            {/* Passive scores */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Passive Perception', key: 'Perception', ab: 'wis' },
                { label: 'Passive Investigation', key: 'Investigation', ab: 'int' },
                { label: 'Passive Insight', key: 'Insight', ab: 'wis' },
              ].map(({ label, key, ab }) => (
                <div key={key} className="cs-passive">
                  <div className="cs-passive-label" style={{ fontFamily: 'var(--font-montaga, Georgia, serif)' }}>{label}</div>
                  <div className="cs-passive-value cs-num">{passiveScore(abilities[ab], profBonus, key, skillProfs)}</div>
                </div>
              ))}
            </div>

            <div className="cs-divider" />

            {/* Ability grid */}
            <div style={{ marginTop: '1rem' }}>
              <AbilitySkillsGrid
                abilities={abilities}
                proficiencyBonus={profBonus}
                skillProfs={skillProfs.map(p => ({ name: p.name, proficiency_level: p.proficiency_level, has_advantage: p.has_advantage }))}
                saveProfs={saveProfs.map(p => ({ name: p.name }))}
                hitDiceTotal={character.hit_dice_total || ''}
              />
            </div>

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

          {/* ── RIGHT: Money + Languages + Features + Spells ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Money */}
            <div className="cs-card--notched" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <img src="/assets/dnd/icon-money.svg" alt="" style={{ width: 15, height: 15 }} />
                <span className="cs-section-title">Money</span>
              </div>
              <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginBottom: '0.5rem' }} />
              {[
                { label: 'Copper Coins', value: character.cp, icon: '/assets/dnd/icon-coin-cp.svg' },
                { label: 'Silver Coins', value: character.sp, icon: '/assets/dnd/icon-coin-sp.svg' },
                { label: 'Electrum', value: 0, icon: '/assets/dnd/icon-coin-ep.svg' },
                { label: 'Gold Coins', value: character.gp, icon: '/assets/dnd/icon-coin-gp.svg' },
                { label: 'Platinum', value: character.pp, icon: '/assets/dnd/icon-coin-pp.svg' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.15rem 0' }}>
                  <img src={icon} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)' }}>{label}</span>
                  <span className="cs-num" style={{ fontSize: '1rem', minWidth: 26, textAlign: 'right' }}>
                    {String(value ?? 0).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>

            {/* Languages */}
            {langProfs.length > 0 && (
              <div className="cs-card--notched">
                <span className="cs-section-title">Languages</span>
                <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.4rem 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {langProfs.map(p => (
                    <span key={p.id} style={{ fontSize: '0.82rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text)' }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Features compact */}
            <FeaturesCompact
              features={(features ?? []).map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                source: f.source,
                summary: f.summary ?? null,
              }))}
            />

            {/* Spells */}
            {Object.values(spellsByClass).map(({ cls, spells: clsSpells }) => {
              const byLevel: Record<number, typeof clsSpells> = {}
              clsSpells.forEach(s => {
                if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
                byLevel[s.spell_level].push(s)
              })
              return (
                <div key={cls.id} className="cs-card--notched">
                  <h3 className="cs-heading" style={{ marginBottom: '0.25rem' }}>Spells — {cls.class_name}</h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--cs-accent)', marginBottom: '0.4rem' }}>
                    DC {cls.spell_save_dc} · +{cls.spell_attack_mod} · {cls.spellcasting_ability?.toUpperCase()}
                  </div>
                  {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, list]) => (
                    <div key={level} style={{ marginBottom: '0.4rem' }}>
                      <div className="cs-heading" style={{ fontSize: '0.58rem', marginBottom: 2 }}>
                        {level === '0' ? 'Cantrips' : `Level ${level}`}
                      </div>
                      {list.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.1rem 0', borderBottom: '1px solid var(--cs-gold)' }}>
                          <span style={{ color: 'var(--cs-accent)', fontWeight: 500 }}>{s.name}</span>
                          {s.custom_notes && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.68rem' }}>{s.custom_notes}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })}

            {/* Personality */}
            {(character.personality || character.ideals || character.bonds || character.flaws) && (
              <div className="cs-card--notched">
                <span className="cs-section-title">Personality</span>
                <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.4rem 0' }} />
                {[
                  ['Traits', character.personality],
                  ['Ideals', character.ideals],
                  ['Bonds', character.bonds],
                  ['Flaws', character.flaws],
                ].map(([label, value]) => value && (
                  <div key={label as string} style={{ marginBottom: '0.4rem' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--cs-gold-dk)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                    <p style={{ fontSize: '0.8rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text)' }}>{value}</p>
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
