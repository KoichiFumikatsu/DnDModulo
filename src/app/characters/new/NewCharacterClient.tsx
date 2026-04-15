'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  type ClassMap, type RaceAbility, type Feat, type ClassDetail,
} from '@/lib/5etools/data'
import { getLevelFromXP, getProficiencyBonus, XP_THRESHOLDS } from '@/lib/5etools/xp'
import Autocomplete from '@/components/ui/Autocomplete'
import FeatModal from '@/components/ui/FeatModal'

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

const SPELLCASTING_ABILITIES: Record<string, string> = {
  'Bard': 'cha', 'Cleric': 'wis', 'Druid': 'wis', 'Sorcerer': 'cha',
  'Wizard': 'int', 'Paladin': 'cha', 'Ranger': 'wis', 'Warlock': 'cha',
  'Artificer': 'int',
}

const AB_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
type AbKey = typeof AB_KEYS[number]
type Abilities = Record<AbKey, number>

interface ClassEntry {
  class_name: string; level: number; subclass_name: string
  is_primary: boolean; is_homebrew: boolean; homebrew_url: string
}

interface ASIChoice {
  type: 'asi' | 'feat'
  // ASI: +2 to one or +1 to two
  asi_mode?: '2to1' | '1to2'
  asi_stat1?: AbKey
  asi_stat2?: AbKey
  feat_name?: string
  feat_ability?: Array<Record<string, unknown>>  // raw ability data from feat
  feat_ability_choice?: AbKey  // user pick when feat has a choose option
}

interface DiceRoll { dice: number[]; dropped: number; total: number }

// ── Helpers ──

function L({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem',
      fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em',
      color: 'var(--cs-text)',
    }}>{children}</label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><L>{label}</L>{children}</div>
}

function modVal(score: number) { return Math.floor((score - 10) / 2) }
function modStr(score: number) { const m = modVal(score); return m >= 0 ? `+${m}` : `${m}` }

function roll4d6drop1(): DiceRoll {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
  const sorted = [...dice].sort((a, b) => a - b)
  const dropped = sorted[0]
  const total = sorted.slice(1).reduce((s, d) => s + d, 0)
  return { dice, dropped, total }
}

function rollDie(faces: number): number {
  return Math.floor(Math.random() * faces) + 1
}

// Compute ASI count per class based on class details and level
function getASICount(className: string, level: number, details: Record<string, ClassDetail>): number {
  const cd = details[className]
  if (!cd) {
    // Fallback: standard 4,8,12,16,19
    return [4, 8, 12, 16, 19].filter(l => l <= level).length
  }
  return cd.asiLevels.filter(l => l <= level).length
}

function getTotalASICount(classes: ClassEntry[], details: Record<string, ClassDetail>): number {
  return classes.reduce((sum, cls) => {
    if (!cls.class_name) return sum
    return sum + getASICount(cls.class_name, cls.level, details)
  }, 0)
}

// ───────────────────── MAIN COMPONENT ─────────────────────

export interface NewCharacterClientProps {
  races: string[]
  backgrounds: string[]
  classMap: ClassMap
  raceAbilities: Record<string, RaceAbility>
  feats: Feat[]
  classDetails: Record<string, ClassDetail>
}

