#!/usr/bin/env node
// Builds src/lib/5etools-processed/subclass-spells.json
// Format: { "ClassName": { "SubclassName": [{ spell, minCharLevel }] } }

const fs = require('fs')
const path = require('path')

const CLASS_DIR = path.join(__dirname, '../src/lib/5etools-v2.26.1/data/class')
const OUTPUT_FILE = path.join(__dirname, '../src/lib/5etools-processed/subclass-spells.json')

// Preferred sources (use PHB/TCE/XGE/XPHB over others, prefer PHB first)
const SOURCE_PRIORITY = ['PHB', 'XPHB', 'TCE', 'XGE', 'DMG', 'SCAG', 'EGW', 'FTD', 'VRGR', 'BGG', 'DSotDQ', 'EFA']

function cleanSpellName(raw) {
  // Remove source suffix like "|xphb", "|phb"
  return raw.replace(/\|.*$/, '').toLowerCase()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function extractSpellsFromMap(map) {
  const result = []
  for (const [levelStr, val] of Object.entries(map)) {
    const minCharLevel = levelStr === '_' ? 1 : parseInt(levelStr)
    if (isNaN(minCharLevel)) continue
    // val is array OR object with sub-keys (like {ritual:[...]})
    const spells = Array.isArray(val) ? val : Object.values(val).flat()
    for (const spell of spells) {
      if (typeof spell !== 'string') continue
      result.push({ spell: cleanSpellName(spell), minCharLevel })
    }
  }
  return result
}

function extractSpells(additionalSpells) {
  if (!additionalSpells || !additionalSpells.length) return []
  const result = []
  for (const entry of additionalSpells) {
    for (const key of ['prepared', 'innate', 'known']) {
      if (entry[key]) result.push(...extractSpellsFromMap(entry[key]))
    }
  }
  // Deduplicate
  const seen = new Set()
  return result.filter(r => {
    const k = r.spell + '|' + r.minCharLevel
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const classFiles = fs.readdirSync(CLASS_DIR).filter(f => f.startsWith('class-'))
const result = {}

for (const file of classFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(CLASS_DIR, file), 'utf8'))
  const subclasses = data.subclass || []

  // Group by name, pick best source
  const byName = {}
  for (const sub of subclasses) {
    if (!sub.name || !sub.additionalSpells) continue
    const name = sub.name
    const existing = byName[name]
    if (!existing) {
      byName[name] = sub
    } else {
      // Pick better source
      const newPrio = SOURCE_PRIORITY.indexOf(sub.source)
      const oldPrio = SOURCE_PRIORITY.indexOf(existing.source)
      if (newPrio !== -1 && (oldPrio === -1 || newPrio < oldPrio)) {
        byName[name] = sub
      }
    }
  }

  for (const sub of Object.values(byName)) {
    const className = sub.className || file.replace('class-', '').replace('.json', '')
    const capitalClass = className.charAt(0).toUpperCase() + className.slice(1)
    const spells = extractSpells(sub.additionalSpells)
    if (!spells.length) continue

    if (!result[capitalClass]) result[capitalClass] = {}
    result[capitalClass][sub.name] = spells
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8')

let total = 0
for (const cls of Object.values(result)) {
  for (const sub of Object.values(cls)) {
    total += sub.length
  }
}
console.log(`Written ${Object.keys(result).length} classes, total ${total} spell grants`)
console.log('Classes:', Object.keys(result).join(', '))
