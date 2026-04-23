'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { updateSlotUsed } from '@/app/characters/[id]/actions'
import { broadcastRoll, getActiveCampaignId } from '@/lib/campaign/broadcast'
import { createClient } from '@/lib/supabase/client'

interface SpellSlot {
  classId: string
  spell_level: number
  slots_total: number
  slots_used: number
}

interface Spell {
  id: string
  spell_level: number
  name: string
  damage: string | null
  custom_notes: string | null
  is_prepared: boolean
}

interface ClassData {
  id: string
  class_name: string
  level: number
  spell_save_dc: number | null
  spell_attack_mod: number | null
  spellcasting_ability: string | null
  spellcastingAbilityScore?: number | null
}

interface Props {
  characterId: string
  classes: ClassData[]
  slots: SpellSlot[]
  spells: Spell[]
  characterName?: string
}

type BuffTarget = 'attack' | 'damage' | 'both' | 'advantage'

interface TempBuff {
  id: string
  name: string
  count: number     // dice count or flat value
  dieType: string   // 'd4' | 'd6' | ... | 'flat'
  dmgType: string   // 'fire' | 'cold' | ... | ''
  target: BuffTarget
}

const DIE_TYPES = ['d4','d6','d8','d10','d12','d20','flat']
const DMG_TYPES = ['','fire','cold','lightning','thunder','necrotic','radiant','poison','acid','psychic','force','piercing','slashing','bludgeoning','healing']
const BUFF_TARGETS: { value: BuffTarget; label: string }[] = [
  { value: 'attack', label: 'Tirada de ataque' },
  { value: 'damage', label: 'Daño' },
  { value: 'both',   label: 'Ataque + Daño' },
  { value: 'advantage', label: 'Ventaja (ataque)' },
]

const LEVEL_LABELS = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/* ── Dice rolling ── */
function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1 }

function rollFormula(formula: string): { total: number; detail: string } {
  const clean = formula.toLowerCase().trim().replace(/\s+/g, '')
  const parts = clean.match(/[+-]?[^+-]+/g) ?? [clean]
  let total = 0
  const details: string[] = []
  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1
    const p = part.replace(/^[+-]/, '')
    const m = p.match(/^(\d*)d(\d+)$/)
    if (m) {
      const count = parseInt(m[1] || '1')
      const sides = parseInt(m[2])
      const rolls = Array.from({ length: count }, () => rollDie(sides))
      total += rolls.reduce((a, b) => a + b, 0) * sign
      details.push(`[${rolls.join('+')}]`)
    } else {
      const n = parseInt(p) * sign
      if (!isNaN(n) && n !== 0) { total += n; details.push(n > 0 ? `+${n}` : `${n}`) }
    }
  }
  return { total, detail: details.join('') }
}

/** Build dice formula string from buff fields */
function buffFormula(b: TempBuff): string {
  return b.dieType === 'flat' ? String(b.count) : `${b.count}${b.dieType}`
}

function signStr(n: number) { return n >= 0 ? `+${n}` : `${n}` }

