'use client'

import { useState, useTransition } from 'react'
import { updateSlotUsed } from '@/app/characters/[id]/actions'

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
  custom_notes: string | null
  is_prepared: boolean
}

interface ClassData {
  id: string
  class_name: string
  spell_save_dc: number | null
  spell_attack_mod: number | null
  spellcasting_ability: string | null
}

interface Props {
  characterId: string
  classes: ClassData[]
  slots: SpellSlot[]
  spells: Spell[]
}

interface TempBuff {
  id: string
  name: string
  value: string   // e.g. "1d6"
}

const LEVEL_LABELS = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/* ── Dice rolling ── */
function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1 }

function rollFormula(formula: string): { total: number; detail: string } {
  const clean = formula.toLowerCase().replace(/\s/g, '')
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

function signStr(n: number) { return n >= 0 ? `+${n}` : `${n}` }

/** Parse "2d6 fire, 1d4 cold" from custom_notes if present */
function parseDamageFromNotes(notes: string | null): { formula: string; type: string } | null {
  if (!notes) return null
  const clean = notes.replace(/^(dmg|damage|daño)\s*:\s*/i, '').trim()
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

export default function SpellsTab({ characterId, classes, slots: initialSlots, spells }: Props) {
  const [slots, setSlots] = useState<SpellSlot[]>(initialSlots)
  const [, startTransition] = useTransition()
  const [lastRoll, setLastRoll] = useState<SpellRollResult | null>(null)

  /* ── Multi-buff system ── */
  const [tempBuffs, setTempBuffs] = useState<TempBuff[]>([])
  const [newBuffName, setNewBuffName] = useState('')
  const [newBuffValue, setNewBuffValue] = useState('')
  const [showBuffForm, setShowBuffForm] = useState(false)

  const byLevel: Record<number, Spell[]> = {}
  for (const s of spells) {
    if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
    byLevel[s.spell_level].push(s)
  }

  const slotsByLevel: Record<number, SpellSlot> = {}
  for (const s of slots) slotsByLevel[s.spell_level] = s

  const mainClass = classes.find(c => c.spell_save_dc || c.spell_attack_mod) ?? classes[0]
  const atkMod = mainClass?.spell_attack_mod ?? 0

  function addBuff() {
    if (!newBuffValue.trim()) return
    setTempBuffs(prev => [...prev, { id: Math.random().toString(36).slice(2), name: newBuffName.trim(), value: newBuffValue.trim() }])
    setNewBuffName('')
    setNewBuffValue('')
    setShowBuffForm(false)
  }

  function removeBuff(id: string) {
    setTempBuffs(prev => prev.filter(b => b.id !== id))
  }

  /** Roll all active buffs and return total + detail string */
  function rollBuffs(): { total: number; detail: string } {
    let total = 0
    const parts: string[] = []
    for (const b of tempBuffs) {
      const r = rollFormula(b.value)
      total += r.total
      parts.push(`${b.name ? b.name + ':' : ''}${b.value}→${r.total}(${r.detail})`)
    }
    return { total, detail: parts.join(' + ') }
  }

  function handleDotClick(slot: SpellSlot, dotIndex: number) {
    const newUsed = dotIndex < slot.slots_used ? dotIndex : dotIndex + 1
    const clamped = Math.max(0, Math.min(slot.slots_total, newUsed))
    setSlots(prev => prev.map(s =>
      s.classId === slot.classId && s.spell_level === slot.spell_level ? { ...s, slots_used: clamped } : s
    ))
    startTransition(() => { updateSlotUsed(characterId, slot.classId, slot.spell_level, clamped) })
  }

  function rollAttack(spell: Spell) {
    const d20 = rollDie(20)
    let total = d20 + atkMod
    const parts = [`d20(${d20})`, signStr(atkMod) + ' atk']
    if (tempBuffs.length > 0) {
      const b = rollBuffs()
      total += b.total
      parts.push(`buffs:+${b.total}(${b.detail})`)
    }
    setLastRoll({ spellName: spell.name, type: 'attack', d20, total, detail: parts.join(' '), isCrit: d20 === 20, isMiss: d20 === 1 })
  }

  function rollDamage(spell: Spell) {
    const dmg = parseDamageFromNotes(spell.custom_notes)
    if (!dmg) return
    const base = rollFormula(dmg.formula)
    let total = base.total
    const parts = [`${dmg.formula}→${base.total}(${base.detail})${dmg.type ? ` ${dmg.type}` : ''}`]
    if (tempBuffs.length > 0) {
      const b = rollBuffs()
      total += b.total
      parts.push(`buffs:+${b.total}(${b.detail})`)
    }
    setLastRoll({ spellName: spell.name, type: 'damage', total, detail: parts.join(' ') })
  }

  /* ── Styles ── */
  const fieldStyle: React.CSSProperties = {
    padding: '3px 8px', fontFamily: 'monospace', fontSize: '0.78rem',
    background: 'var(--cs-card)', border: '1px solid var(--cs-gold)',
    color: 'var(--cs-text)', borderRadius: 4, outline: 'none',
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

      {/* ── Temp Buffs ── */}
      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
        {/* Active buffs chips */}
        {tempBuffs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
            {tempBuffs.map(b => (
              <span key={b.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(201,173,106,0.15)', border: '1px solid var(--cs-gold)',
                borderRadius: 12, padding: '0.18rem 0.55rem 0.18rem 0.65rem', fontSize: '0.73rem', color: 'var(--cs-text)',
              }}>
                {b.name && <span style={{ color: 'var(--cs-text-muted)' }}>{b.name}:</span>}
                <span style={{ fontFamily: 'monospace', color: 'var(--cs-gold)' }}>{b.value}</span>
                <button onClick={() => removeBuff(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-text-muted)', fontSize: '0.8rem', padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Add buff form (toggles) */}
        {showBuffForm ? (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input value={newBuffName} onChange={e => setNewBuffName(e.target.value)}
              placeholder="Nombre (ej: Inspiración)" style={{ ...fieldStyle, width: 150 }} />
            <input value={newBuffValue} onChange={e => setNewBuffValue(e.target.value)}
              placeholder="Valor (ej: 1d6)" style={{ ...fieldStyle, width: 90 }}
              onKeyDown={e => e.key === 'Enter' && addBuff()} />
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
            + Buff temporal
          </button>
        )}
      </div>

      {/* Last roll result */}
      {lastRoll && (
        <div style={{
          marginBottom: '1.5rem', padding: '1rem 1.5rem',
          border: `2px solid ${lastRoll.isCrit ? 'var(--cs-gold)' : lastRoll.isMiss ? 'var(--danger)' : 'rgba(201,173,106,0.4)'}`,
          borderRadius: 12, background: 'var(--cs-card)',
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase' }}>
              {lastRoll.spellName} · {lastRoll.type === 'attack' ? 'Ataque' : 'Daño'}
            </span>
            {lastRoll.isCrit && <span style={{ fontSize: '0.7rem', color: 'var(--cs-gold)', fontWeight: 700 }}>¡CRÍTICO!</span>}
            {lastRoll.isMiss && <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}>PIFIA</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, color: lastRoll.isCrit ? 'var(--cs-gold)' : lastRoll.isMiss ? 'var(--danger)' : 'var(--cs-text)', lineHeight: 1 }}>
              {lastRoll.total}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>
              {lastRoll.detail}
            </span>
          </div>
          <button onClick={() => setLastRoll(null)}
            style={{ alignSelf: 'flex-end', fontSize: '0.65rem', color: 'var(--cs-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
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
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase' }}>
                      {LEVEL_LABELS[lvl]} Level
                    </div>
                    <div className="cs-num" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                      {String(remaining).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>
                      Remaining
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 100 }}>
                    {Array.from({ length: slot.slots_total }).map((_, i) => {
                      const used = i < slot.slots_used
                      return (
                        <button key={i} onClick={() => handleDotClick(slot, i)}
                          title={used ? 'Click to restore' : 'Click to use'}
                          style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: used ? 'var(--cs-accent)' : 'transparent',
                            border: `2px solid ${used ? 'var(--cs-accent)' : 'var(--cs-text-muted)'}`,
                            cursor: 'pointer', padding: 0, flexShrink: 0,
                          }} />
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
                const dmg = parseDamageFromNotes(s.custom_notes)
                return (
                  <tr key={s.id} style={{ borderBottom: i < spells.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>
                    {/* Name */}
                    <td style={{ padding: '0.6rem 0.5rem 0.6rem 0', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--cs-accent)', fontWeight: 600 }}>
                        {s.name}
                      </span>
                      <div style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', marginTop: 2, fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>
                        {s.spell_level === 0 ? 'Cantrip' : `Nivel ${s.spell_level}`}
                      </div>
                    </td>

                    {/* Attack */}
                    <td style={{ padding: '0.6rem 1rem 0.6rem 0.5rem', verticalAlign: 'middle' }}>
                      <div>
                        {atkMod !== 0 && (
                          <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)', marginBottom: '0.25rem' }}>
                            {signStr(atkMod)} atk{mainClass?.spell_save_dc ? ` · DC ${mainClass.spell_save_dc}` : ''}
                          </div>
                        )}
                        <button onClick={() => rollAttack(s)}
                          style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                          🎲 Tirar
                        </button>
                      </div>
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
                        <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.75rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga)' }}>—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '0.6rem 0 0.6rem 0.5rem', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)' }}>
                        {s.custom_notes && !parseDamageFromNotes(s.custom_notes) ? s.custom_notes : ''}
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
        Para agregar daño a un hechizo, escribe la fórmula en Notas al editarlo, ej: <strong>2d6 fuego</strong>
      </p>
    </div>
  )
}
