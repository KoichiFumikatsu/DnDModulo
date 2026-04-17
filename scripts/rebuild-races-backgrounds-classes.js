// Rebuilds races.json, backgrounds.json, classes.json with full descriptions
// Run: node scripts/rebuild-races-backgrounds-classes.js
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
  if (Array.isArray(entry)) return entry.map(extractText).filter(Boolean).join('\n\n')
  if (entry && typeof entry === 'object') {
    if (entry.type === 'list') {
      const items = Array.isArray(entry.items)
        ? entry.items.map(i => '  • ' + extractText(i)).join('\n')
        : ''
      return (entry.name ? '**' + entry.name + '**\n' : '') + items
    }
    if (entry.type === 'table') {
      return entry.caption ? '**' + entry.caption + '** (table)' : ''
    }
    const name = entry.name ? '**' + entry.name + '**' : ''
    const body = entry.entries ? extractText(entry.entries)
      : entry.entry ? extractText(entry.entry)
      : entry.items ? extractText(entry.items)
      : entry.text ? extractText(entry.text)
      : ''
    return [name, body].filter(Boolean).join('\n')
  }
  return ''
}

// ── RACES ────────────────────────────────────────────────────────────────────
const racesRaw = JSON.parse(fs.readFileSync(path.join(RAW, 'races.json'), 'utf8'))
const races = (racesRaw.race || []).map(r => ({
  name: r.name,
  source: r.source,
  size: Array.isArray(r.size) ? r.size.join('/') : r.size,
  speed: typeof r.speed === 'object' ? r.speed.walk ?? 30 : r.speed,
  ability: r.ability,
  description: extractText(r.entries || []).slice(0, 4000),
})).filter(r => r.name)

fs.writeFileSync(path.join(OUT, 'races.json'), JSON.stringify(races))
console.log('Races:', races.length)

// ── BACKGROUNDS ───────────────────────────────────────────────────────────────
const bgsRaw = JSON.parse(fs.readFileSync(path.join(RAW, 'backgrounds.json'), 'utf8'))
const backgrounds = (bgsRaw.background || []).map(b => {
  const skills = (b.skillProficiencies?.[0]) ? Object.keys(b.skillProficiencies[0]).filter(k => b.skillProficiencies[0][k] === true) : []
  return {
    name: b.name,
    source: b.source,
    skillProficiencies: skills.length ? [Object.fromEntries(skills.map(k => [k, true]))] : undefined,
    description: extractText(b.entries || []).slice(0, 4000),
  }
}).filter(b => b.name)

fs.writeFileSync(path.join(OUT, 'backgrounds.json'), JSON.stringify(backgrounds))
console.log('Backgrounds:', backgrounds.length)

// ── CLASSES ───────────────────────────────────────────────────────────────────
const classFiles = fs.readdirSync(path.join(RAW, 'class')).filter(f => f.startsWith('class-') && f.endsWith('.json'))
const classesMap = {}

for (const file of classFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'class', file), 'utf8'))
  const classFeatureIndex = {}
  for (const cf of (data.classFeature || [])) {
    if (!classFeatureIndex[cf.className]) classFeatureIndex[cf.className] = {}
    if (!classFeatureIndex[cf.className][cf.level]) classFeatureIndex[cf.className][cf.level] = []
    classFeatureIndex[cf.className][cf.level].push({ name: cf.name, text: extractText(cf.entries || []) })
  }

  for (const cls of (data.class || [])) {
    const name = cls.name
    const subclasses = (data.subclass || []).filter(s => s.className === name).map(s => s.name)

    // Build description from first 5 levels of class features
    const features = classFeatureIndex[name] || {}
    const descParts = []
    for (let lv = 1; lv <= 20; lv++) {
      if (features[lv]) {
        for (const f of features[lv]) {
          if (!f.text) continue
          descParts.push(`**Nivel ${lv} – ${f.name}**\n${f.text}`)
        }
      }
    }

    const hitDie = cls.hd ? `d${cls.hd.faces}` : null
    const profs = cls.startingProficiencies
    const armorProfs = profs?.armor?.join(', ')
    const weaponProfs = profs?.weapons?.join(', ')
    const savingThrows = cls.proficiency?.map(p => p.toUpperCase()).join(', ')

    classesMap[name] = {
      name,
      source: cls.source,
      hitDie,
      savingThrows,
      armorProfs,
      weaponProfs,
      subclasses,
      description: descParts.join('\n\n').slice(0, 8000),
    }
  }
}

fs.writeFileSync(path.join(OUT, 'classes.json'), JSON.stringify(classesMap))
console.log('Classes:', Object.keys(classesMap).length)
console.log('Done.')
