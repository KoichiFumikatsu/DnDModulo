#!/usr/bin/env node
// Rebuilds src/lib/5etools-processed/spells.json with damage/healingFormula fields

const fs = require('fs')
const path = require('path')

const SPELLS_DIR = path.join(__dirname, '../src/lib/5etools-v2.26.1/data/spells')
const INDEX_FILE = path.join(SPELLS_DIR, 'index.json')
const OUTPUT_FILE = path.join(__dirname, '../src/lib/5etools-processed/spells.json')

const SCHOOL_MAP = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  I: 'Illusion', N: 'Necromancy', T: 'Transmutation', V: 'Evocation',
}

function extractText(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    if (entry.entries) return entry.entries.map(extractText).join(' ')
    if (entry.entry) return extractText(entry.entry)
    if (entry.items) return entry.items.map(extractText).join(' ')
  }
  return ''
}

function extractDescription(spell) {
  const raw = (spell.entries || []).map(extractText).join(' ')
  // Strip 5etools tags like {@damage 1d6}, {@spell cure wounds}, {@condition poisoned}
  return raw.replace(/\{@\w+\s([^}|]*)[^}]*\}/g, '$1').replace(/\s{2,}/g, ' ').trim().slice(0, 600) || null
}

function extractDamage(spell) {
  const isHealing = Array.isArray(spell.healingInflict) ||
    (Array.isArray(spell.entries) && spell.entries.some(e => {
      const text = extractText(e)
      return /regain|heal|hit point/i.test(text) && /{@(dice|damage)/.test(text)
    }))

  // Try scalingLevelDice for cantrips or other spells
  if (spell.scalingLevelDice) {
    const sld = Array.isArray(spell.scalingLevelDice) ? spell.scalingLevelDice[0] : spell.scalingLevelDice
    const baseKey = Object.keys(sld.scaling).sort((a, b) => Number(a) - Number(b))[0]
    const formula = sld.scaling[baseKey]
    if (formula) {
      const dmgType = Array.isArray(spell.damageInflict) ? spell.damageInflict[0] : null
      if (isHealing) {
        return { healingFormula: formula }
      }
      return { damage: dmgType ? `${formula} ${dmgType}` : formula }
    }
  }

  // Extract from entries text
  const allText = (spell.entries || []).map(extractText).join(' ')

  // Look for {@damage NdN} or {@dice NdN} tags
  const dmgMatch = allText.match(/\{@(?:damage|dice) ([^}]+)\}/)
  if (dmgMatch) {
    const formula = dmgMatch[1].trim()
    if (isHealing) {
      return { healingFormula: formula }
    }
    const dmgType = Array.isArray(spell.damageInflict) ? spell.damageInflict[0] : null
    return { damage: dmgType ? `${formula} ${dmgType}` : formula }
  }

  return {}
}

function formatRange(range) {
  if (!range) return 'Self'
  if (range.type === 'special') return 'Special'
  if (range.type === 'point') {
    const d = range.distance
    if (!d) return 'Self'
    if (d.type === 'self') return 'Self'
    if (d.type === 'touch') return 'Touch'
    if (d.type === 'sight') return 'Sight'
    if (d.type === 'unlimited') return 'Unlimited'
    return `${d.amount} ${d.type}`
  }
  if (range.type === 'radius' || range.type === 'sphere' || range.type === 'cone' || range.type === 'line') {
    const d = range.distance
    return d ? `${d.amount}-${d.type} ${range.type}` : range.type
  }
  return 'Self'
}

function formatTime(time) {
  if (!Array.isArray(time) || time.length === 0) return '1 action'
  const t = time[0]
  if (t.unit === 'action') return t.number === 1 ? '1 action' : `${t.number} actions`
  if (t.unit === 'bonus') return 'Bonus action'
  if (t.unit === 'reaction') return 'Reaction'
  if (t.unit === 'minute') return `${t.number} minute${t.number !== 1 ? 's' : ''}`
  if (t.unit === 'hour') return `${t.number} hour${t.number !== 1 ? 's' : ''}`
  return `${t.number} ${t.unit}`
}

function formatDuration(duration) {
  if (!Array.isArray(duration) || duration.length === 0) return 'Instantaneous'
  const d = duration[0]
  if (d.type === 'instant') return 'Instantaneous'
  if (d.type === 'permanent') return 'Until dispelled'
  if (d.type === 'special') return 'Special'
  if (d.type === 'timed') {
    const prefix = d.concentration ? 'Concentration, up to ' : ''
    const dur = d.duration
    if (!dur) return 'Timed'
    return `${prefix}${dur.amount} ${dur.type}${dur.amount !== 1 ? 's' : ''}`
  }
  return 'Instantaneous'
}

function formatComponents(components) {
  if (!components) return ''
  const parts = []
  if (components.v) parts.push('V')
  if (components.s) parts.push('S')
  if (components.m) parts.push(`M (${typeof components.m === 'string' ? components.m : components.m.text || ''})`)
  return parts.join(', ')
}

// Build class-spell lookup from sources.json
// sources.json format: { "SOURCE": { "Spell Name": { "class": [{name, source}] } } }
const SOURCES_FILE = path.join(SPELLS_DIR, 'sources.json')
const sourcesRaw = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'))
// Build: spellNameLower -> Set<className>
const spellClassMap = {}
for (const sourceData of Object.values(sourcesRaw)) {
  for (const [spellName, spellData] of Object.entries(sourceData)) {
    const key = spellName.toLowerCase()
    if (!spellClassMap[key]) spellClassMap[key] = new Set()
    for (const cls of (spellData.class || [])) {
      if (cls.name) spellClassMap[key].add(cls.name)
    }
  }
}

// Load index
const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
const spellFiles = Object.values(index)

const allSpells = []
const seenNames = new Set()

for (const file of spellFiles) {
  const filePath = path.join(SPELLS_DIR, file)
  if (!fs.existsSync(filePath)) continue
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  for (const spell of (data.spell || [])) {
    if (!spell.name) continue
    // Skip reprints to avoid duplicates (keep original source)
    const key = spell.name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)

    const dmgInfo = extractDamage(spell)
    const classSet = spellClassMap[key] ?? new Set()
    const entry = {
      name: spell.name,
      level: spell.level ?? 0,
      school: SCHOOL_MAP[spell.school] || spell.school || 'Unknown',
      source: spell.source || 'PHB',
      time: formatTime(spell.time),
      range: formatRange(spell.range),
      components: formatComponents(spell.components),
      duration: formatDuration(spell.duration),
      classes: [...classSet],
    }

    if (dmgInfo.damage) entry.damage = dmgInfo.damage
    if (dmgInfo.healingFormula) entry.healingFormula = dmgInfo.healingFormula
    const desc = extractDescription(spell)
    if (desc) entry.description = desc

    allSpells.push(entry)
  }
}

allSpells.sort((a, b) => a.name.localeCompare(b.name))

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allSpells, null, 2), 'utf8')
console.log(`Written ${allSpells.length} spells to ${OUTPUT_FILE}`)
const withDmg = allSpells.filter(s => s.damage || s.healingFormula).length
console.log(`  ${withDmg} spells have damage/healing data`)
