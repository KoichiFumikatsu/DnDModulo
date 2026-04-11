'use client'

import { useState } from 'react'
import { SKILLS, ABILITY_NAMES } from '@/lib/constants'
import type { CharacterProficiency } from '@/modules/characters/types'

interface SkillRoll {
  skill: string
  rolls: number[]     // 1 or 2 d20 values
  kept: number         // the d20 value kept
  bonus: number
  total: number
  mode: 'normal' | 'advantage' | 'disadvantage'
}

interface Props {
  abilities: Record<string, number>
  proficiencyBonus: number
  skillProfs: CharacterProficiency[]
}

export default function SkillsPanel({ abilities, proficiencyBonus, skillProfs }: Props) {
  const [lastRoll, setLastRoll] = useState<SkillRoll | null>(null)

  function getProf(key: string) {
    return skillProfs.find(p => p.name === key)
  }

  function calcBonus(key: string, ability: string): number {
    const abilityMod = Math.floor((abilities[ability] - 10) / 2)
    const prof = getProf(key)
    if (!prof || prof.proficiency_level === 'none') return abilityMod
    if (prof.proficiency_level === 'expertise') return abilityMod + proficiencyBonus * 2
    return abilityMod + proficiencyBonus
  }

  function rollSkill(skillKey: string, skillAbility: string, mode: 'normal' | 'advantage' | 'disadvantage') {
    const bonus = calcBonus(skillKey, skillAbility)
    const d1 = Math.floor(Math.random() * 20) + 1
    const d2 = Math.floor(Math.random() * 20) + 1

    let rolls: number[]
    let kept: number
    if (mode === 'advantage') {
      rolls = [d1, d2]
      kept = Math.max(d1, d2)
    } else if (mode === 'disadvantage') {
      rolls = [d1, d2]
      kept = Math.min(d1, d2)
    } else {
      rolls = [d1]
      kept = d1
    }

    setLastRoll({
      skill: skillKey,
      rolls,
      kept,
      bonus,
      total: kept + bonus,
      mode,
    })
  }

  const sign = (n: number) => n >= 0 ? `+${n}` : `${n}`

  return (
    <div className="sheet-section ornate-border">
      <h3 className="chapter-heading text-xs mb-3">Skills</h3>

      {/* Roll result display */}
      {lastRoll && (
        <div style={{
          marginBottom: '0.75rem', padding: '0.5rem 0.75rem',
          background: 'var(--bg-secondary)', borderRadius: '4px',
          border: lastRoll.kept === 20 ? '2px solid var(--accent-gold)' : lastRoll.kept === 1 ? '2px solid var(--danger)' : '1px solid var(--border)',
        }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {lastRoll.skill}
              {lastRoll.mode !== 'normal' && (
                <span style={{ color: lastRoll.mode === 'advantage' ? 'var(--hp-good)' : 'var(--hp-warn)', fontStyle: 'italic', marginLeft: 4 }}>
                  {lastRoll.mode === 'advantage' ? 'ADV' : 'DIS'}
                </span>
              )}
            </span>
            <span className="text-lg font-bold" style={{
              color: lastRoll.kept === 20 ? 'var(--accent-gold)' : lastRoll.kept === 1 ? 'var(--danger)' : 'var(--text-primary)',
            }}>
              {lastRoll.total}
            </span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lastRoll.rolls.length > 1 ? (
              <>
                d20: [{lastRoll.rolls.map((r, i) => (
                  <span key={i} style={{
                    fontWeight: r === lastRoll.kept ? 700 : 400,
                    color: r === lastRoll.kept ? 'var(--text-primary)' : 'var(--text-muted)',
                    textDecoration: r !== lastRoll.kept ? 'line-through' : 'none',
                  }}>
                    {i > 0 ? ', ' : ''}{r}
                  </span>
                ))}] {sign(lastRoll.bonus)}
              </>
            ) : (
              <>d20: {lastRoll.kept} {sign(lastRoll.bonus)}</>
            )}
            {lastRoll.kept === 20 && <span style={{ color: 'var(--accent-gold)', marginLeft: 6 }}>NAT 20!</span>}
            {lastRoll.kept === 1 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>NAT 1!</span>}
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {SKILLS.map(skill => {
          const prof = getProf(skill.key)
          const level = prof?.proficiency_level ?? 'none'
          const hasAdv = prof?.has_advantage ?? false
          const bonus = calcBonus(skill.key, skill.ability)
          const s = sign(bonus)
          return (
            <div key={skill.key} className="flex items-center gap-1.5 text-sm py-0.5"
              style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Proficiency dot */}
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: level === 'expertise'
                    ? 'var(--accent-gold)'
                    : level === 'proficient'
                      ? 'var(--accent)'
                      : 'var(--border)',
                }} />
              {/* Skill name */}
              <span className="flex-1" style={{
                color: level !== 'none' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: level !== 'none' ? 600 : 400,
              }}>
                {skill.name}
                {hasAdv && (
                  <span className="ml-1 text-xs" style={{ color: 'var(--hp-good)', fontStyle: 'italic' }}>ADV</span>
                )}
              </span>
              {/* Bonus */}
              <span className="font-semibold text-xs" style={{
                color: level === 'expertise' ? 'var(--accent-gold)' : level === 'proficient' ? 'var(--accent)' : 'var(--accent-gold)',
                minWidth: 22, textAlign: 'right',
              }}>
                {s}
              </span>
              {/* Ability */}
              <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>
                {ABILITY_NAMES[skill.ability]}
              </span>
              {/* Dice buttons */}
              <div className="flex gap-0.5" style={{ flexShrink: 0 }}>
                <button
                  onClick={() => rollSkill(skill.key, skill.ability, 'normal')}
                  title="Roll d20"
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 3,
                    cursor: 'pointer', padding: '1px 4px', fontSize: '0.7rem',
                    color: 'var(--text-muted)', lineHeight: 1.2,
                  }}>
                  🎲
                </button>
                <button
                  onClick={() => rollSkill(skill.key, skill.ability, 'advantage')}
                  title="Roll with advantage"
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 3,
                    cursor: 'pointer', padding: '1px 3px', fontSize: '0.6rem',
                    color: 'var(--hp-good)', lineHeight: 1.2, fontWeight: 700,
                  }}>
                  A
                </button>
                <button
                  onClick={() => rollSkill(skill.key, skill.ability, 'disadvantage')}
                  title="Roll with disadvantage"
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 3,
                    cursor: 'pointer', padding: '1px 3px', fontSize: '0.6rem',
                    color: 'var(--hp-warn)', lineHeight: 1.2, fontWeight: 700,
                  }}>
                  D
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
