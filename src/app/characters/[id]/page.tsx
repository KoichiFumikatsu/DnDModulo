import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import AbilitySkillsGrid from '@/components/ui/AbilitySkillsGrid'
import CharacterPortrait from '@/components/ui/CharacterPortrait'
import FeaturesCompact from '@/components/ui/FeaturesCompact'
import WeaponsTab from '@/components/ui/WeaponsTab'
import SpellsTab from '@/components/ui/SpellsTab'
import HpManager from '@/components/ui/HpManager'
import ResourceTracker from '@/components/ui/ResourceTracker'
import EquipmentTracker from './play/EquipmentTracker'
import FEATS_DATA from '@/lib/5etools-processed/feats.json'

const FEAT_DESC_MAP: Record<string, string> = {}
for (const f of FEATS_DATA as { name: string; description: string | null }[]) {
  if (f.name && f.description && !FEAT_DESC_MAP[f.name]) {
    FEAT_DESC_MAP[f.name] = f.description
  }
}

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

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'stats' } = await searchParams
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
    { data: classResources },
    { data: equipment },
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
    supabase.from('character_images').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_class_resources').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_equipment').select('*').eq('character_id', id).order('sort_order'),
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
      <div className="book-nav px-4 py-3">
        <div className="max-w-6xl mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
            <Link href="/dashboard"
              style={{ color: 'var(--gold-light)', fontSize: '0.8rem', textDecoration: 'none', opacity: 0.7, fontFamily: 'Cinzel, serif', flexShrink: 0 }}>
              ← Grimorio
            </Link>
            <div style={{ minWidth: 0 }}>
              <h1 className="cs-nav-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {character.name}
              </h1>
              <p className="cs-nav-subtitle">
                {character.race} · {classLabel} · Level {xpData.level}
              </p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Link href={`/characters/${id}/edit`} className="btn-parchment" style={{ textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* ── Book page tabs ── */}
      <div style={{ background: 'var(--cs-card)', borderBottom: '2px solid var(--cs-gold)' }}>
        <div className="max-w-6xl mx-auto px-4 cs-tabs-bar">
          {[
            { key: 'stats', label: 'Stats' },
            { key: 'weapons', label: 'Weapons' },
            { key: 'spells', label: 'Spells' },
            { key: 'rasgos', label: 'Traits' },
          ].map(({ key, label }) => (
            <Link key={key} href={`/characters/${id}?tab=${key}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '0.55rem 1.4rem',
                fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: tab === key ? 'var(--cs-accent)' : 'var(--cs-text-muted)',
                borderBottom: tab === key ? '3px solid var(--cs-accent)' : '3px solid transparent',
                marginBottom: -2,
                transition: 'color 0.15s',
              }}>
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-3 py-4" style={{ paddingLeft: 'clamp(0.75rem, 3vw, 1.5rem)', paddingRight: 'clamp(0.75rem, 3vw, 1.5rem)' }}>

        {/* ════ STATS TAB ════ */}
        {tab === 'stats' && (
          <div className="cs-stats-grid">

            {/* LEFT: Portrait + Money + Languages + Personality */}
            <div className="cs-stats-left">
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

              {/* Money + Languages side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
                {/* Money */}
                <div className="cs-card--notched" style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                    <img src="/assets/dnd/icon-money.svg" alt="" style={{ width: 13, height: 13 }} />
                    <span className="cs-section-title">Money</span>
                  </div>
                  <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginBottom: '0.4rem' }} />
                  {[
                    { label: 'CP', value: character.cp, icon: '/assets/dnd/icon-coin-cp.svg' },
                    { label: 'SP', value: character.sp, icon: '/assets/dnd/icon-coin-sp.svg' },
                    { label: 'EP', value: 0, icon: '/assets/dnd/icon-coin-ep.svg' },
                    { label: 'GP', value: character.gp, icon: '/assets/dnd/icon-coin-gp.svg' },
                    { label: 'PP', value: character.pp, icon: '/assets/dnd/icon-coin-pp.svg' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.1rem 0' }}>
                      <img src={icon} alt="" style={{ width: 12, height: 12, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontFamily: 'var(--font-montaga)', fontSize: '0.72rem', color: 'var(--cs-text)' }}>{label}</span>
                      <span className="cs-num" style={{ fontSize: '0.9rem', minWidth: 22, textAlign: 'right' }}>
                        {String(value ?? 0).padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Languages */}
                <div className="cs-card--notched" style={{ padding: '0.6rem 0.75rem' }}>
                  <span className="cs-section-title">Languages</span>
                  <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.3rem 0 0.4rem' }} />
                  {langProfs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {langProfs.map(p => (
                        <span key={p.id} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text)' }}>
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Backstory */}
              {character.backstory && (
                <div className="cs-card--notched">
                  <span className="cs-section-title">Backstory</span>
                  <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.4rem 0' }} />
                  <p style={{ fontSize: '0.78rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text)', whiteSpace: 'pre-wrap' }}>{character.backstory}</p>
                </div>
              )}

              {/* Personality */}
              {(character.personality || character.ideals || character.bonds || character.flaws) && (
                <div className="cs-card--notched">
                  <span className="cs-section-title">Personality</span>
                  <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.4rem 0' }} />
                  {([
                    ['Traits', character.personality],
                    ['Ideals', character.ideals],
                    ['Bonds', character.bonds],
                    ['Flaws', character.flaws],
                  ] as [string, string | null][]).map(([label, value]) => value && (
                    <div key={label} style={{ marginBottom: '0.4rem' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--cs-gold-dk)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                      <p style={{ fontSize: '0.8rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CENTER: Combat stats + Ability grid */}
            <div className="cs-stats-center">
              <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true" className="cs-dragons-hide"
                style={{ position: 'absolute', right: 0, top: 0, width: 100, height: 100, pointerEvents: 'none', opacity: 0.9, zIndex: 0 }} />
              <img src="/assets/dnd/dragon-left.svg" alt="" aria-hidden="true" className="cs-dragons-hide"
                style={{ position: 'absolute', left: 0, top: 0, width: 100, height: 100, pointerEvents: 'none', opacity: 0.9, zIndex: 0, transform: 'scaleX(-1)' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* ROW 1: Prof — Level — Hit Die */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
              </div>
            </div>

            {/* RIGHT: HP → Resources → Equipment */}
            <div className="cs-stats-right">
              <HpManager
                characterId={id}
                hpCurrent={character.hp_current}
                hpMax={character.hp_max}
                hpTemp={character.hp_temp ?? 0}
                deathSuccesses={character.death_saves_successes ?? 0}
                deathFailures={character.death_saves_failures ?? 0}
              />

              {(classResources ?? []).filter(r => r.maximum > 0).length > 0 && (
                <ResourceTracker
                  resources={(classResources ?? []).filter(r => r.maximum > 0).map(r => ({
                    id: r.id, name: r.name,
                    current: r.current, maximum: r.maximum,
                    reset_on: r.reset_on ?? null,
                  }))}
                />
              )}

              {(equipment ?? []).length > 0 && (
                <div className="cs-card--notched" style={{ padding: '0.75rem 1rem' }}>
                  <EquipmentTracker initialEquipment={equipment ?? []} variant="parchment" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ WEAPONS TAB ════ */}
        {tab === 'weapons' && (
          <WeaponsTab
            weapons={(weapons ?? []).map(w => ({
              id: w.id, name: w.name, atk_bonus: w.atk_bonus,
              damage: w.damage, damage_type: w.damage_type,
              range: w.range, notes: w.notes,
              ability_mod: w.ability_mod ?? null,
              is_proficient: w.is_proficient ?? false,
              extra_damage: w.extra_damage ?? null,
            }))}
            character={{
              str: character.str, dex: character.dex, con: character.con,
              int: character.int, wis: character.wis, cha: character.cha,
              proficiency_bonus: character.proficiency_bonus,
            }}
          />
        )}

        {/* ════ SPELLS TAB ════ */}
        {tab === 'spells' && (
          <SpellsTab
            characterId={id}
            classes={(classes ?? []).map(c => {
              const abilKey = c.spellcasting_ability as string | null
              const score = abilKey ? (character as Record<string, unknown>)[abilKey] as number ?? null : null
              return {
                id: c.id, class_name: c.class_name, level: c.level,
                spell_save_dc: c.spell_save_dc, spell_attack_mod: c.spell_attack_mod,
                spellcasting_ability: c.spellcasting_ability,
                spellcastingAbilityScore: score,
              }
            })}
            slots={(spellSlots ?? []).map(s => ({
              classId: s.class_id,
              spell_level: s.spell_level, slots_total: s.slots_total, slots_used: s.slots_used,
            }))}
            spells={(spells ?? []).map(s => ({
              id: s.id, spell_level: s.spell_level, name: s.name,
              damage: (s as Record<string, unknown>).damage as string ?? null,
              custom_notes: s.custom_notes, is_prepared: s.is_prepared,
            }))}
          />
        )}

        {/* ════ RASGOS TAB ════ */}
        {tab === 'rasgos' && (
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <FeaturesCompact
              features={(features ?? []).map(f => ({
                id: f.id, name: f.name,
                description: f.description || (f.source === 'feat' ? (FEAT_DESC_MAP[f.name] ?? '') : ''),
                source: f.source, summary: f.summary ?? null,
              }))}
              proficiencyBonus={profBonus}
            />
          </div>
        )}

      </div>
    </div>
  )
}
