#!/usr/bin/env node
// Rebuilds src/lib/5etools-processed/race-abilities.json
// Format: { "RaceName": { fixed: { str: 1, ... }, choose?: { from: [...], count: N } } }

const fs = require('fs')
const path = require('path')

const RAW_FILE = path.join(__dirname, '../src/lib/5etools-v2.26.1/data/races.json')
const OUTPUT_FILE = path.join(__dirname, '../src/lib/5etools-processed/race-abilities.json')

const AB_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

// Source priority: prefer earlier sources (older 5e rules have fixed racial bonuses)
const SOURCE_PRIORITY = ['PHB', 'ERLW', 'VGM', 'MTF', 'SCAG', 'EEPC', 'GGR', 'PSK',
  'PSD', 'PSA', 'PSI', 'PSX', 'PSZ', 'XPHB', 'TCE', 'XGE', 'EFA', 'FTD', 'BGG']

function sourcePrio(src) {
  const i = SOURCE_PRIORITY.indexOf(src)
  return i === -1 ? 99 : i
}

function parseAbility(abilityArr) {
  if (!abilityArr || !abilityArr.length) return null
  const entry = abilityArr[0]
  const fixed = {}
  let choose = null

  for (const [k, v] of Object.entries(entry)) {
    if (k === 'choose' && v && typeof v === 'object') {
      choose = { from: v.from || AB_KEYS, count: v.count || 1 }
    } else if (AB_KEYS.includes(k) && typeof v === 'number') {
      fixed[k] = v
    }
  }

  // Skip if no bonuses at all
  if (Object.keys(fixed).length === 0 && !choose) return null
  return { fixed, ...(choose ? { choose } : {}) }
}

const data = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'))
const races = data.race || []

// Group by name, pick best source (that has ability bonuses)
const byName = {}

for (const race of races) {
  if (!race.name || !race.ability) continue
  const parsed = parseAbility(race.ability)
  if (!parsed) continue

  const existing = byName[race.name]
  if (!existing || sourcePrio(race.source) < sourcePrio(existing._source)) {
    byName[race.name] = { ...parsed, _source: race.source }
  }
}

// Clean up internal _source field
const result = {}
for (const [name, data] of Object.entries(byName)) {
  const { _source, ...rest } = data
  result[name] = rest
}

// Add the 2014-PHB races that have no ability field (they use the flat +1 to all system)
// Human PHB 2014 gives +1 to every ability
if (!result['Human']) {
  result['Human'] = { fixed: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8')

const total = Object.keys(result).length
console.log(`Written ${total} races with ability bonuses`)
console.log('Sample:', Object.entries(result).slice(0, 5).map(([n, v]) => `${n}: ${JSON.stringify(v)}`).join('\n'))
