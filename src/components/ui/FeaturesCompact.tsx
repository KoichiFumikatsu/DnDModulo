'use client'

import { useState } from 'react'

interface Feature {
  id: string
  name: string
  description: string
  source: string | null
  summary: string | null
}

interface Props {
  features: Feature[]
  proficiencyBonus?: number
}

function cleanDesc(text: string): string {
  return text
    .replace(/\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1')
}

// Maps short ability abbreviations to longer text
const ABILITY_MAP: Record<string, string> = {
  strength: 'STR', str: 'STR',
  dexterity: 'DEX', dex: 'DEX',
  constitution: 'CON', con: 'CON',
  intelligence: 'INT', int: 'INT',
  wisdom: 'WIS', wis: 'WIS',
  charisma: 'CHA', cha: 'CHA',
}

function autoSummary(name: string, description: string, profBonus: number): string {
  const lname = name.toLowerCase()
  const ldesc = description.toLowerCase()
  const tags: string[] = []

  // ── Ability score increases ──────────────────────────────────────
  // Patterns like "+1 to Charisma" / "increase your Strength score by 1"
  const abilityIncrease = /\+(\d+)\s+(?:to\s+)?(?:your\s+)?(strength|dexterity|constitution|intelligence|wisdom|charisma)/gi
  let m
  const seen = new Set<string>()
  while ((m = abilityIncrease.exec(ldesc)) !== null) {
    const ab = ABILITY_MAP[m[2].toLowerCase()] ?? m[2].toUpperCase().slice(0, 3)
    const key = `+${m[1]} ${ab}`
    if (!seen.has(key)) { seen.add(key); tags.push(key) }
  }
  // "your Charisma score increases by 1" or "Increase your Charisma score by 1"
  const scoreIncrease = /(?:increase\s+your\s+)?(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(?:score\s+)?(?:increases?\s+)?by\s+(\d+)/gi
  while ((m = scoreIncrease.exec(ldesc)) !== null) {
    const ab = ABILITY_MAP[m[1].toLowerCase()] ?? m[1].toUpperCase().slice(0, 3)
    const key = `+${m[2]} ${ab}`
    if (!seen.has(key)) { seen.add(key); tags.push(key) }
  }

  // ── AC bonus ─────────────────────────────────────────────────────
  if (/\+\d+\s+(?:bonus\s+)?to\s+(?:your\s+)?(?:armor\s+class|ac)\b/i.test(ldesc) ||
      /armor\s+class\s+(?:increases?|bonus)/i.test(ldesc)) {
    const acMatch = ldesc.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:your\s+)?(?:armor\s+class|ac)/i)
    tags.push(acMatch ? `+${acMatch[1]} AC` : '+AC')
  }
  // Integrated Protection / Warforged — look by feature name as fallback
  if (!tags.some(t => t.includes('AC')) && /integrated\s+protection/i.test(lname)) {
    tags.push('+AC')
  }

  // ── Advantage grants ─────────────────────────────────────────────
  // Extract clause(s) after "advantage on" then find all skill names within them
  const SKILL_NAMES = 'acrobatics|animal handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight of hand|stealth|survival'
  const advClauseRe = /advantage\s+on\s+(.{0,120}?)(?:\.|,|;|$)/gi
  const advSkills: string[] = []
  const skillRe = new RegExp(SKILL_NAMES, 'gi')
  while ((m = advClauseRe.exec(ldesc)) !== null) {
    const clause = m[1]
    let sm
    while ((sm = skillRe.exec(clause)) !== null) {
      const s = sm[0].split(' ').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
      if (!advSkills.includes(s)) advSkills.push(s)
    }
  }
  if (advSkills.length > 0) {
    tags.push(`Adv ${advSkills.join('/')}`)
  }

  // ── Saving throw advantage ────────────────────────────────────────
  const advSavePattern = /advantage\s+on\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throws?/gi
  while ((m = advSavePattern.exec(ldesc)) !== null) {
    const ab = ABILITY_MAP[m[1].toLowerCase()] ?? m[1].toUpperCase().slice(0, 3)
    tags.push(`Adv ${ab} saves`)
  }

  // ── Resistance ───────────────────────────────────────────────────
  const resistPattern = /resistance\s+to\s+([\w\s]+?)\s+damage/gi
  const resTypes: string[] = []
  while ((m = resistPattern.exec(ldesc)) !== null) {
    const type = m[1].trim().split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
    if (!resTypes.includes(type) && type.split(' ').length <= 2) resTypes.push(type)
  }
  if (resTypes.length > 0) tags.push(`Resist ${resTypes.slice(0, 2).join('/')}`)

  // ── Dice notation (healing, temp HP, dice bonuses) ───────────────
  const dicePattern = /(\d+d\d+(?:\+\d+)?)/gi
  const diceMatches: string[] = []
  while ((m = dicePattern.exec(ldesc)) !== null) {
    if (!diceMatches.includes(m[1])) diceMatches.push(m[1])
  }
  // Only show dice if feature name suggests it's a core mechanic
  if (diceMatches.length > 0) {
    const isHealingFeature = /song\s+of\s+rest|healing\s+word|cure\s+wounds|lay\s+on\s+hands/i.test(lname)
    const isInspireFeature = /bardic\s+inspiration|magical\s+inspiration|song\s+of\s+rest/i.test(lname)
    const isBonusDie = /jack\s+of\s+all/i.test(lname)

    if (isHealingFeature || isInspireFeature) {
      const die = diceMatches[0]
      if (isHealingFeature && !isInspireFeature) tags.push(`${die} healing`)
      else if (isInspireFeature) tags.push(`${die} die`)
    } else if (!isBonusDie && diceMatches.length > 0 && tags.length === 0) {
      // Only show dice as sole tag if nothing else was found
      tags.push(diceMatches[0])
    }
  }

  // ── Jack of All Trades ───────────────────────────────────────────
  if (/jack\s+of\s+all\s+trades/i.test(lname)) {
    const half = Math.floor(profBonus / 2)
    tags.push(`+${half} unskilled checks`)
  }

  // ── Proficiency grants ───────────────────────────────────────────
  if (/gain\s+proficiency|proficient\s+(?:in|with)/i.test(ldesc) && tags.length === 0) {
    tags.push('Proficiency')
  }

  return tags.join(' · ')
}

