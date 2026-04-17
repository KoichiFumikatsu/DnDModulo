'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveCampaignId, broadcastRoll } from '@/lib/campaign/broadcast'

/* ── Types ── */
interface Weapon {
  id: string
  name: string
  atk_bonus: string | null
  damage: string | null
  damage_type: string | null
  range: string | null
  notes: string | null
  ability_mod: string | null
  is_proficient: boolean
  extra_damage: string | null
}

interface CharStats {
  str: number; dex: number; con: number
  int: number; wis: number; cha: number
  proficiency_bonus: number
}

interface Props {
  weapons: Weapon[]
  character?: CharStats
}

/* ── Bonus type ── */
interface Bonus {
  id: string
  label: string
  value: number
  kind: 'mágico' | 'físico'
  applies: 'ataque' | 'daño' | 'ambos'
}

/* ── Dice roller ── */
function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1
}

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
      const sub = rolls.reduce((a, b) => a + b, 0) * sign
      total += sub
      details.push(`[${rolls.join('+')}]`)
    } else {
      const n = parseInt(p) * sign
      if (!isNaN(n) && n !== 0) {
        total += n
        details.push(n > 0 ? `+${n}` : `${n}`)
      }
    }
  }
  return { total, detail: details.join('') }
}

function modNum(score: number) { return Math.floor((score - 10) / 2) }
function signStr(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function parseExtraDamage(raw: string): { formula: string; type: string }[] {
  return raw.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    const formula = parts[0] ?? ''
    const type = parts.slice(1).join(' ')
    return { formula, type }
  }).filter(e => e.formula)
}

interface DmgBreakdown {
  label: string
  value: number
  detail: string
  type?: string
}

interface RollResult {
  type: 'attack' | 'damage'
  weaponName: string
  d20?: number
  total: number
  detail: string
  isCrit?: boolean
  isMiss?: boolean
  extras?: { formula: string; type: string; total: number; detail: string }[]
  breakdown?: DmgBreakdown[]
}

const KIND_COLOR = { mágico: '#3a6fa8', físico: '#8b5e3c' }
const PRESET_LABELS = ['Inspiración', 'Infusión', 'Attunement', 'Bendición', 'Otro']

/* ══════════════════════════════════════════════════════════════ */

