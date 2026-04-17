'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/* ── tag stripper ───────────────────────────────────────────── */
function stripTags(text: string): string {
  return text
    .replace(/\{@\w+\s([^|}]*)[^}]*\}/g, '$1')
    .replace(/\{@[^}]+\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

type EntryObj = { type?: string; name?: string; entries?: unknown; entry?: unknown; items?: unknown; text?: unknown; rows?: unknown[][] }
function extractText(entry: unknown, depth = 0): string {
  if (typeof entry === 'string') return stripTags(entry)
  if (Array.isArray(entry)) return entry.map(e => extractText(e, depth + 1)).filter(Boolean).join(depth === 0 ? '\n\n' : ' ')
  if (typeof entry === 'object' && entry !== null) {
    const obj = entry as EntryObj
    const name = obj.name ? `**${obj.name}**` : ''
    if (obj.type === 'list') {
      const items = Array.isArray(obj.items) ? obj.items.map((i: unknown) => `  • ${extractText(i)}`).join('\n') : ''
      return [name, items].filter(Boolean).join('\n')
    }
    if (obj.type === 'table') {
      const rows = (obj.rows ?? []) as unknown[][]
      return [name, rows.map(r => r.map(c => extractText(c)).join(' | ')).join('\n')].filter(Boolean).join('\n')
    }
    const body = obj.entries ? extractText(obj.entries, depth + 1)
      : obj.entry ? extractText(obj.entry, depth + 1)
      : obj.items ? extractText(obj.items, depth + 1)
      : obj.text ? extractText(obj.text, depth + 1)
      : ''
    return [name, body].filter(Boolean).join('\n')
  }
  return ''
}

/* ── categories ─────────────────────────────────────────────── */
type Category = {
  key: string; label: string; icon: string
  sources: { label: string; path: string; field: string }[]
}

const CATEGORIES: Category[] = [
  { key: 'spells', label: 'Hechizos', icon: '✨', sources: [
    { label: 'PHB', path: 'spells/spells-phb.json', field: 'spell' },
    { label: 'XPHB', path: 'spells/spells-xphb.json', field: 'spell' },
    { label: 'TCE', path: 'spells/spells-tce.json', field: 'spell' },
    { label: 'XGE', path: 'spells/spells-xge.json', field: 'spell' },
  ]},
  { key: 'bestiary', label: 'Bestiario', icon: '🐉', sources: [
    { label: 'Monster Manual', path: 'bestiary/bestiary-mm.json', field: 'monster' },
    { label: 'VGTM', path: 'bestiary/bestiary-vgtm.json', field: 'monster' },
    { label: 'MPMM', path: 'bestiary/bestiary-mpmm.json', field: 'monster' },
  ]},
  { key: 'items', label: 'Objetos mágicos', icon: '🔮', sources: [
    { label: 'Todos', path: 'items.json', field: 'item' },
  ]},
  { key: 'classes', label: 'Clases', icon: '⚔️', sources: [
    { label: 'Barbarian', path: 'class/class-barbarian.json', field: 'class' },
    { label: 'Bard', path: 'class/class-bard.json', field: 'class' },
    { label: 'Cleric', path: 'class/class-cleric.json', field: 'class' },
    { label: 'Druid', path: 'class/class-druid.json', field: 'class' },
    { label: 'Fighter', path: 'class/class-fighter.json', field: 'class' },
    { label: 'Monk', path: 'class/class-monk.json', field: 'class' },
    { label: 'Paladin', path: 'class/class-paladin.json', field: 'class' },
    { label: 'Ranger', path: 'class/class-ranger.json', field: 'class' },
    { label: 'Rogue', path: 'class/class-rogue.json', field: 'class' },
    { label: 'Sorcerer', path: 'class/class-sorcerer.json', field: 'class' },
    { label: 'Warlock', path: 'class/class-warlock.json', field: 'class' },
    { label: 'Wizard', path: 'class/class-wizard.json', field: 'class' },
    { label: 'Artificer', path: 'class/class-artificer.json', field: 'class' },
  ]},
  { key: 'races', label: 'Razas', icon: '🧝', sources: [
    { label: 'Todas', path: 'races.json', field: 'race' },
  ]},
  { key: 'backgrounds', label: 'Trasfondos', icon: '📜', sources: [
    { label: 'Todos', path: 'backgrounds.json', field: 'background' },
  ]},
  { key: 'feats', label: 'Dotes', icon: '⭐', sources: [
    { label: 'Todas', path: 'feats.json', field: 'feat' },
  ]},
  { key: 'conditions', label: 'Condiciones', icon: '💀', sources: [
    { label: 'Todas', path: 'conditionsdiseases.json', field: 'condition' },
  ]},
  { key: 'rules', label: 'Reglas', icon: '📖', sources: [
    { label: 'Reglas variantes', path: 'variantrules.json', field: 'variantrule' },
  ]},
]

/* ── helpers ─────────────────────────────────────────────────── */
const ABILITY_KEYS = ['str','dex','con','int','wis','cha'] as const
const SCHOOL_FULL: Record<string, string> = { A:'Abjuration', C:'Conjuration', D:'Divination', E:'Enchantment', V:'Evocation', I:'Illusion', N:'Necromancy', T:'Transmutation', P:'Psionic' }
const SCHOOL_COLORS: Record<string, string> = { Abjuration:'#2563eb',Conjuration:'#7c3aed',Divination:'#0891b2',Enchantment:'#db2777',Evocation:'#dc2626',Illusion:'#8b5cf6',Necromancy:'#4b5563',Transmutation:'#d97706',Psionic:'#047857' }

function modStr(v: number) { const m = Math.floor((v-10)/2); return m >= 0 ? `+${m}` : `${m}` }

type AnyEntry = Record<string, unknown>

function getListLabel(item: AnyEntry, catKey: string): { primary: string; secondary?: string; badge?: string; badgeColor?: string } {
  const name = String(item.name ?? '—')
  if (catKey === 'spells') {
    const lvl = item.level as number
    const school = SCHOOL_FULL[item.school as string] ?? String(item.school ?? '')
    return { primary: name, secondary: school, badge: lvl === 0 ? 'Cantrip' : `Nv${lvl}`, badgeColor: SCHOOL_COLORS[school] }
  }
  if (catKey === 'bestiary') {
    const cr = item.cr as string | { cr: string } | undefined
    const crStr = typeof cr === 'string' ? cr : typeof cr === 'object' && cr !== null ? cr.cr : '?'
    return { primary: name, secondary: String(item.type ?? ''), badge: `CR ${crStr}` }
  }
  if (catKey === 'items') {
    return { primary: name, secondary: String(item.rarity ?? 'common'), badge: String(item.type ?? '') }
  }
  if (catKey === 'classes') {
    return { primary: name }
  }
  if (catKey === 'races') {
    return { primary: name, secondary: String(item.source ?? '') }
  }
  return { primary: name }
}

function getDetail(item: AnyEntry, catKey: string): { sections: { label: string; content: string }[]; mainDesc: string } {
  const sections: { label: string; content: string }[] = []
  let mainDesc = ''

  if (catKey === 'spells') {
    const school = SCHOOL_FULL[item.school as string] ?? String(item.school ?? '')
    const lvl = item.level as number
    sections.push({ label: 'Tipo', content: `${lvl === 0 ? 'Cantrip' : `Nivel ${lvl}`} · ${school}` })
    const time = (item.time as { number: number; unit: string }[] | undefined)?.[0]
    if (time) sections.push({ label: 'Tiempo de lanzamiento', content: `${time.number} ${time.unit}` })
    const range = item.range as { type: string; distance?: { type: string; amount: number } } | undefined
    if (range) sections.push({ label: 'Alcance', content: range.type === 'special' ? 'Special' : range.distance ? `${range.distance.amount} ${range.distance.type}` : range.type })
    const comp = item.components as Record<string, unknown> | undefined
    if (comp) {
      const parts = []
      if (comp.v) parts.push('V')
      if (comp.s) parts.push('S')
      if (comp.m) parts.push(`M (${typeof comp.m === 'object' ? extractText(comp.m) : comp.m})`)
      if (parts.length) sections.push({ label: 'Componentes', content: parts.join(', ') })
    }
    const dur = (item.duration as { type: string; duration?: { amount: number; type: string }; concentration?: boolean }[] | undefined)?.[0]
    if (dur) {
      const durStr = dur.type === 'instant' ? 'Instantánea' : dur.duration ? `${dur.duration.amount} ${dur.duration.type}` : dur.type
      sections.push({ label: 'Duración', content: `${durStr}${dur.concentration ? ' (Concentración)' : ''}` })
    }
    const classes = (item.classes as { fromClassList?: { name: string }[] } | undefined)?.fromClassList?.map((c: { name: string }) => c.name).join(', ')
    if (classes) sections.push({ label: 'Clases', content: classes })
    mainDesc = extractText(item.entries)
  }

  else if (catKey === 'bestiary') {
    const cr = item.cr as string | { cr: string } | undefined
    const crStr = typeof cr === 'string' ? cr : typeof cr === 'object' && cr !== null ? cr.cr : '?'
    sections.push({ label: 'Tipo', content: [item.size, item.type, `(${item.alignment})`].filter(Boolean).join(' ') })
    sections.push({ label: 'CR', content: `${crStr}` })
    if (item.ac) {
      const ac = Array.isArray(item.ac) ? item.ac[0] : item.ac
      const acVal = typeof ac === 'object' && ac !== null ? (ac as Record<string,unknown>).ac : ac
      sections.push({ label: 'CA', content: String(acVal) })
    }
    if (item.hp) {
      const hp = item.hp as { average?: number; formula?: string }
      sections.push({ label: 'PG', content: `${hp.average ?? '?'} (${hp.formula ?? ''})` })
    }
    const speed = item.speed as Record<string, unknown> | undefined
    if (speed) {
      const parts = Object.entries(speed).map(([k,v]) => `${k} ${typeof v === 'object' && v !== null ? (v as Record<string,unknown>).number : v} ft.`)
      sections.push({ label: 'Velocidad', content: parts.join(', ') })
    }
    const abilLine = ABILITY_KEYS.map(k => `${k.toUpperCase()} ${item[k] ?? 10} (${modStr(Number(item[k] ?? 10))})`).join(' | ')
    sections.push({ label: 'Atributos', content: abilLine })
    mainDesc = extractText(item.action) + (item.legendary ? '\n\n**Acciones legendarias:**\n' + extractText(item.legendary) : '')
    if (!mainDesc.trim()) mainDesc = extractText(item.trait)
  }

  else if (catKey === 'items') {
    if (item.rarity) sections.push({ label: 'Rareza', content: String(item.rarity) })
    if (item.weight) sections.push({ label: 'Peso', content: `${item.weight} lb` })
    if (item.value) sections.push({ label: 'Valor', content: `${item.value} mo` })
    if (item.reqAttune) sections.push({ label: 'Requiere sintonía', content: typeof item.reqAttune === 'string' ? item.reqAttune : 'Sí' })
    mainDesc = extractText(item.entries)
  }

  else if (catKey === 'classes') {
    if (item.hd) sections.push({ label: 'Dado de golpe', content: `d${(item.hd as Record<string,unknown>)?.faces ?? '?'}` })
    if (item.spellcastingAbility) sections.push({ label: 'Habilidad de conjuración', content: String(item.spellcastingAbility).toUpperCase() })
    mainDesc = extractText(item.fluff ?? item.entries)
  }

  else if (catKey === 'races') {
    const ab = (item.ability as Record<string,number>[] | undefined)
    if (ab) {
      const parts = ab.flatMap(e => Object.entries(e).map(([k,v]) => `${k.toUpperCase()} +${v}`))
      if (parts.length) sections.push({ label: 'Bonus de atributos', content: parts.join(', ') })
    }
    if (item.speed) sections.push({ label: 'Velocidad', content: `${typeof item.speed === 'object' ? (item.speed as Record<string,unknown>).walk ?? item.speed : item.speed} ft.` })
    if (item.size) sections.push({ label: 'Tamaño', content: String(item.size) })
    mainDesc = extractText(item.entries)
  }

  else if (catKey === 'backgrounds') {
    const skills = (item.skillProficiencies as Record<string,boolean>[] | undefined)?.[0]
    if (skills) sections.push({ label: 'Habilidades', content: Object.keys(skills).filter(k => skills[k] === true).join(', ') })
    mainDesc = extractText(item.entries)
  }

  else if (catKey === 'feats') {
    const prereq = item.prerequisite
    if (prereq) sections.push({ label: 'Prerrequisito', content: extractText(prereq) })
    const ab = (item.ability as Record<string,number>[] | undefined)
    if (ab) {
      const parts = ab.flatMap(e => ('choose' in e ? [] : Object.entries(e).map(([k,v]) => `${k.toUpperCase()} +${v}`)))
      if (parts.length) sections.push({ label: 'Bonus de atributos', content: parts.join(', ') })
    }
    mainDesc = extractText(item.entries)
  }

  else {
    mainDesc = extractText(item.entries)
  }

  return { sections, mainDesc }
}

/* ── Translate ──────────────────────────────────────────────── */
function useTranslate(text: string) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const cache = useRef<Record<string, string>>({})

  async function translate() {
    if (!text) return
    const key = text.slice(0, 200)
    if (cache.current[key]) { setTranslated(cache.current[key]); return }
    setTranslating(true)
    try {
      const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      const d = await r.json()
      if (d.translated) { cache.current[key] = d.translated; setTranslated(d.translated) }
    } finally { setTranslating(false) }
  }
  function reset() { setTranslated(null) }
  return { translated, translating, translate, reset }
}

