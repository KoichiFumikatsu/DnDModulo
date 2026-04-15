'use client'

import { useState } from 'react'

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

/* ── Dice roller ── */
function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1
}

function rollFormula(formula: string): { total: number; detail: string } {
  const clean = formula.toLowerCase().replace(/\s/g, '')
  // Split on + and - keeping sign
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

/* ── Parse extra_damage: "1d6 frío, 2d4 fuego" ── */
function parseExtraDamage(raw: string): { formula: string; type: string }[] {
  return raw.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    const formula = parts[0] ?? ''
    const type = parts.slice(1).join(' ')
    return { formula, type }
  }).filter(e => e.formula)
}

/* ── Roll result type ── */
interface RollResult {
  type: 'attack' | 'damage'
  weaponName: string
  d20?: number
  total: number
  detail: string
  isCrit?: boolean
  isMiss?: boolean
  extras?: { formula: string; type: string; total: number; detail: string }[]
}

/* ══════════════════════════════════════════════════════════════ */

export default function WeaponsTab({ weapons, character }: Props) {
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null)

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
    const total = d20 + abilityMod + prof + magic
    const parts = [`d20(${d20})`]
    if (abilityMod !== 0) parts.push(signStr(abilityMod) + ` ${(w.ability_mod ?? '').toUpperCase()}`)
    if (prof !== 0) parts.push(`+${prof} Prof`)
    if (magic !== 0) parts.push(signStr(magic) + ' mágico')
    setLastRoll({
      type: 'attack',
      weaponName: w.name,
      d20,
      total,
      detail: parts.join(' '),
      isCrit: d20 === 20,
      isMiss: d20 === 1,
    })
  }

  function rollDamage(w: Weapon) {
    const abilityMod = getAbilityMod(w.ability_mod)
    const baseFormula = (w.damage ?? '1') + (abilityMod !== 0 ? signStr(abilityMod) : '')
    const base = rollFormula(baseFormula)
    const extras: RollResult['extras'] = []
    if (w.extra_damage) {
      for (const e of parseExtraDamage(w.extra_damage)) {
        const r = rollFormula(e.formula)
        extras.push({ formula: e.formula, type: e.type, ...r })
      }
    }
    const total = base.total + extras.reduce((s, e) => s + e.total, 0)
    const parts = [`${w.damage ?? ''}${abilityMod !== 0 ? signStr(abilityMod) : ''} → ${base.total}(${base.detail})`]
    setLastRoll({
      type: 'damage',
      weaponName: w.name,
      total,
      detail: parts.join(''),
      extras,
    })
  }

  /* ── Derived attack bonus display ── */
  function atkDisplay(w: Weapon): string {
    if (!character || !w.ability_mod) return w.atk_bonus ?? '—'
    const abilityMod = getAbilityMod(w.ability_mod)
    const prof = w.is_proficient ? character.proficiency_bonus : 0
    const magic = parseInt(w.atk_bonus ?? '0') || 0
    const total = abilityMod + prof + magic
    const label = w.ability_mod.toUpperCase()
    return `${signStr(total)} (${label}${w.is_proficient ? '+PB' : ''}${magic !== 0 ? signStr(magic) : ''})`
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
          marginBottom: '1.5rem',
          padding: '1rem 1.5rem',
          border: `2px solid ${lastRoll.isCrit ? 'var(--cs-gold)' : lastRoll.isMiss ? 'var(--danger)' : 'rgba(201,173,106,0.4)'}`,
          borderRadius: 12,
          background: 'var(--cs-card)',
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
          {/* Extra damage breakdown */}
          {lastRoll.extras && lastRoll.extras.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {lastRoll.extras.map((e, i) => (
                <span key={i} style={{
                  fontSize: '0.75rem', padding: '2px 8px', borderRadius: 20,
                  background: 'var(--cs-card-alt, rgba(201,173,106,0.12))',
                  border: '1px solid rgba(201,173,106,0.3)',
                  color: 'var(--cs-text)',
                }}>
                  +{e.total} {e.type} ({e.detail})
                </span>
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
                <tr key={w.id} style={{ borderBottom: i < weapons.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>

                  {/* Name */}
                  <td style={{ padding: '0.75rem 0.5rem 0.75rem 0', verticalAlign: 'middle' }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--cs-accent)', fontWeight: 600 }}>
                      {w.name}
                    </span>
                    {w.range && <div style={{ fontSize: '0.7rem', color: 'var(--cs-text-muted)', marginTop: 2 }}>{w.range}</div>}
                  </td>

                  {/* Attack */}
                  <td style={{ padding: '0.75rem 1rem 0.75rem 0.5rem', verticalAlign: 'middle' }}>
                    <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.85rem', color: 'var(--cs-text)', marginBottom: '0.3rem' }}>
                      {atkDisplay(w)}
                    </div>
                    <button onClick={() => rollAttack(w)}
                      style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                      🎲 Tirar
                    </button>
                  </td>

                  {/* Damage */}
                  <td style={{ padding: '0.75rem 1rem 0.75rem 0.5rem', verticalAlign: 'middle' }}>
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
                  <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
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
                  <td style={{ padding: '0.75rem 0 0.75rem 0.5rem', verticalAlign: 'middle' }}>
                    <div style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.82rem', color: 'var(--cs-text)' }}>
                      {w.notes && <div style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</div>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