// Spells known (fixed table) for classes that don't prepare
const SPELLS_KNOWN: Record<string, number[]> = {
  Bard:     [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  Ranger:   [0, 0, 2, 3, 3, 4, 4,  5,  5,  6,  6,  7,  7,  8,  8,  9,  9, 10, 10, 11, 11],
  Sorcerer: [0, 2, 3, 4, 5, 6, 7,  8,  9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  Warlock:  [0, 2, 3, 4, 5, 6, 7,  8,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
}

function getSpellLimit(cls: ClassData): { label: string; count: number } | null {
  const level = cls.level
  const abilMod = cls.spellcastingAbilityScore != null ? Math.floor((cls.spellcastingAbilityScore - 10) / 2) : 0
  const name = cls.class_name

  // Spells Known classes
  if (SPELLS_KNOWN[name]) {
    const count = SPELLS_KNOWN[name][Math.min(level, 20)]
    return count > 0 ? { label: 'Hechizos conocidos', count } : null
  }

  // Cleric, Druid: ability_mod + level
  if (name === 'Cleric' || name === 'Druid') {
    const count = Math.max(1, abilMod + level)
    return { label: 'Hechizos preparados', count }
  }

  // Wizard: int_mod + level
  if (name === 'Wizard') {
    const count = Math.max(1, abilMod + level)
    return { label: 'Hechizos preparados', count }
  }

  // Paladin / Artificer: ability_mod + half level (rounded down)
  if (name === 'Paladin' || name === 'Artificer') {
    const count = Math.max(1, abilMod + Math.floor(level / 2))
    return { label: 'Hechizos preparados', count }
  }

  return null
}

/** Extract damage formula from spell.damage field or custom_notes fallback */
function parseDamageFormula(spell: Spell): { formula: string; type: string } | null {
  if (spell.damage?.trim()) {
    const clean = spell.damage.trim()
    const m = clean.match(/^(\d*d\d+(?:[+-]\d+)?)\s*(.*)$/i)
    if (m) return { formula: m[1], type: m[2].split(/[,;]/)[0].trim() }
    return { formula: clean, type: '' }
  }
  if (!spell.custom_notes) return null
  const clean = spell.custom_notes.replace(/^(dmg|damage|daño)\s*:\s*/i, '').trim()
  const m = clean.match(/^(\d*d\d+(?:[+-]\d+)?)\s*(.*)$/i)
  if (m) return { formula: m[1], type: m[2].split(/[,;]/)[0].trim() }
  return null
}

interface SpellRollResult {
  spellName: string
  type: 'attack' | 'damage'
  d20?: number
  total: number
  detail: string
  isCrit?: boolean
  isMiss?: boolean
}

/* ── Spell info popover ── */
interface SpellInfo {
  name: string; level: number; school: string
  time?: string; range?: string; components?: string; duration?: string
  description?: string | null
}

function SpellPopover({ spellName, onClose }: { spellName: string; onClose: () => void }) {
  const [info, setInfo] = useState<SpellInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/spell-info?name=${encodeURIComponent(spellName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setInfo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [spellName])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  async function translate() {
    if (!info?.description) return
    setTranslating(true)
    try {
      const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: info.description }) })
      const d = await r.json()
      if (d.translated) setTranslated(d.translated)
    } finally { setTranslating(false) }
  }

  const SCHOOL_COLORS: Record<string, string> = {
    Abjuration: '#2563eb', Conjuration: '#7c3aed', Divination: '#0891b2',
    Enchantment: '#db2777', Evocation: '#dc2626', Illusion: '#8b5cf6',
    Necromancy: '#4b5563', Transmutation: '#d97706',
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 50, left: 0, top: '100%', marginTop: 4,
      width: 340, background: 'var(--parchment, #f5f0e0)',
      border: '1px solid var(--cs-gold)', borderRadius: 8,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)', padding: '1rem',
    }}>
      {loading && <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.8rem', margin: 0 }}>Cargando...</p>}
      {!loading && !info && <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.8rem', margin: 0 }}>Sin descripción disponible.</p>}
      {info && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--cs-accent)' }}>{info.name}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: SCHOOL_COLORS[info.school] ?? 'var(--cs-text-muted)' }}>{info.school}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem', fontSize: '0.68rem', color: 'var(--cs-text-muted)', marginBottom: '0.6rem', fontFamily: 'var(--font-montaga)' }}>
          {info.time && <span>⏱ {info.time}</span>}
          {info.range && <span>📏 {info.range}</span>}
          {info.components && <span>✋ {info.components}</span>}
          {info.duration && <span>🕐 {info.duration}</span>}
        </div>
        {info.description ? (<>
          <p style={{ fontSize: '0.78rem', color: '#3a2e1e', lineHeight: 1.5, margin: 0, fontFamily: 'var(--font-montaga)' }}>
            {translated ?? info.description}
          </p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!translated && (
              <button onClick={translate} disabled={translating}
                style={{ fontSize: '0.65rem', padding: '2px 9px', borderRadius: 10, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer' }}>
                {translating ? 'Traduciendo...' : '🌐 Traducir al español'}
              </button>
            )}
            {translated && (
              <button onClick={() => setTranslated(null)}
                style={{ fontSize: '0.65rem', padding: '2px 9px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.2)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
                EN
              </button>
            )}
          </div>
        </>) : (
          <p style={{ fontSize: '0.75rem', color: 'var(--cs-text-muted)', fontStyle: 'italic', margin: 0 }}>Sin descripción disponible.</p>
        )}
      </>)}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '3px 7px', fontFamily: 'var(--font-montaga, serif)', fontSize: '0.78rem',
  background: 'var(--cs-card)', border: '1px solid rgba(201,173,106,0.5)',
  color: 'var(--cs-text)', borderRadius: 4, outline: 'none',
}