export default function WeaponsTab({ weapons, character }: Props) {
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null)

  // bonuses[weaponId] = Bonus[]
  const [bonuses, setBonuses] = useState<Record<string, Bonus[]>>({})
  // which weapon's add-form is open
  const [formOpen, setFormOpen] = useState<string | null>(null)
  // form state
  const [formLabel, setFormLabel] = useState('Inspiración')
  const [formCustomLabel, setFormCustomLabel] = useState('')
  const [formValue, setFormValue] = useState(1)
  const [formKind, setFormKind] = useState<Bonus['kind']>('mágico')
  const [formApplies, setFormApplies] = useState<Bonus['applies']>('ambos')

  function openForm(wid: string) {
    setFormOpen(prev => prev === wid ? null : wid)
    setFormLabel('Inspiración'); setFormCustomLabel('')
    setFormValue(1); setFormKind('mágico'); setFormApplies('ambos')
  }

  function addBonus(wid: string) {
    const label = formLabel === 'Otro' ? (formCustomLabel.trim() || 'Bonus') : formLabel
    const b: Bonus = {
      id: crypto.randomUUID(),
      label, value: formValue, kind: formKind, applies: formApplies,
    }
    setBonuses(prev => ({ ...prev, [wid]: [...(prev[wid] ?? []), b] }))
    setFormOpen(null)
  }

  function removeBonus(wid: string, bid: string) {
    setBonuses(prev => ({ ...prev, [wid]: (prev[wid] ?? []).filter(b => b.id !== bid) }))
  }

  function activeBonusSum(wid: string, forRoll: 'ataque' | 'daño') {
    return (bonuses[wid] ?? [])
      .filter(b => b.applies === forRoll || b.applies === 'ambos')
      .reduce((s, b) => s + b.value, 0)
  }

  function getAbilityMod(ability_mod: string | null): number {
    if (!ability_mod || !character) return 0
    const score = character[ability_mod as keyof CharStats] as number
    return typeof score === 'number' ? modNum(score) : 0
  }

  function rollAttack(w: Weapon) {
    const d20 = rollDie(20)
    const abilityMod = getAbilityMod(w.ability_mod)
    const prof = (w.is_proficient && character) ? character.proficiency_bonus : 0
    const magic = parseInt(w.atk_bonus ?? '0') || 0
    const bonusSum = activeBonusSum(w.id, 'ataque')
    const total = d20 + abilityMod + prof + magic + bonusSum
    const parts = [`d20(${d20})`]
    if (abilityMod !== 0) parts.push(signStr(abilityMod) + ` ${(w.ability_mod ?? '').toUpperCase()}`)
    if (prof !== 0) parts.push(`+${prof} Prof`)
    if (magic !== 0) parts.push(signStr(magic) + ' mágico')
    if (bonusSum !== 0) {
      const wbs = (bonuses[w.id] ?? []).filter(b => b.applies === 'ataque' || b.applies === 'ambos')
      wbs.forEach(b => parts.push(`${signStr(b.value)} ${b.label}`))
    }
    const roll = { type: 'attack' as const, weaponName: w.name, d20, total, detail: parts.join(' '), isCrit: d20 === 20, isMiss: d20 === 1 }
    setLastRoll(roll)
    const campId = getActiveCampaignId()
    if (campId) broadcastRoll(createClient(), campId, { type: 'attack', label: w.name, total, d20, isCrit: roll.isCrit, isMiss: roll.isMiss, detail: parts.join(' ') })
  }

  function rollDamage(w: Weapon) {
    const abilityMod = getAbilityMod(w.ability_mod)
    const diceOnly = rollFormula(w.damage ?? '1')
    const extras: RollResult['extras'] = []
    const breakdown: DmgBreakdown[] = []

    breakdown.push({ label: w.damage ?? '—', value: diceOnly.total, detail: diceOnly.detail, type: w.damage_type ?? undefined })
    if (abilityMod !== 0) breakdown.push({ label: `${(w.ability_mod ?? '').toUpperCase()} mod`, value: abilityMod, detail: signStr(abilityMod) })

    if (w.extra_damage) {
      for (const e of parseExtraDamage(w.extra_damage)) {
        const r = rollFormula(e.formula)
        extras.push({ formula: e.formula, type: e.type, ...r })
        breakdown.push({ label: e.formula, value: r.total, detail: r.detail, type: e.type })
      }
    }

    const wbs = (bonuses[w.id] ?? []).filter(b => b.applies === 'daño' || b.applies === 'ambos')
    for (const b of wbs) {
      breakdown.push({ label: b.label, value: b.value, detail: signStr(b.value), type: b.kind })
    }

    const bonusSum = activeBonusSum(w.id, 'daño')
    const total = diceOnly.total + abilityMod + extras.reduce((s, e) => s + e.total, 0) + bonusSum
    const dmgDetail = `${w.damage ?? ''}${abilityMod !== 0 ? signStr(abilityMod) : ''} → ${diceOnly.detail}`
    setLastRoll({ type: 'damage', weaponName: w.name, total, detail: dmgDetail, extras, breakdown })
    const campId = getActiveCampaignId()
    if (campId) broadcastRoll(createClient(), campId, { type: 'damage', label: w.name, total, detail: dmgDetail })
  }

  function atkDisplay(w: Weapon): string {
    if (!character || !w.ability_mod) return w.atk_bonus ?? '—'
    const abilityMod = getAbilityMod(w.ability_mod)
    const prof = w.is_proficient ? character.proficiency_bonus : 0
    const magic = parseInt(w.atk_bonus ?? '0') || 0
    const bonusSum = activeBonusSum(w.id, 'ataque')
    const total = abilityMod + prof + magic + bonusSum
    const label = w.ability_mod.toUpperCase()
    const magicPart = magic !== 0 ? signStr(magic) : ''
    const bonusPart = bonusSum !== 0 ? signStr(bonusSum) + ' bonus' : ''
    return `${signStr(total)} (${label}${w.is_proficient ? '+PB' : ''}${magicPart}${bonusPart ? ' ' + bonusPart : ''})`
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, transform: 'scaleX(-1)', opacity: 0.95 }} />
        <h2 style={{ fontFamily: 'var(--font-new-rocker, Cinzel, serif)', fontSize: '3.5rem', color: 'var(--cs-accent)', lineHeight: 1, margin: 0 }}>
          Weapons
        </h2>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, opacity: 0.95 }} />
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
              {lastRoll.weaponName} · {lastRoll.type === 'attack' ? 'Ataque' : 'Daño'}
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
          {lastRoll.type === 'damage' && lastRoll.breakdown && lastRoll.breakdown.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              {lastRoll.breakdown.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '3px 10px', borderRadius: 8,
                  background: 'rgba(201,173,106,0.10)', border: '1px solid rgba(201,173,106,0.3)',
                  minWidth: 48,
                }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700, color: 'var(--cs-text)', lineHeight: 1.2 }}>
                    {b.value >= 0 ? (i > 0 ? `+${b.value}` : b.value) : b.value}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', textAlign: 'center', marginTop: 1 }}>
                    {b.label}{b.type ? ` ${b.type}` : ''}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--cs-gold)', fontFamily: 'monospace', opacity: 0.8 }}>
                    {b.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setLastRoll(null)}
            style={{ alignSelf: 'flex-end', fontSize: '0.65rem', color: 'var(--cs-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
            cerrar ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '1.5rem 2rem' }}>
        {weapons.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.9rem', padding: '2rem 0' }}>
            No weapons added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cs-gold)' }}>
                {['Arma', 'Ataque', 'Daño', 'Extras', 'Notas'].map(h => (
                  <th key={h} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cs-text-muted)', padding: '0 0 0.6rem', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weapons.map((w, i) => (
                <>
                  <tr key={w.id} style={{ borderBottom: formOpen === w.id || (bonuses[w.id]?.length ?? 0) > 0 ? 'none' : i < weapons.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>

                    {/* Name + bonus chips + add button */}
                    <td style={{ padding: '0.75rem 0.5rem 0.4rem 0', verticalAlign: 'top' }}>
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--cs-accent)', fontWeight: 600 }}>
                        {w.name}
                      </span>
                      {w.range && <div style={{ fontSize: '0.7rem', color: 'var(--cs-text-muted)', marginTop: 2 }}>{w.range}</div>}
                      {/* bonus chips */}
                      {(bonuses[w.id] ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                          {(bonuses[w.id] ?? []).map(b => (
                            <span key={b.id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '1px 7px', borderRadius: 10, fontSize: '0.62rem',
                              fontFamily: 'var(--font-montaga)',
                              background: b.kind === 'mágico' ? 'rgba(58,111,168,0.12)' : 'rgba(139,94,60,0.12)',
                              border: `1px solid ${KIND_COLOR[b.kind]}`,
                              color: KIND_COLOR[b.kind],
                              fontWeight: 600,
                            }}>
                              {signStr(b.value)} {b.label}
                              <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>
                                {b.applies === 'ambos' ? '⚔🗡' : b.applies === 'ataque' ? '⚔' : '🗡'}
                              </span>
                              <button onClick={() => removeBonus(w.id, b.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit', fontSize: '0.65rem' }}>
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* add bonus button */}
                      <button onClick={() => openForm(w.id)}
                        style={{
                          marginTop: '0.3rem', fontSize: '0.6rem', padding: '1px 8px',
                          borderRadius: 10, border: '1px dashed rgba(201,173,106,0.6)',
                          background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer',
                        }}>
                        {formOpen === w.id ? '✕ cancelar' : '＋ bonus'}
                      </button>
                    </td>

                    {/* Attack */}
                    <td style={{ padding: '0.75rem 1rem 0.4rem 0.5rem', verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.85rem', color: 'var(--cs-text)', marginBottom: '0.3rem' }}>
                        {atkDisplay(w)}
                      </div>
                      <button onClick={() => rollAttack(w)}
                        style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                        🎲 Tirar
                      </button>
                    </td>

                    {/* Damage */}
                    <td style={{ padding: '0.75rem 1rem 0.4rem 0.5rem', verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.85rem', color: 'var(--cs-text)', marginBottom: '0.3rem' }}>
                        {w.damage ?? '—'}
                        {w.damage_type && <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.75rem', marginLeft: 4 }}>{w.damage_type}</span>}
                      </div>
                      <button onClick={() => rollDamage(w)}
                        style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-accent)', background: 'transparent', color: 'var(--cs-accent)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                        🎲 Daño
                      </button>
                    </td>

                    {/* Extra damage */}
                    <td style={{ padding: '0.75rem 0.5rem 0.4rem', verticalAlign: 'top' }}>
                      {w.extra_damage ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {parseExtraDamage(w.extra_damage).map((e, i) => (
                            <span key={i} style={{ fontSize: '0.72rem', fontFamily: 'var(--font-montaga)', color: 'var(--cs-text-muted)' }}>
                              {e.formula} <span style={{ color: 'var(--cs-text)' }}>{e.type}</span>
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.78rem' }}>—</span>}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '0.75rem 0 0.4rem 0.5rem', verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.82rem', color: 'var(--cs-text)' }}>
                        {w.notes && <div style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</div>}
                      </div>
                    </td>
                  </tr>

                  {/* Bonus add form row */}
                  {formOpen === w.id && (
                    <tr key={`${w.id}-form`} style={{ borderBottom: i < weapons.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>
                      <td colSpan={5} style={{ paddingBottom: '0.75rem', paddingLeft: 0 }}>
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end',
                          padding: '0.6rem 0.75rem',
                          background: 'rgba(201,173,106,0.06)',
                          border: '1px solid rgba(201,173,106,0.3)',
                          borderRadius: 8,
                        }}>
                          {/* Label */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>Fuente</span>
                            <select value={formLabel} onChange={e => setFormLabel(e.target.value)}
                              style={{ fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--cs-gold)', background: 'var(--parchment)', color: 'var(--cs-text)', borderRadius: 4 }}>
                              {PRESET_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            {formLabel === 'Otro' && (
                              <input value={formCustomLabel} onChange={e => setFormCustomLabel(e.target.value)}
                                placeholder="Nombre..."
                                style={{ fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--cs-gold)', background: 'var(--parchment)', color: 'var(--cs-text)', borderRadius: 4, width: 90 }} />
                            )}
                          </div>

                          {/* Value */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>Valor</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button onClick={() => setFormValue(v => v - 1)}
                                style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--cs-gold)', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--cs-text)' }}>−</button>
                              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', fontWeight: 700, minWidth: 28, textAlign: 'center', color: formValue >= 0 ? 'var(--cs-accent)' : 'var(--danger)' }}>
                                {signStr(formValue)}
                              </span>
                              <button onClick={() => setFormValue(v => v + 1)}
                                style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--cs-gold)', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--cs-text)' }}>＋</button>
                            </div>
                          </div>

                          {/* Kind */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>Tipo</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['mágico', 'físico'] as const).map(k => (
                                <button key={k} onClick={() => setFormKind(k)}
                                  style={{
                                    padding: '2px 10px', borderRadius: 10, fontSize: '0.68rem', cursor: 'pointer',
                                    border: `1px solid ${KIND_COLOR[k]}`,
                                    background: formKind === k ? KIND_COLOR[k] : 'transparent',
                                    color: formKind === k ? '#fff' : KIND_COLOR[k],
                                    fontFamily: 'var(--font-montaga)',
                                  }}>{k}</button>
                              ))}
                            </div>
                          </div>

                          {/* Applies */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>Aplica a</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['ataque', 'daño', 'ambos'] as const).map(a => (
                                <button key={a} onClick={() => setFormApplies(a)}
                                  style={{
                                    padding: '2px 10px', borderRadius: 10, fontSize: '0.68rem', cursor: 'pointer',
                                    border: '1px solid var(--cs-gold)',
                                    background: formApplies === a ? 'var(--cs-gold)' : 'transparent',
                                    color: formApplies === a ? '#3a2e1e' : 'var(--cs-gold)',
                                    fontFamily: 'var(--font-montaga)',
                                  }}>{a}</button>
                              ))}
                            </div>
                          </div>

                          {/* Add button */}
                          <button onClick={() => addBonus(w.id)}
                            style={{
                              padding: '4px 16px', borderRadius: 20, fontSize: '0.72rem', cursor: 'pointer',
                              border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff',
                              fontFamily: 'Cinzel, serif', letterSpacing: '0.04em', alignSelf: 'flex-end',
                            }}>
                            Agregar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
