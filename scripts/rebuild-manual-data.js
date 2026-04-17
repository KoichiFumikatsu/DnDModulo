// Builds processed JSON files for the Manual browser
// Run: node scripts/rebuild-manual-data.js

const fs = require('fs')
const path = require('path')

const RAW = path.join(__dirname, '../src/lib/5etools-v2.26.1/data')
const OUT = path.join(__dirname, '../src/lib/5etools-processed')

function stripTags(text) {
  return text
    .replace(/\{@\w+\s([^|}]*)[^}]*\}/g, '$1')
    .replace(/\{@[^}]+\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractText(entry) {
  if (typeof entry === 'string') return stripTags(entry)
  if (Array.isArray(entry)) return entry.map(extractText).filter(Boolean).join(' ')
  if (entry && typeof entry === 'object') {
    if (entry.type === 'list') {
      const items = Array.isArray(entry.items) ? entry.items.map(i => '• ' + extractText(i)).join(' ') : ''
      return (entry.name ? entry.name + ': ' : '') + items
    }
    const body = entry.entries ? extractText(entry.entries)
      : entry.entry ? extractText(entry.entry)
      : entry.items ? extractText(entry.items)
      : entry.text ? extractText(entry.text)
      : ''
    return (entry.name ? entry.name + ': ' : '') + body
  }
  return ''
}

// ── Monsters (MM) ──────────────────────────────────────────────
console.log('Building monsters...')
const bData = JSON.parse(fs.readFileSync(path.join(RAW, 'bestiary/bestiary-mm.json'), 'utf8'))
const monsters = bData.monster.map(m => {
  const cr = typeof m.cr === 'string' ? m.cr : (m.cr && m.cr.cr ? m.cr.cr : '?')
  const ac = Array.isArray(m.ac) ? (typeof m.ac[0] === 'object' ? m.ac[0].ac : m.ac[0]) : m.ac
  const hp = m.hp ? { average: m.hp.average, formula: m.hp.formula } : null
  const speed = m.speed
    ? Object.entries(m.speed).map(([k, v]) => k + ' ' + (typeof v === 'object' ? v.number : v) + ' ft').join(', ')
    : ''
  const traits = (m.trait || []).slice(0, 5).map(t => ({
    name: t.name,
    desc: extractText(t.entries).slice(0, 300),
  }))
  const actions = (m.action || []).slice(0, 5).map(a => ({
    name: a.name,
    desc: extractText(a.entries).slice(0, 300),
  }))
  const legendary = (m.legendary || []).slice(0, 3).map(l => ({
    name: l.name,
    desc: extractText(l.entries).slice(0, 200),
  }))
  return {
    name: m.name,
    source: m.source,
    type: typeof m.type === 'object' ? m.type.type : m.type,
    size: Array.isArray(m.size) ? m.size.join('/') : m.size,
    alignment: Array.isArray(m.alignment) ? m.alignment.join(' ') : (m.alignment ?? ''),
    cr,
    ac: ac ?? 10,
    hp,
    speed,
    str: m.str ?? 10, dex: m.dex ?? 10, con: m.con ?? 10,
    int: m.int ?? 10, wis: m.wis ?? 10, cha: m.cha ?? 10,
    traits,
    actions,
    legendary,
  }
})
fs.writeFileSync(path.join(OUT, 'monsters.json'), JSON.stringify(monsters))
console.log('  monsters:', monsters.length, 'size:', (JSON.stringify(monsters).length / 1024).toFixed(0) + 'KB')

// ── Conditions ─────────────────────────────────────────────────
console.log('Building conditions...')
const cData = JSON.parse(fs.readFileSync(path.join(RAW, 'conditionsdiseases.json'), 'utf8'))
const conditionNames = new Set((cData.condition || []).map(c => c.name))
const conditions = [...(cData.condition || []), ...(cData.disease || [])].map(c => ({
  name: c.name,
  source: c.source,
  type: conditionNames.has(c.name) ? 'Condición' : 'Enfermedad',
  description: extractText(c.entries).slice(0, 3000),
}))
fs.writeFileSync(path.join(OUT, 'conditions.json'), JSON.stringify(conditions))
console.log('  conditions:', conditions.length)

// ── Variant Rules ──────────────────────────────────────────────
console.log('Building rules...')
const vData = JSON.parse(fs.readFileSync(path.join(RAW, 'variantrules.json'), 'utf8'))
const rules = (vData.variantrule || []).map(r => ({
  name: r.name,
  source: r.source,
  description: extractText(r.entries).slice(0, 5000),
}))
fs.writeFileSync(path.join(OUT, 'rules.json'), JSON.stringify(rules))
console.log('  rules:', rules.length)

// ── Spells enriched (add classes list) ────────────────────────
// The existing spells.json is already good, just report
const existingSpells = JSON.parse(fs.readFileSync(path.join(OUT, 'spells.json'), 'utf8'))
console.log('Spells already processed:', existingSpells.length)

console.log('Done.')
