// Builds artificer-infusions.json from 5etools optionalfeatures.json
// Run: node scripts/build-artificer-infusions.js
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
      const items = Array.isArray(entry.items)
        ? entry.items.map(i => '• ' + extractText(i)).join(' ')
        : ''
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

const data = JSON.parse(fs.readFileSync(path.join(RAW, 'optionalfeatures.json'), 'utf8'))
const infusions = (data.optionalfeature || [])
  .filter(f => Array.isArray(f.featureType) && f.featureType.includes('AI'))
  .map(f => {
    const prereq = Array.isArray(f.prerequisite) ? f.prerequisite[0] : null
    const minLevel = prereq && prereq.level ? prereq.level.level : 2
    const itemReq = prereq && prereq.item ? prereq.item.join(', ') : null
    return {
      name: f.name,
      source: f.source,
      minLevel,
      itemReq,
      description: extractText(f.entries).slice(0, 2000),
    }
  })
  .sort((a, b) => a.minLevel - b.minLevel || a.name.localeCompare(b.name))

fs.writeFileSync(path.join(OUT, 'artificer-infusions.json'), JSON.stringify(infusions))
console.log('Written', infusions.length, 'infusions:')
infusions.forEach(i => console.log(`  [lv${i.minLevel}] ${i.name}`))
