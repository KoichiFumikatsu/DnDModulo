#!/usr/bin/env node
// Rebuilds src/lib/5etools-processed/feats.json with skillProficiencies, expertise, grantedSpells

const fs = require('fs')
const path = require('path')

const RAW_FILE = path.join(__dirname, '../src/lib/5etools-v2.26.1/data/feats.json')
const OUTPUT_FILE = path.join(__dirname, '../src/lib/5etools-processed/feats.json')

const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'))

function extractText(entry) {
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object') return ''
  if (entry.type === 'list' && Array.isArray(entry.items)) return entry.items.map(extractText).join(' ')
  if (entry.type === 'entries' || entry.type === 'section') {
    const parts = []
    if (entry.name) parts.push(entry.name + ':')
    if (Array.isArray(entry.entries)) parts.push(...entry.entries.map(extractText))
    return parts.join(' ')
  }
  if (entry.type === 'table') return ''
  if (Array.isArray(entry.entries)) return entry.entries.map(extractText).join(' ')
  return ''
}

function extractDescription(feat) {
  if (!feat.entries || !feat.entries.length) return null
  const raw = feat.entries.map(extractText).join(' ')
  return raw
    .replace(/\{@\w+\s([^}|]*)[^}]*\}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim() || null
}

function cleanSpellName(raw) {
  return raw
    .replace(/\|.*$/, '')   // remove source suffix
    .replace(/#.*$/, '')     // remove hash flags
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function extractGrantedSpells(additionalSpells) {
  if (!additionalSpells || !additionalSpells.length) return null
  const result = []
  for (const entry of additionalSpells) {
    for (const key of ['prepared', 'innate', 'known']) {
      if (!entry[key]) continue
      for (const [levelStr, val] of Object.entries(entry[key])) {
        // val can be array OR object with sub-keys (daily, ritual, will...)
        const spells = Array.isArray(val)
          ? val
          : Object.values(val).flat().flatMap(v => Array.isArray(v) ? v : Object.values(v).flat())
        for (const spell of spells) {
          if (typeof spell !== 'string') continue
          if (spell.includes('choose')) continue
          result.push(cleanSpellName(spell))
        }
      }
    }
  }
  const unique = [...new Set(result)]
  return unique.length ? unique : null
}

const processed = raw.feat.map(feat => {
  const entry = {
    name: feat.name,
    source: feat.source,
    category: feat.category ?? null,
    prerequisite: feat.prerequisite
      ? feat.prerequisite.map(p => {
          if (p.level) return `Level ${p.level.level ?? p.level}`
          if (p.race) return p.race.map(r => r.name).join(', ')
          if (p.ability) return Object.entries(p.ability).map(([k,v])=>`${k.toUpperCase()} ${v}+`).join(', ')
          if (p.spellcasting) return 'Spellcasting'
          if (p.spellcasting2020) return 'Spellcasting'
          if (p.psionics) return 'Psionics'
          if (p.feature) return p.feature.map(f=>f.name).join(', ')
          return Object.keys(p).join(', ')
        }).join('; ')
      : '',
    ability: feat.ability ?? null,
    description: extractDescription(feat),
  }

  if (feat.skillProficiencies) entry.skillProficiencies = feat.skillProficiencies
  if (feat.expertise) entry.expertise = feat.expertise

  const grantedSpells = extractGrantedSpells(feat.additionalSpells)
  if (grantedSpells) entry.grantedSpells = grantedSpells

  return entry
})

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processed, null, 2), 'utf8')
console.log(`Written ${processed.length} feats`)
const withSpells = processed.filter(f => f.grantedSpells).length
console.log(`${withSpells} feats with spell grants`)