export default function SpellsTab({ characterId, classes, slots: initialSlots, spells, characterName }: Props) {
  const [slots, setSlots] = useState<SpellSlot[]>(initialSlots)
  const [, startTransition] = useTransition()
  const [lastRoll, setLastRoll] = useState<SpellRollResult | null>(null)
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null)
  const supabase = createClient()

  /* ── Structured multi-buff system ── */
  const [tempBuffs, setTempBuffs] = useState<TempBuff[]>([])
  const [showBuffForm, setShowBuffForm] = useState(false)
  const [newBuff, setNewBuff] = useState<Omit<TempBuff, 'id'>>({ name: '', count: 1, dieType: 'd6', dmgType: '', target: 'attack' })

  const slotsByLevel: Record<number, SpellSlot> = {}
  for (const s of slots) slotsByLevel[s.spell_level] = s

  const mainClass = classes.find(c => c.spell_save_dc || c.spell_attack_mod) ?? classes[0]
  const atkMod = mainClass?.spell_attack_mod ?? 0

  function addBuff() {
    setTempBuffs(prev => [...prev, { ...newBuff, id: Math.random().toString(36).slice(2) }])
    setNewBuff(p => ({ name: '', count: 1, dieType: 'd6', dmgType: '', target: p.target }))
    setShowBuffForm(false)
  }

  function removeBuff(id: string) { setTempBuffs(prev => prev.filter(b => b.id !== id)) }

  function rollBuffsFor(forTarget: 'attack' | 'damage'): { total: number; parts: string[] } {
    const applicable = tempBuffs.filter(b =>
      b.target === forTarget || b.target === 'both'
      // 'advantage' buffs don't add dice, handled separately
    )
    let total = 0
    const parts: string[] = []
    for (const b of applicable) {
      const formula = buffFormula(b)
      const r = rollFormula(formula)
      total += r.total
      const label = [b.name, formula, b.dmgType].filter(Boolean).join(' ')
      parts.push(`${label}→${r.total}(${r.detail})`)
    }
    return { total, parts }
  }

  const hasAdvantage = tempBuffs.some(b => b.target === 'advantage')

  function handleDotClick(slot: SpellSlot, dotIndex: number) {
    const newUsed = dotIndex < slot.slots_used ? dotIndex : dotIndex + 1
    const clamped = Math.max(0, Math.min(slot.slots_total, newUsed))
    setSlots(prev => prev.map(s =>
      s.classId === slot.classId && s.spell_level === slot.spell_level ? { ...s, slots_used: clamped } : s
    ))
    startTransition(() => { updateSlotUsed(characterId, slot.classId, slot.spell_level, clamped) })
  }

  function rollAttack(spell: Spell) {
    let d20: number
    let advantageNote = ''
    if (hasAdvantage) {
      const r1 = rollDie(20), r2 = rollDie(20)
      d20 = Math.max(r1, r2)
      advantageNote = ` ventaja(${r1},${r2})`
    } else {
      d20 = rollDie(20)
    }
    let total = d20 + atkMod
    const parts = [`d20(${d20})${advantageNote}`, `${signStr(atkMod)} atk`]
    const b = rollBuffsFor('attack')
    if (b.total !== 0) {
      total += b.total
      parts.push(...b.parts.map(p => `+${p}`))
    }
    const result: SpellRollResult = { spellName: spell.name, type: 'attack', d20, total, detail: parts.join(' '), isCrit: d20 === 20, isMiss: d20 === 1 }
    setLastRoll(result)
    const campaignId = getActiveCampaignId()
    if (campaignId) {
      broadcastRoll(supabase, campaignId, {
        type: 'spell', label: spell.name, total, d20,
        detail: `atk · ${result.detail}`,
        isCrit: result.isCrit, isMiss: result.isMiss,
      }, characterName)
    }
  }

  function rollDamage(spell: Spell) {
    const dmg = parseDamageFormula(spell)
    if (!dmg) return
    const base = rollFormula(dmg.formula)
    let total = base.total
    const parts = [`${dmg.formula}→${base.total}(${base.detail})${dmg.type ? ` ${dmg.type}` : ''}`]
    const b = rollBuffsFor('damage')
    if (b.total !== 0) {
      total += b.total
      parts.push(...b.parts.map(p => `+${p}`))
    }
    const result: SpellRollResult = { spellName: spell.name, type: 'damage', total, detail: parts.join(' ') }
    setLastRoll(result)
    const campaignId = getActiveCampaignId()
    if (campaignId) {
      broadcastRoll(supabase, campaignId, {
        type: 'damage', label: spell.name, total,
        detail: `dmg · ${result.detail}`,
      }, characterName)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, transform: 'scaleX(-1)', opacity: 0.95 }} />
        <h2 style={{ fontFamily: 'var(--font-new-rocker, Cinzel, serif)', fontSize: '3rem', color: 'var(--cs-accent)', lineHeight: 1, margin: 0 }}>
          Magic Spells
        </h2>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, opacity: 0.95 }} />
      </div>

      {/* Spell stats row */}
      {mainClass && (mainClass.spell_save_dc || mainClass.spell_attack_mod) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginBottom: '1.5rem' }}>
          {([
            { label: 'Spell Save DC', value: String(mainClass.spell_save_dc ?? '') },
            { label: 'Spellcasting Ability', value: mainClass.spellcasting_ability?.toUpperCase() ?? '' },
            { label: 'Spell Attack Bonus', value: mainClass.spell_attack_mod != null ? signStr(mainClass.spell_attack_mod) : '' },
          ] as { label: string; value: string }[]).filter(x => x.value).map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--cs-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
                {label}
              </div>
              <div className="cs-num" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Buffs temporales ── */}
      <div style={{ marginBottom: '1rem' }}>
        {/* Active buff chips */}
        {tempBuffs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem', justifyContent: 'flex-end' }}>
            {tempBuffs.map(b => {
              const targetLabel = BUFF_TARGETS.find(t => t.value === b.target)?.label ?? ''
              const chipColor = b.target === 'advantage' ? 'rgba(45,106,45,0.25)' : 'rgba(201,173,106,0.15)'
              return (
                <span key={b.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: chipColor, border: `1px solid ${b.target === 'advantage' ? '#4a8a4a' : 'var(--cs-gold)'}`,
                  borderRadius: 12, padding: '0.18rem 0.6rem 0.18rem 0.7rem', fontSize: '0.73rem',
                }}>
                  {b.name && <span style={{ color: 'var(--cs-text-muted)', marginRight: 2 }}>{b.name}:</span>}
                  {b.target !== 'advantage' && (
                    <span style={{ fontFamily: 'monospace', color: 'var(--cs-gold)', fontWeight: 700 }}>{buffFormula(b)}</span>
                  )}
                  {b.dmgType && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.68rem' }}>{b.dmgType}</span>}
                  <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.62rem', fontStyle: 'italic' }}>({targetLabel})</span>
                  <button onClick={() => removeBuff(b.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-text-muted)', fontSize: '0.85rem', padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
                </span>
              )
            })}
          </div>
        )}

        {/* Add buff form */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {showBuffForm ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              {/* Target type first */}
              <select value={newBuff.target} onChange={e => setNewBuff(p => ({ ...p, target: e.target.value as BuffTarget }))} style={inputStyle}>
                {BUFF_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input value={newBuff.name} onChange={e => setNewBuff(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre (ej: Inspiración)" style={{ ...inputStyle, width: 130 }} />
              {/* Dice fields only when not advantage */}
              {newBuff.target !== 'advantage' && (<>
                <input type="number" value={newBuff.count} onChange={e => setNewBuff(p => ({ ...p, count: Math.max(1, +e.target.value) }))}
                  min={1} style={{ ...inputStyle, width: 46 }} />
                <select value={newBuff.dieType} onChange={e => setNewBuff(p => ({ ...p, dieType: e.target.value }))} style={inputStyle}>
                  {DIE_TYPES.map(d => <option key={d} value={d}>{d === 'flat' ? 'fijo' : d}</option>)}
                </select>
                {newBuff.target === 'damage' || newBuff.target === 'both' ? (
                  <select value={newBuff.dmgType} onChange={e => setNewBuff(p => ({ ...p, dmgType: e.target.value }))} style={inputStyle}>
                    {DMG_TYPES.map(t => <option key={t} value={t}>{t || '— tipo —'}</option>)}
                  </select>
                ) : null}
              </>)}
              <button onClick={addBuff}
                style={{ background: 'var(--cs-accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                + Agregar
              </button>
              <button onClick={() => setShowBuffForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-text-muted)', fontSize: '0.78rem' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setShowBuffForm(true)}
              style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', padding: '3px 12px', borderRadius: 12, border: '1px solid rgba(201,173,106,0.5)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {tempBuffs.length > 0 ? '+ Buff' : '+ Buff temporal'}
            </button>
          )}
        </div>
      </div>

      {/* Last roll result */}
      {lastRoll && (
        <div style={{
          marginBottom: '1.5rem', padding: '1rem 1.5rem',
          border: `2px solid ${lastRoll.isCrit ? 'var(--cs-gold)' : lastRoll.isMiss ? 'var(--danger)' : 'rgba(201,173,106,0.4)'}`,
          borderRadius: 12, background: 'var(--cs-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase' }}>
              {lastRoll.spellName} · {lastRoll.type === 'attack' ? 'Ataque' : 'Daño'}
            </span>
            {lastRoll.isCrit && <span style={{ fontSize: '0.7rem', color: 'var(--cs-gold)', fontWeight: 700 }}>¡CRÍTICO!</span>}
            {lastRoll.isMiss && <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}>PIFIA</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: lastRoll.isCrit ? 'var(--cs-gold)' : lastRoll.isMiss ? 'var(--danger)' : 'var(--cs-text)' }}>
              {lastRoll.total}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', lineHeight: 1.4 }}>
              {lastRoll.detail}
            </span>
          </div>
          <button onClick={() => setLastRoll(null)}
            style={{ display: 'block', marginTop: 6, fontSize: '0.65rem', color: 'var(--cs-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            cerrar ✕
          </button>
        </div>
      )}

      {/* Spell slots */}
      {slots.some(s => s.slots_total > 0) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 2rem' }}>
            {[1,2,3,4,5,6,7,8,9].map(lvl => {
              const slot = slotsByLevel[lvl]
              if (!slot || slot.slots_total === 0) return null
              const remaining = slot.slots_total - slot.slots_used
              return (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right', minWidth: 72 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase' }}>{LEVEL_LABELS[lvl]} Level</div>
                    <div className="cs-num" style={{ fontSize: '1.4rem', lineHeight: 1 }}>{String(remaining).padStart(2, '0')}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>Remaining</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 100 }}>
                    {Array.from({ length: slot.slots_total }).map((_, i) => {
                      const used = i < slot.slots_used
                      return (
                        <button key={i} onClick={() => handleDotClick(slot, i)}
                          style={{ width: 14, height: 14, borderRadius: '50%', background: used ? 'var(--cs-accent)' : 'transparent', border: `2px solid ${used ? 'var(--cs-accent)' : 'var(--cs-text-muted)'}`, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                      )
                    })}
                  </div>
                </div>
              )
            }).filter(Boolean)}
          </div>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginTop: '1rem' }} />
        </div>
      )}

      {/* Spell limits per class */}
      {classes.some(c => getSpellLimit(c) !== null) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', justifyContent: 'center' }}>
          {classes.map(c => {
            const limit = getSpellLimit(c)
            if (!limit) return null
            const knownCount = spells.filter(s => s.spell_level > 0).length
            const overLimit = knownCount > limit.count
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: 'var(--cs-card)', border: `1px solid ${overLimit ? 'var(--cs-accent)' : 'var(--cs-gold)'}`,
                borderRadius: 8, padding: '0.4rem 0.85rem', fontSize: '0.78rem',
              }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {c.class_name} · {limit.label}
                </span>
                <span style={{
                  fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem',
                  color: overLimit ? 'var(--cs-accent)' : 'var(--cs-gold)',
                }}>
                  {knownCount} / {limit.count}
                </span>
                {overLimit && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--cs-accent)', fontStyle: 'italic' }}>¡excedido!</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Spell list */}
      <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '1.5rem 2rem' }}>
        {spells.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.9rem', padding: '2rem 0' }}>
            No spells added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cs-gold)' }}>
                {['Hechizo', 'Ataque / DC', 'Daño', 'Notas'].map(h => (
                  <th key={h} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cs-text-muted)', padding: '0 0 0.6rem', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spells.map((s, i) => {
                const dmg = parseDamageFormula(s)
                return (
                  <tr key={s.id} style={{ borderBottom: i < spells.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>
                    {/* Name */}
                    <td style={{ padding: '0.6rem 0.5rem 0.6rem 0', verticalAlign: 'middle', position: 'relative' }}>
                      <button
                        onClick={() => setSelectedSpell(prev => prev === s.name ? null : s.name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--cs-accent)', fontWeight: 600, textDecoration: 'underline dotted', textDecorationColor: 'rgba(201,173,106,0.5)', textUnderlineOffset: 3 }}>
                          {s.name}
                        </span>
                      </button>
                      <div style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', marginTop: 2, fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>
                        {s.spell_level === 0 ? 'Cantrip' : `Nivel ${s.spell_level}`}
                      </div>
                      {selectedSpell === s.name && (
                        <SpellPopover spellName={s.name} onClose={() => setSelectedSpell(null)} />
                      )}
                    </td>

                    {/* Attack */}
                    <td style={{ padding: '0.6rem 1rem 0.6rem 0.5rem', verticalAlign: 'middle' }}>
                      {atkMod !== 0 && (
                        <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)', marginBottom: '0.25rem' }}>
                          {signStr(atkMod)} atk{mainClass?.spell_save_dc ? ` · DC ${mainClass.spell_save_dc}` : ''}
                        </div>
                      )}
                      <button onClick={() => rollAttack(s)}
                        style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                        🎲 Tirar
                      </button>
                    </td>

                    {/* Damage */}
                    <td style={{ padding: '0.6rem 1rem 0.6rem 0.5rem', verticalAlign: 'middle' }}>
                      {dmg ? (
                        <div>
                          <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.82rem', color: 'var(--cs-text)', marginBottom: '0.25rem' }}>
                            {dmg.formula}
                            {dmg.type && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.72rem', marginLeft: 4 }}>{dmg.type}</span>}
                          </div>
                          <button onClick={() => rollDamage(s)}
                            style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-accent)', background: 'transparent', color: 'var(--cs-accent)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                            🎲 Daño
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.72rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga)' }} title="Edita el hechizo → campo Daño">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '0.6rem 0 0.6rem 0.5rem', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)' }}>
                        {s.custom_notes ?? ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: '0.75rem', fontStyle: 'italic' }}>
        Para añadir daño: edita el hechizo → campo <strong>Daño</strong>, ej: <strong>1d10 fuego</strong>
      </p>
    </div>
  )
}