/* ── Main Component ─────────────────────────────────────────── */
export default function ManualBrowser() {
  const [catKey, setCatKey] = useState('spells')
  const [sourceIdx, setSourceIdx] = useState(0)
  const [items, setItems] = useState<AnyEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AnyEntry | null>(null)
  const [page, setPage] = useState(0)

  const cat = CATEGORIES.find(c => c.key === catKey)!
  const source = cat.sources[sourceIdx] ?? cat.sources[0]

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setSelected(null)
    setSearch('')
    setPage(0)
    try {
      const r = await fetch(`/api/5etools/${source.path}`)
      if (!r.ok) throw new Error('not found')
      const data = await r.json()
      const arr: AnyEntry[] = data[source.field] ?? data[source.field + 's'] ?? []
      setItems(arr.filter(i => i.name))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [source.path, source.field])

  useEffect(() => { fetchItems() }, [fetchItems])

  const filtered = items.filter(i =>
    !search || String(i.name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const PAGE_SIZE = 80
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const { sections, mainDesc } = selected ? getDetail(selected, catKey) : { sections: [], mainDesc: '' }
  const { translated, translating, translate, reset } = useTranslate(mainDesc)

  function selectCat(key: string) {
    setCatKey(key)
    setSourceIdx(0)
    setSelected(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 400px', gap: '1rem', height: 'calc(100vh - 200px)', minHeight: 600 }}>

      {/* ── Left: Category nav ── */}
      <div className="parchment-page rounded-xl" style={{ padding: '0.75rem 0', overflowY: 'auto' }}>
        <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)', padding: '0 0.75rem', marginBottom: '0.5rem' }}>
          Categorías
        </p>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => selectCat(c.key)}
            style={{
              width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem',
              background: catKey === c.key ? 'rgba(201,173,106,0.18)' : 'transparent',
              border: 'none', borderLeft: catKey === c.key ? '3px solid var(--cs-gold)' : '3px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'Cinzel, serif', fontSize: '0.78rem',
              color: catKey === c.key ? 'var(--cs-gold)' : 'var(--cs-text)',
            }}>
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* ── Center: List ── */}
      <div className="parchment-page rounded-xl" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Source tabs */}
        {cat.sources.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            {cat.sources.map((s, i) => (
              <button key={s.label} onClick={() => { setSourceIdx(i) }}
                style={{
                  fontSize: '0.65rem', padding: '2px 9px', borderRadius: 10,
                  border: `1px solid ${i === sourceIdx ? 'var(--cs-gold)' : 'rgba(201,173,106,0.3)'}`,
                  background: i === sourceIdx ? 'rgba(201,173,106,0.18)' : 'transparent',
                  color: i === sourceIdx ? 'var(--cs-gold)' : 'var(--cs-text-muted)',
                  cursor: 'pointer', fontFamily: 'Cinzel, serif',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder={`Buscar en ${cat.label}...`}
          style={{
            background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(201,173,106,0.3)',
            borderRadius: 6, padding: '0.35rem 0.65rem', color: 'var(--cs-text)',
            fontSize: '0.82rem', fontFamily: 'var(--font-montaga, Georgia, serif)',
            marginBottom: '0.6rem', width: '100%', boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        <p style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
          {filtered.length} entrada{filtered.length !== 1 ? 's' : ''}
          {filtered.length > PAGE_SIZE && ` · página ${page + 1}/${totalPages}`}
        </p>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.82rem', padding: '1rem 0', textAlign: 'center' }}>Cargando...</p>
          ) : pageItems.length === 0 ? (
            <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.82rem', padding: '1rem 0', textAlign: 'center' }}>Sin resultados.</p>
          ) : (
            pageItems.map((item, idx) => {
              const lbl = getListLabel(item, catKey)
              const isSelected = selected === item
              return (
                <button key={`${item.name}-${idx}`}
                  onClick={() => { setSelected(item); reset() }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.35rem 0.5rem',
                    background: isSelected ? 'rgba(201,173,106,0.18)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(201,173,106,0.12)',
                    cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '0.4rem',
                  }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: isSelected ? 'var(--cs-gold)' : 'var(--cs-text)', flex: 1 }}>
                    {lbl.primary}
                  </span>
                  {lbl.secondary && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontStyle: 'italic' }}>
                      {lbl.secondary}
                    </span>
                  )}
                  {lbl.badge && (
                    <span style={{
                      fontSize: '0.55rem', padding: '1px 5px', borderRadius: 8,
                      background: lbl.badgeColor ? `${lbl.badgeColor}33` : 'rgba(201,173,106,0.15)',
                      color: lbl.badgeColor ?? 'var(--cs-gold)',
                      fontFamily: 'Cinzel, serif', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {lbl.badge}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(201,173,106,0.2)' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ fontSize: '0.7rem', padding: '2px 10px', borderRadius: 4, border: '1px solid rgba(201,173,106,0.3)', background: 'transparent', color: 'var(--cs-gold)', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
              ← Ant.
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--cs-text-muted)', lineHeight: '24px' }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ fontSize: '0.7rem', padding: '2px 10px', borderRadius: 4, border: '1px solid rgba(201,173,106,0.3)', background: 'transparent', color: 'var(--cs-gold)', cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
              Sig. →
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Detail panel ── */}
      <div className="parchment-page rounded-xl" style={{ padding: '1rem', overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <span style={{ fontSize: '3rem' }}>{cat.icon}</span>
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--cs-text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              Selecciona una entrada para ver sus detalles
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'var(--cs-accent)', marginBottom: '0.25rem', lineHeight: 1.2 }}>
              {String(selected.name)}
            </h2>
            <div style={{ height: 1, background: 'var(--cs-gold)', marginBottom: '0.75rem' }} />

            {/* Meta sections */}
            {sections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                {sections.map(s => (
                  <div key={s.label} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', fontSize: '0.78rem' }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--cs-text-muted)', minWidth: 80, flexShrink: 0 }}>
                      {s.label}
                    </span>
                    <span style={{ color: 'var(--cs-text)', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
                      {s.content}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {mainDesc && (
              <>
                <div style={{ height: 1, background: 'rgba(201,173,106,0.3)', marginBottom: '0.6rem' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--cs-text)', fontFamily: 'var(--font-montaga, Georgia, serif)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {(translated ?? mainDesc).split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} style={{ fontWeight: 700, fontFamily: 'Cinzel, serif', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cs-gold)', margin: '0.6rem 0 0.2rem' }}>{line.slice(2,-2)}</p>
                    }
                    if (line.startsWith('  •')) {
                      return <p key={i} style={{ margin: '0.1rem 0', paddingLeft: '1rem' }}>{line}</p>
                    }
                    if (!line.trim()) return <br key={i} />
                    return <p key={i} style={{ margin: '0.15rem 0' }}>{line}</p>
                  })}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!translated ? (
                    <button onClick={translate} disabled={translating}
                      style={{ fontSize: '0.68rem', padding: '3px 11px', borderRadius: 10, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer' }}>
                      {translating ? 'Traduciendo...' : '🌐 Traducir al español'}
                    </button>
                  ) : (
                    <button onClick={reset}
                      style={{ fontSize: '0.68rem', padding: '3px 11px', borderRadius: 10, border: '1px solid rgba(201,173,106,0.4)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
                      🔁 Ver en inglés
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