export default function FeaturesCompact({ features, proficiencyBonus = 2 }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  if (!features || features.length === 0) return null

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{
      border: '1px solid var(--cs-gold)',
      background: 'var(--cs-card)',
      padding: '1rem 1.1rem',
    }}>
      <h3 className="cs-heading" style={{ marginBottom: '0.75rem' }}>Features &amp; Traits</h3>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {features.map((f, i) => {
          const isOpen = openIds.has(f.id)
          const desc = cleanDesc(f.description)
          const mechSummary = f.summary ?? autoSummary(f.name, desc, proficiencyBonus)
          return (
            <div
              key={f.id}
              style={{
                paddingTop: i === 0 ? 0 : '0.6rem',
                paddingBottom: '0.6rem',
                borderBottom: i < features.length - 1 ? '1px solid rgba(201,173,106,0.3)' : 'none',
              }}
            >
              {/* Name row — clickable */}
              <button
                onClick={() => toggle(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, textAlign: 'left', width: '100%',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--cs-accent)',
                  flexShrink: 0,
                }}>
                  {f.name}
                </span>
                {mechSummary && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-montaga, Georgia, serif)',
                    color: 'var(--cs-gold)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {mechSummary}
                  </span>
                )}
                <span style={{
                  fontSize: '0.6rem',
                  color: 'var(--cs-gold)',
                  display: 'inline-block',
                  transition: 'transform 0.15s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}>
                  ▼
                </span>
              </button>

              {/* Description — shown when open */}
              {isOpen && desc && (
                <p style={{
                  margin: '0.35rem 0 0',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-montaga, Georgia, serif)',
                  color: 'var(--cs-text)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {desc}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
