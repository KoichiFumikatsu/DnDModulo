'use client'

import { useState } from 'react'
import { ABILITY_NAMES, SKILLS_BY_ABILITY, ABILITY_ORDER } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { getActiveCampaignId, broadcastRoll } from '@/lib/campaign/broadcast'

interface SkillRoll {
  skill: string
  rolls: number[]
  kept: number
  bonus: number
  total: number
  mode: 'normal' | 'advantage' | 'disadvantage'
}

interface Props {
  abilities: Record<string, number>
  proficiencyBonus: number
  skillProfs: { name: string; proficiency_level: string; has_advantage?: boolean }[]
  saveProfs: { name: string }[]
  hitDiceTotal: string
  characterName?: string
}

function modNum(score: number) { return Math.floor((score - 10) / 2) }
function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

export default function AbilitySkillsGrid({ abilities, proficiencyBonus, skillProfs, saveProfs, hitDiceTotal, characterName }: Props) {
  const [lastRoll, setLastRoll] = useState<SkillRoll | null>(null)

  function calcBonus(skillKey: string, ability: string): number {
    const m = modNum(abilities[ability])
    const prof = skillProfs.find(p => p.name === skillKey)
    if (!prof || prof.proficiency_level === 'none') return m
    if (prof.proficiency_level === 'expertise') return m + proficiencyBonus * 2
    return m + proficiencyBonus
  }

  function rollSkill(skillKey: string, ability: string, mode: 'normal' | 'advantage' | 'disadvantage') {
    const bonus = calcBonus(skillKey, ability)
    const d1 = Math.floor(Math.random() * 20) + 1
    const d2 = Math.floor(Math.random() * 20) + 1
    let rolls: number[], kept: number
    if (mode === 'advantage') { rolls = [d1, d2]; kept = Math.max(d1, d2) }
    else if (mode === 'disadvantage') { rolls = [d1, d2]; kept = Math.min(d1, d2) }
    else { rolls = [d1]; kept = d1 }
    const result = { skill: skillKey, rolls, kept, bonus, total: kept + bonus, mode }
    setLastRoll(result)
    const campId = getActiveCampaignId()
    if (campId) {
      broadcastRoll(createClient(), campId, {
        type: 'skill', label: skillKey,
        total: result.total, d20: kept, detail: mode !== 'normal' ? mode : undefined,
      }, characterName)
    }
  }

  return (
    <div>
      {/* Roll result banner */}
      {lastRoll && (
        <div className={`cs-roll-banner ${lastRoll.kept === 20 ? 'cs-roll-banner--nat20' : lastRoll.kept === 1 ? 'cs-roll-banner--nat1' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cs-text)' }}>
              {lastRoll.skill}
              {lastRoll.mode !== 'normal' && (
                <span style={{
                  color: lastRoll.mode === 'advantage' ? '#2d5a2d' : '#7a5500',
                  fontStyle: 'italic', marginLeft: 4, fontSize: '0.75rem',
                }}>
                  {lastRoll.mode === 'advantage' ? 'ADV' : 'DIS'}
                </span>
              )}
            </span>
            <span style={{
              fontFamily: 'Cinzel, serif', fontSize: '1.5rem', fontWeight: 700,
              color: lastRoll.kept === 20 ? 'var(--cs-gold)' : lastRoll.kept === 1 ? 'var(--cs-accent)' : 'var(--cs-accent)',
            }}>
              {lastRoll.total}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)' }}>
            {lastRoll.rolls.length > 1 ? (
              <>
                d20: [{lastRoll.rolls.map((r, i) => (
                  <span key={i} style={{
                    fontWeight: r === lastRoll.kept ? 700 : 400,
                    color: r === lastRoll.kept ? 'var(--cs-text)' : 'var(--cs-text-muted)',
                    textDecoration: r !== lastRoll.kept ? 'line-through' : 'none',
                  }}>
                    {i > 0 ? ', ' : ''}{r}
                  </span>
                ))}] {sign(lastRoll.bonus)}
              </>
            ) : (
              <>d20: {lastRoll.kept} {sign(lastRoll.bonus)}</>
            )}
            {lastRoll.kept === 20 && <span style={{ color: 'var(--cs-gold)', marginLeft: 6, fontWeight: 700 }}>NAT 20!</span>}
            {lastRoll.kept === 1 && <span style={{ color: 'var(--cs-accent)', marginLeft: 6, fontWeight: 700 }}>NAT 1!</span>}
          </div>
        </div>
      )}

      {/* 2x3 ability grid */}
      <div className="cs-ability-grid">
        {ABILITY_ORDER.map(ab => {
          const score = abilities[ab]
          const m = modNum(score)
          const hasSave = saveProfs.some(p => p.name === ab)
          const saveMod = hasSave ? m + proficiencyBonus : m
          const skills = SKILLS_BY_ABILITY[ab]

          return (
            <div key={ab} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
              {/* Ability shield badge — Figma SVG asset */}
              <div style={{ textAlign: 'center', minWidth: 58, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 58, height: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/assets/dnd/shield-ability.svg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
                  <span style={{ position: 'relative', fontFamily: 'var(--font-new-rocker, Cinzel, serif)', fontSize: '0.5rem', color: 'var(--cs-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 5 }}>
                    {ABILITY_NAMES[ab]}
                  </span>
                  <span className="cs-num" style={{ position: 'relative', fontSize: '1.35rem', lineHeight: 1 }}>
                    {sign(m)}
                  </span>
                  <span style={{ position: 'relative', fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.58rem', color: 'var(--cs-text-muted)' }}>
                    {score}
                  </span>
                </div>
                <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-montaga, Georgia, serif)', color: 'var(--cs-text-muted)', marginTop: 2 }}>
                  Save {sign(saveMod)}{hasSave ? ' ●' : ''}
                </div>
              </div>

              {/* Skills list */}
              {skills.length > 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
                  {skills.map(skill => {
                    const prof = skillProfs.find(p => p.name === skill.key)
                    const level = prof?.proficiency_level ?? 'none'
                    const hasAdv = prof?.has_advantage ?? false
                    const bonus = calcBonus(skill.key, skill.ability)
                    return (
                      <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}>
                        <span className={`cs-dot cs-dot--${level}`} />
                        <span style={{
                          flex: 1,
                          color: level !== 'none' ? 'var(--cs-text)' : 'var(--cs-text-muted)',
                          fontWeight: level !== 'none' ? 600 : 400,
                        }}>
                          {skill.name}
                          {hasAdv && <span style={{ color: '#2d5a2d', fontStyle: 'italic', fontSize: '0.6rem', marginLeft: 2 }}>ADV</span>}
                        </span>
                        <span style={{
                          fontWeight: 600, minWidth: 20, textAlign: 'right',
                          color: level === 'expertise' ? 'var(--cs-gold)' : level === 'proficient' ? 'var(--cs-accent)' : 'var(--cs-text-muted)',
                        }}>
                          {sign(bonus)}
                        </span>
                        {/* Dice buttons */}
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button className="cs-dice-btn" onClick={() => rollSkill(skill.key, skill.ability, 'normal')} title="Roll d20">
                            d20
                          </button>
                          <button className="cs-dice-btn cs-dice-btn--adv" onClick={() => rollSkill(skill.key, skill.ability, 'advantage')} title="Advantage">
                            A
                          </button>
                          <button className="cs-dice-btn cs-dice-btn--dis" onClick={() => rollSkill(skill.key, skill.ability, 'disadvantage')} title="Disadvantage">
                            D
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="cs-heading" style={{ fontSize: '0.6rem' }}>Hit Die</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cs-accent)' }}>
                    {hitDiceTotal || '—'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