export default function NewCharacterClient({
  races,
  backgrounds,
  classMap,
  raceAbilities,
  feats,
  classDetails,
}: NewCharacterClientProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const classNames = Object.keys(classMap).sort()

  // ── Basic info ──
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [background, setBackground] = useState('')
  const [alignment, setAlignment] = useState('')
  const [xp, setXp] = useState(0)
  const [speed, setSpeed] = useState(30)

  // Derived
  const totalLevel = getLevelFromXP(xp)
  const profBonus = getProficiencyBonus(totalLevel)

  // ── Classes ──
  const [classes, setClasses] = useState<ClassEntry[]>([
    { class_name: '', level: 1, subclass_name: '', is_primary: true, is_homebrew: false, homebrew_url: '' }
  ])
  const assignedLevels = classes.reduce((sum, c) => sum + (c.level || 0), 0)
  const remainingLevels = totalLevel - assignedLevels

  // ── Base abilities (before bonuses) ──
  const [baseAbilities, setBaseAbilities] = useState<Abilities>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  const [diceRolls, setDiceRolls] = useState<Partial<Record<AbKey, DiceRoll>>>({})

  // ── Racial bonus choice (for Custom Origin / Half-Elf style) ──
  const [racialChoices, setRacialChoices] = useState<AbKey[]>([])

  // ── ASI choices ──
  const [asiChoices, setAsiChoices] = useState<ASIChoice[]>([])
  const [featModalOpen, setFeatModalOpen] = useState(false)
  const [featModalASIIndex, setFeatModalASIIndex] = useState(-1)

  // ── HP ──
  const [hpRolls, setHpRolls] = useState<number[]>([]) // per level rolled (starting from level 2)
  const [hpManualOverride, setHpManualOverride] = useState<number | null>(null)

  // ── AC ──
  const [acManual, setAcManual] = useState<number | null>(null)

  // Compute racial bonuses
  const racialBonus = useCallback((): Partial<Abilities> => {
    const ra = raceAbilities[race]
    if (!ra) return {}
    const bonus: Partial<Abilities> = {}
    for (const [k, v] of Object.entries(ra.fixed)) {
      if (AB_KEYS.includes(k as AbKey)) bonus[k as AbKey] = v
    }
    // Apply choices
    for (const chosen of racialChoices) {
      bonus[chosen] = (bonus[chosen] ?? 0) + 1
    }
    return bonus
  }, [race, raceAbilities, racialChoices])

  // Compute ASI bonuses (including feat ability bonuses)
  const asiBonuses = useCallback((): Partial<Abilities> => {
    const bonus: Partial<Abilities> = {}
    for (const asi of asiChoices) {
      if (asi.type === 'asi') {
        if (asi.asi_mode === '2to1' && asi.asi_stat1) {
          bonus[asi.asi_stat1] = (bonus[asi.asi_stat1] ?? 0) + 2
        } else if (asi.asi_mode === '1to2') {
          if (asi.asi_stat1) bonus[asi.asi_stat1] = (bonus[asi.asi_stat1] ?? 0) + 1
          if (asi.asi_stat2) bonus[asi.asi_stat2] = (bonus[asi.asi_stat2] ?? 0) + 1
        }
      } else if (asi.type === 'feat' && asi.feat_ability) {
        for (const ab of asi.feat_ability) {
          for (const [k, v] of Object.entries(ab)) {
            if (k === 'choose') {
              // User picks from a list — apply their choice
              if (asi.feat_ability_choice) {
                const c = v as { amount?: number }
                const amt = c.amount ?? 1
                bonus[asi.feat_ability_choice] = (bonus[asi.feat_ability_choice] ?? 0) + amt
              }
            } else if (AB_KEYS.includes(k as AbKey) && typeof v === 'number') {
              bonus[k as AbKey] = (bonus[k as AbKey] ?? 0) + v
            }
          }
        }
      }
    }
    return bonus
  }, [asiChoices])

  // Final abilities
  const abilities: Abilities = { ...baseAbilities }
  const rb = racialBonus()
  const ab = asiBonuses()
  for (const k of AB_KEYS) {
    abilities[k] = baseAbilities[k] + (rb[k] ?? 0) + (ab[k] ?? 0)
  }

  // AC auto
  const autoAC = 10 + modVal(abilities.dex)
  const ac = acManual ?? autoAC

  // HP auto
  const primaryClass = classes.find(c => c.is_primary && c.class_name) ?? classes[0]
  const primaryHitDie = classDetails[primaryClass?.class_name]?.hitDie ?? 8
  const conMod = modVal(abilities.con)
  const hpLevel1 = primaryHitDie + conMod
  const hpFromRolls = hpRolls.reduce((s, r) => s + r + conMod, 0)
  const autoHP = Math.max(1, hpLevel1 + hpFromRolls)
  const hpMax = hpManualOverride ?? autoHP

  // Total ASI count
  const totalASIs = getTotalASICount(classes, classDetails)

  function resizeASIChoices(nextTotalASIs: number) {
    setAsiChoices(prev => {
      if (prev.length === nextTotalASIs) return prev
      if (prev.length < nextTotalASIs) {
        return [...prev, ...Array.from({ length: nextTotalASIs - prev.length }, () => ({ type: 'asi' as const, asi_mode: '2to1' as const }))]
      }
      return prev.slice(0, nextTotalASIs)
    })
  }

  function handleRaceChange(nextRace: string) {
    setRace(nextRace)
    setRacialChoices([])
  }

  // ── Class helpers ──
  function addClassEntry() {
    const nextClasses = [...classes, { class_name: '', level: 1, subclass_name: '', is_primary: false, is_homebrew: false, homebrew_url: '' }]
    setClasses(nextClasses)
    resizeASIChoices(getTotalASICount(nextClasses, classDetails))
  }
  function removeClassEntry(i: number) {
    const nextClasses = classes.filter((_, idx) => idx !== i)
    setClasses(nextClasses)
    resizeASIChoices(getTotalASICount(nextClasses, classDetails))
  }
  function updateClass(i: number, field: keyof ClassEntry, value: string | number | boolean) {
    const nextClasses = classes.map((c, idx) => {
      if (idx !== i) return c
      const updated = { ...c, [field]: value }
      if (field === 'class_name') updated.subclass_name = ''
      if (field === 'is_homebrew' && !value) updated.homebrew_url = ''
      return updated
    })
    setClasses(nextClasses)
    resizeASIChoices(getTotalASICount(nextClasses, classDetails))
  }

  // ── Dice rolling ──
  function rollOneAbility(ab: AbKey) {
    const result = roll4d6drop1()
    setDiceRolls(prev => ({ ...prev, [ab]: result }))
    setBaseAbilities(prev => ({ ...prev, [ab]: result.total }))
  }
  function rollAllAbilities() {
    const newRolls: Partial<Record<AbKey, DiceRoll>> = {}
    const newAb: Abilities = { ...baseAbilities }
    for (const ab of AB_KEYS) {
      const result = roll4d6drop1()
      newRolls[ab] = result
      newAb[ab] = result.total
    }
    setDiceRolls(newRolls)
    setBaseAbilities(newAb)
  }

  function rollHPForLevel(levelIndex: number) {
    const result = rollDie(primaryHitDie)
    setHpRolls(prev => {
      const copy = [...prev]
      copy[levelIndex] = result
      return copy
    })
    setHpManualOverride(null)
  }
  function rollAllHP() {
    const levels = totalLevel - 1
    if (levels <= 0) return
    const rolls = Array.from({ length: levels }, () => rollDie(primaryHitDie))
    setHpRolls(rolls)
    setHpManualOverride(null)
  }

  // ── ASI helpers ──
  function updateASI(index: number, changes: Partial<ASIChoice>) {
    setAsiChoices(prev => prev.map((a, i) => i === index ? { ...a, ...changes } : a))
  }
  function openFeatModal(asiIndex: number) {
    setFeatModalASIIndex(asiIndex)
    setFeatModalOpen(true)
  }
  function selectFeat(feat: Feat) {
    updateASI(featModalASIIndex, {
      type: 'feat', feat_name: feat.name,
      feat_ability: feat.ability ?? [],
      feat_ability_choice: undefined,
    })
    setFeatModalOpen(false)
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    if (classes.every(c => !c.class_name)) { setError('Al menos una clase es requerida'); return }
    if (remainingLevels < 0) { setError('Los niveles asignados superan el nivel total por XP'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: character, error: charErr } = await supabase
      .from('characters')
      .insert({
        user_id: user.id, name, race, background, alignment,
        experience_points: xp, speed, ...abilities,
        hp_max: hpMax, hp_current: hpMax, ac, proficiency_bonus: profBonus,
        personality, ideals, bonds, flaws,
      })
      .select().single()

    if (charErr || !character) {
      setError(charErr?.message ?? 'Error al crear personaje')
      setLoading(false)
      return
    }

    const validClasses = classes.filter(c => c.class_name)
    for (const cls of validClasses) {
      const spellcastingAbility = SPELLCASTING_ABILITIES[cls.class_name] ?? null
      const { data: classData } = await supabase
        .from('character_classes')
        .insert({
          character_id: character.id,
          class_name: cls.class_name,
          subclass_name: cls.subclass_name || null,
          level: cls.level, is_primary: cls.is_primary,
          is_homebrew: cls.is_homebrew, homebrew_url: cls.homebrew_url || null,
          spellcasting_ability: spellcastingAbility,
          spell_save_dc: spellcastingAbility
            ? 8 + profBonus + modVal(abilities[spellcastingAbility as AbKey])
            : null,
          spell_attack_mod: spellcastingAbility
            ? profBonus + modVal(abilities[spellcastingAbility as AbKey])
            : null,
        })
        .select().single()

      if (classData && spellcastingAbility) {
        const slots = getSpellSlots(cls.class_name, cls.level)
        for (const [lvl, total] of Object.entries(slots)) {
          if (total > 0) {
            await supabase.from('character_spell_slots').insert({
              character_id: character.id, class_id: classData.id,
              spell_level: parseInt(lvl), slots_total: total, slots_used: 0,
            })
          }
        }
      }
    }

    // Save feats as character features
    for (const asi of asiChoices) {
      if (asi.type === 'feat' && asi.feat_name) {
        await supabase.from('character_features').insert({
          character_id: character.id,
          name: asi.feat_name,
          description: '',
          source: 'feat',
        })
      }
    }

    router.push(`/characters/${character.id}/edit`)
  }

  // ── Roleplay ──
  const [personality, setPersonality] = useState('')
  const [ideals, setIdeals] = useState('')
  const [bonds, setBonds] = useState('')
  const [flaws, setFlaws] = useState('')

  // ── Styles ──
  const darkInput: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.75rem',
    background: 'rgba(255,255,255,0.6)', border: '1px solid var(--cs-gold-dk)',
    color: 'var(--cs-text)', fontFamily: 'var(--font-crimson, serif)', fontSize: '1rem',
    outline: 'none', borderRadius: '2px',
  }
  const darkSelect: React.CSSProperties = { ...darkInput, cursor: 'pointer', appearance: 'auto' as const }
  const sectionBox: React.CSSProperties = {
    padding: '0.75rem 1rem', background: 'rgba(201,173,106,0.08)',
    border: '1px solid var(--cs-gold)',
  }

  const STEPS = ['Básico', 'Clases', 'Stats', 'Personalidad']

  // Racial ability info
  const currentRacialAbility = raceAbilities[race]
  const hasRacialChoice = currentRacialAbility?.choose
  const hasNoRacialData = race.length > 0 && !currentRacialAbility

  return (
    <div className="cs-page min-h-screen">
      {/* Header */}
      <div className="book-nav px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard"
          style={{ color: 'var(--cs-text-muted)', fontSize: '0.82rem', textDecoration: 'none', fontFamily: 'var(--font-cinzel, serif)' }}>
          ← Grimorio
        </Link>
        <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.1rem' }}>
          Nuevo Personaje
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '1rem 1.5rem 0', maxWidth: 760, margin: '0 auto' }}>
        {STEPS.map((label, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={`tab-bookmark ${step === i + 1 ? 'active' : ''}`}
            style={{ flex: 1 }}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
        {error && (
          <div style={{ background: 'rgba(125,34,22,0.1)', color: 'var(--cs-accent)', padding: '0.6rem 1rem', marginBottom: '1rem', border: '1px solid var(--cs-accent)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {/* ── PASO 1: BÁSICO ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.1rem' }}>
              Información Básica
            </h2>
            <Field label="Nombre del personaje *">
              <input value={name} onChange={e => setName(e.target.value)} style={darkInput} placeholder="Y'Sera..." />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Autocomplete label="Raza" value={race} onChange={handleRaceChange} options={races} placeholder="Elf, Human, Tiefling..." />
              <Autocomplete label="Trasfondo" value={background} onChange={setBackground} options={backgrounds} placeholder="Far Traveler, Sage..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Alineamiento">
                <select value={alignment} onChange={e => setAlignment(e.target.value)} style={darkSelect}>
                  <option value="">— Seleccionar —</option>
                  {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Velocidad (ft)">
                <input type="number" value={speed} onChange={e => setSpeed(parseInt(e.target.value) || 30)} style={darkInput} />
              </Field>
            </div>
            <Field label="Experiencia (XP)">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button"
                  onClick={() => { const lvl = getLevelFromXP(xp); if (lvl > 1) setXp(XP_THRESHOLDS[lvl - 2]) }}
                  style={{ padding: '6px 12px', background: 'rgba(201,173,106,0.15)', border: '1px solid rgba(201,173,106,0.4)', color: 'var(--cs-gold)', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                  − Nivel
                </button>
                <input type="number" value={xp}
                  onChange={e => setXp(parseInt(e.target.value) || 0)}
                  style={{ ...darkInput, flex: 1 }} min={0} />
                <button type="button"
                  onClick={() => { const lvl = getLevelFromXP(xp); if (lvl < 20) setXp(XP_THRESHOLDS[lvl]) }}
                  style={{ padding: '6px 12px', background: 'rgba(201,173,106,0.15)', border: '1px solid rgba(201,173,106,0.4)', color: 'var(--cs-gold)', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                  + Nivel
                </button>
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--cs-gold)', fontFamily: 'var(--font-cinzel, serif)' }}>
                Nivel {totalLevel} — Bonus de proficiencia +{profBonus}
              </div>
            </Field>
          </div>
        )}

        {/* ── PASO 2: CLASES ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.1rem', margin: 0 }}>Clases</h2>
              <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-cinzel, serif)' }}>
                <span style={{ color: 'var(--cs-text-muted)' }}>Nivel total: {totalLevel}</span>
                {remainingLevels > 0 && <span style={{ color: 'var(--cs-gold)', marginLeft: '0.75rem' }}>Por asignar: {remainingLevels}</span>}
                {remainingLevels < 0 && <span style={{ color: '#f87171', marginLeft: '0.75rem' }}>Excedido: {Math.abs(remainingLevels)}</span>}
              </div>
            </div>

            {classes.map((cls, i) => {
              const subOpts = classMap[cls.class_name] ?? []
              const maxLvl = cls.level + Math.max(0, remainingLevels)
              return (
                <div key={i} style={{ border: '1px solid var(--cs-gold-dk)', padding: '1rem', background: 'rgba(201,173,106,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-cinzel, serif)' }}>
                      Clase {i + 1} {cls.is_primary && '(principal)'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-cinzel, serif)' }}>
                        <input type="checkbox" checked={cls.is_homebrew} onChange={e => updateClass(i, 'is_homebrew', e.target.checked)} style={{ accentColor: 'var(--cs-gold)' }} />
                        Homebrew
                      </label>
                      {classes.length > 1 && (
                        <button onClick={() => removeClassEntry(i)} style={{ color: '#f87171', fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer' }}>Eliminar</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <Autocomplete label="Clase" value={cls.class_name} onChange={val => updateClass(i, 'class_name', val)} options={classNames} placeholder="Fighter, Wizard, Rogue..." />
                    <div style={{ width: '5rem' }}>
                      <Field label="Nivel">
                        <input type="number" value={cls.level} min={1} max={Math.min(20, maxLvl)}
                          onChange={e => updateClass(i, 'level', Math.max(1, parseInt(e.target.value) || 1))} style={darkInput} />
                      </Field>
                    </div>
                  </div>
                  {cls.is_homebrew ? (
                    <>
                      <Field label="Subclase (homebrew)">
                        <input value={cls.subclass_name} onChange={e => updateClass(i, 'subclass_name', e.target.value)} style={darkInput} placeholder="Nombre de la subclase homebrew..." />
                      </Field>
                      <div style={{ marginTop: '0.75rem' }}>
                        <Field label="Enlace fuente homebrew (opcional)">
                          <input value={cls.homebrew_url} onChange={e => updateClass(i, 'homebrew_url', e.target.value)} style={darkInput} placeholder="https://..." />
                        </Field>
                      </div>
                    </>
                  ) : (
                    <Autocomplete label="Subclase" value={cls.subclass_name} onChange={val => updateClass(i, 'subclass_name', val)}
                      options={subOpts} placeholder={subOpts.length > 0 ? 'Buscar subclase...' : 'Selecciona una clase primero'} />
                  )}
                </div>
              )
            })}

            <button onClick={addClassEntry} style={{
              padding: '0.6rem', border: '1px dashed var(--cs-gold-dk)',
              color: 'var(--cs-text-muted)', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.82rem', letterSpacing: '0.05em',
            }}>+ Agregar multiclase</button>
          </div>
        )}

        {/* ── PASO 3: STATS ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.1rem', margin: 0 }}>
                Estadísticas
              </h2>
              <button onClick={rollAllAbilities} className="btn-dice">
                Lanzar todos (4d6)
              </button>
            </div>

            {/* Ability Scores Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {AB_KEYS.map(abKey => {
                const base = baseAbilities[abKey]
                const racialB = rb[abKey] ?? 0
                const asiB = ab[abKey] ?? 0
                const final = abilities[abKey]
                const roll = diceRolls[abKey]
                const hasBonus = racialB > 0 || asiB > 0

                return (
                  <div key={abKey} style={{ border: '1px solid var(--cs-gold-dk)', padding: '0.6rem', textAlign: 'center', background: 'rgba(201,173,106,0.08)' }}>
                    <div style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.75rem', color: 'var(--cs-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.1em' }}>
                      {abKey.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                      <input type="number" value={base} min={1} max={30}
                        onChange={e => setBaseAbilities(prev => ({ ...prev, [abKey]: parseInt(e.target.value) || 10 }))}
                        style={{ ...darkInput, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700, padding: '0.25rem', width: '3.5rem' }} />
                      <button onClick={() => rollOneAbility(abKey)} className="btn-dice" title="4d6 drop lowest">
                        🎲
                      </button>
                    </div>
                    {roll && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', marginTop: '0.2rem' }}>
                        {roll.dice.map((d, i) => (
                          <span key={i} style={{ textDecoration: d === roll.dropped && roll.dice.indexOf(d) === roll.dice.findIndex(x => x === roll.dropped) ? 'line-through' : 'none', opacity: d === roll.dropped ? 0.5 : 1, marginRight: '0.2rem' }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {hasBonus && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--cs-gold)', marginTop: '0.15rem' }}>
                        {base}{racialB > 0 && <span> +{racialB}r</span>}{asiB > 0 && <span> +{asiB}a</span>} = {final}
                      </div>
                    )}
                    <div style={{ color: 'var(--cs-gold)', fontWeight: 700, marginTop: '0.2rem', fontSize: '0.9rem' }}>
                      {modStr(final)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Racial Bonuses */}
            {race && (
              <div style={sectionBox}>
                <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
                  Bonuses raciales ({race})
                </div>
                {currentRacialAbility && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--cs-gold)' }}>
                    {Object.entries(currentRacialAbility.fixed).map(([k, v]) => (
                      <span key={k} style={{ marginRight: '0.75rem' }}>{k.toUpperCase()} +{v}</span>
                    ))}
                    {!hasRacialChoice && Object.keys(currentRacialAbility.fixed).length === 0 && (
                      <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.85rem' }}>Sin bonuses fijos</span>
                    )}
                  </div>
                )}
                {hasRacialChoice && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--cs-text-muted)', marginBottom: '0.3rem' }}>
                      Elige {currentRacialAbility!.choose!.count} stat(s) para +1:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {currentRacialAbility!.choose!.from.map(stat => (
                        <label key={stat} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--cs-text)', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={racialChoices.includes(stat as AbKey)}
                            onChange={e => {
                              if (e.target.checked) {
                                if (racialChoices.length < currentRacialAbility!.choose!.count) {
                                  setRacialChoices(prev => [...prev, stat as AbKey])
                                }
                              } else {
                                setRacialChoices(prev => prev.filter(s => s !== stat))
                              }
                            }}
                            style={{ accentColor: 'var(--cs-gold)' }}
                          />
                          {stat.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {hasNoRacialData && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--cs-text-muted)', marginBottom: '0.3rem' }}>
                      Esta raza no tiene bonuses fijos. Elige Custom Origin:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {AB_KEYS.map(stat => (
                        <label key={stat} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--cs-text)', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={racialChoices.includes(stat)}
                            onChange={e => {
                              if (e.target.checked) {
                                if (racialChoices.length < 2) setRacialChoices(prev => [...prev, stat])
                              } else {
                                setRacialChoices(prev => prev.filter(s => s !== stat))
                              }
                            }}
                            style={{ accentColor: 'var(--cs-gold)' }}
                          />
                          {stat.toUpperCase()}
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', marginTop: '0.2rem' }}>
                      +2 al primero, +1 al segundo (o +1/+1 si solo eliges 2)
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ASI / Feat Cards */}
            {totalASIs > 0 && (
              <div>
                <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-text-muted)', marginBottom: '0.5rem' }}>
                  Mejoras de puntuación de característica ({totalASIs})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {asiChoices.map((asi, idx) => (
                    <div key={idx} style={{ ...sectionBox, padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-cinzel, serif)' }}>
                          ASI #{idx + 1}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cs-text)' }}>
                          <input type="radio" name={`asi-${idx}`} checked={asi.type === 'asi'} onChange={() => updateASI(idx, { type: 'asi', asi_mode: '2to1', feat_name: undefined })} style={{ accentColor: 'var(--cs-gold)' }} />
                          Aumento de stats
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cs-text)' }}>
                          <input type="radio" name={`asi-${idx}`} checked={asi.type === 'feat'} onChange={() => openFeatModal(idx)} style={{ accentColor: 'var(--cs-gold)' }} />
                          Feat
                        </label>
                      </div>

                      {asi.type === 'asi' && (
                        <div>
                          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: 'var(--cs-text)', cursor: 'pointer' }}>
                              <input type="radio" checked={asi.asi_mode === '2to1'} onChange={() => updateASI(idx, { asi_mode: '2to1', asi_stat2: undefined })} style={{ accentColor: 'var(--cs-gold)' }} />
                              +2 a uno
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: 'var(--cs-text)', cursor: 'pointer' }}>
                              <input type="radio" checked={asi.asi_mode === '1to2'} onChange={() => updateASI(idx, { asi_mode: '1to2' })} style={{ accentColor: 'var(--cs-gold)' }} />
                              +1 a dos
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <select value={asi.asi_stat1 ?? ''} onChange={e => updateASI(idx, { asi_stat1: e.target.value as AbKey })} style={{ ...darkSelect, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}>
                              <option value="">— Stat —</option>
                              {AB_KEYS.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
                            </select>
                            {asi.asi_mode === '1to2' && (
                              <select value={asi.asi_stat2 ?? ''} onChange={e => updateASI(idx, { asi_stat2: e.target.value as AbKey })} style={{ ...darkSelect, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}>
                                <option value="">— Stat 2 —</option>
                                {AB_KEYS.filter(k => k !== asi.asi_stat1).map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      )}

                      {asi.type === 'feat' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: asi.feat_name ? 'var(--cs-gold)' : 'var(--cs-text-muted)' }}>
                              {asi.feat_name ?? 'Ningún feat seleccionado'}
                            </span>
                            <button onClick={() => openFeatModal(idx)} className="btn-dice" style={{ fontSize: '0.75rem' }}>
                              {asi.feat_name ? 'Cambiar' : 'Elegir'}
                            </button>
                          </div>
                          {/* Show feat ability bonuses */}
                          {asi.feat_ability && asi.feat_ability.length > 0 && (() => {
                            const directBonuses: string[] = []
                            let chooseFrom: string[] = []
                            let chooseAmount = 1
                            for (const ab of asi.feat_ability) {
                              for (const [k, v] of Object.entries(ab)) {
                                if (k === 'choose') {
                                  const c = v as { from?: string[], amount?: number }
                                  chooseFrom = (c.from ?? []).filter(s => AB_KEYS.includes(s as AbKey))
                                  chooseAmount = c.amount ?? 1
                                } else if (AB_KEYS.includes(k as AbKey) && typeof v === 'number') {
                                  directBonuses.push(`${k.toUpperCase()} +${v}`)
                                }
                              }
                            }
                            return (
                              <div style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>
                                {directBonuses.length > 0 && (
                                  <span style={{ color: 'var(--cs-gold)', marginRight: '0.75rem' }}>
                                    {directBonuses.join(', ')}
                                  </span>
                                )}
                                {chooseFrom.length > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--cs-text-muted)' }}>
                                    +{chooseAmount} a:
                                    <select
                                      value={asi.feat_ability_choice ?? ''}
                                      onChange={e => updateASI(idx, { feat_ability_choice: e.target.value as AbKey })}
                                      style={{ ...darkSelect, width: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}>
                                      <option value="">— Elegir stat —</option>
                                      {chooseFrom.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HP Section */}
            <div style={sectionBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-text-muted)' }}>
                  Puntos de vida (HP)
                </div>
                {totalLevel > 1 && (
                  <button onClick={rollAllHP} className="btn-dice" style={{ fontSize: '0.72rem' }}>
                    Lanzar dados de vida
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--cs-text)', marginBottom: '0.4rem' }}>
                Nivel 1: {primaryHitDie} (d{primaryHitDie} max) + {conMod >= 0 ? `+${conMod}` : conMod} CON = <strong style={{ color: 'var(--cs-gold)' }}>{hpLevel1}</strong>
              </div>

              {totalLevel > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  {Array.from({ length: totalLevel - 1 }, (_, i) => {
                    const rolled = hpRolls[i]
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.82rem', color: 'var(--cs-text)' }}>
                        <span>Nv{i + 2}:</span>
                        {rolled != null ? (
                          <span style={{ color: 'var(--cs-gold)' }}>{rolled}+{conMod}={rolled + conMod}</span>
                        ) : (
                          <button onClick={() => rollHPForLevel(i)} className="btn-dice" style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}>
                            🎲 d{primaryHitDie}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--cs-text-muted)' }}>HP Total:</span>
                <input type="number" value={hpMax} min={1}
                  onChange={e => setHpManualOverride(parseInt(e.target.value) || 1)}
                  style={{ ...darkInput, width: '5rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }} />
                {hpManualOverride !== null && (
                  <button onClick={() => setHpManualOverride(null)} className="btn-dice" style={{ fontSize: '0.72rem' }}>
                    Auto
                  </button>
                )}
              </div>
            </div>

            {/* AC Section */}
            <div style={sectionBox}>
              <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
                Clase de Armadura (CA)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="number" value={ac} min={1}
                  onChange={e => setAcManual(parseInt(e.target.value) || 10)}
                  style={{ ...darkInput, width: '5rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--cs-text-muted)' }}>
                  10 + {modStr(abilities.dex)} DEX = {autoAC}
                </span>
                {acManual !== null && (
                  <button onClick={() => setAcManual(null)} className="btn-dice" style={{ fontSize: '0.72rem' }}>
                    Auto
                  </button>
                )}
              </div>
            </div>

            {/* Prof Bonus */}
            <div style={{ ...sectionBox, fontSize: '0.9rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-cinzel, serif)' }}>
              Bonus de proficiencia: <span style={{ color: 'var(--cs-gold)', fontWeight: 700 }}>+{profBonus}</span>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>(auto-calculado por nivel)</span>
            </div>
          </div>
        )}

        {/* ── PASO 4: PERSONALIDAD ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.1rem' }}>
              Personalidad
            </h2>
            {[
              { label: 'Rasgos de personalidad', val: personality, set: setPersonality, ph: '¿Cómo se comporta tu personaje?' },
              { label: 'Ideales', val: ideals, set: setIdeals, ph: '¿Qué cree o valora?' },
              { label: 'Vínculos', val: bonds, set: setBonds, ph: '¿Con qué o quién está conectado?' },
              { label: 'Defectos', val: flaws, set: setFlaws, ph: '¿Cuáles son sus debilidades?' },
            ].map(({ label, val, set, ph }) => (
              <Field key={label} label={label}>
                <textarea value={val} onChange={e => set(e.target.value)} rows={3} placeholder={ph}
                  style={{ ...darkInput, resize: 'none' }} />
              </Field>
            ))}
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="btn-parchment" style={{ opacity: step === 1 ? 0.3 : 1 }}>
            Anterior
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => Math.min(4, s + 1))} className="btn-crimson">Siguiente →</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-crimson" style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Creando...' : 'Crear Personaje →'}
            </button>
          )}
        </div>
      </div>

      {/* Feat Modal */}
      <FeatModal open={featModalOpen} onClose={() => setFeatModalOpen(false)} onSelect={selectFeat} feats={feats} characterLevel={totalLevel} />
    </div>
  )
}

// ── Spell Slots ──

function getSpellSlots(className: string, level: number): Record<number, number> {
  const fullCaster: Record<number, number[]> = {
    1: [2,0,0,0,0,0,0,0,0], 2: [3,0,0,0,0,0,0,0,0],
    3: [4,2,0,0,0,0,0,0,0], 4: [4,3,0,0,0,0,0,0,0],
    5: [4,3,2,0,0,0,0,0,0], 6: [4,3,3,0,0,0,0,0,0],
    7: [4,3,3,1,0,0,0,0,0], 8: [4,3,3,2,0,0,0,0,0],
    9: [4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0],
    11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0],
    15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0],
    17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1],
  }
  const fullCasters = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard']
  if (!fullCasters.includes(className)) return {}
  const slots = fullCaster[Math.min(20, Math.max(1, level))] ?? []
  const result: Record<number, number> = {}
  slots.forEach((count, i) => { result[i + 1] = count })
  return result
}
