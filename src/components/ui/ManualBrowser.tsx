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
      return name
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
type Category = { key: string; label: string; icon: string }

const CATEGORIES: Category[] = [
  { key: 'spells',      label: 'Hechizos',        icon: '✨' },
  { key: 'monsters',    label: 'Bestiario',        icon: '🐉' },
  { key: 'items',       label: 'Objetos mágicos',  icon: '🔮' },
  { key: 'classes',     label: 'Clases',           icon: '⚔️' },
  { key: 'races',       label: 'Razas',            icon: '🧝' },
  { key: 'backgrounds', label: 'Trasfondos',       icon: '📜' },
  { key: 'feats',       label: 'Dotes',            icon: '⭐' },
  { key: 'conditions',  label: 'Condiciones',      icon: '💀' },
  { key: 'rules',       label: 'Reglas variantes', icon: '📖' },
]

/* ── helpers ─────────────────────────────────────────────────── */
const SCHOOL_COLORS: Record<string, string> = {
  Abjuration:'#2563eb', Conjuration:'#7c3aed', Divination:'#0891b2',
  Enchantment:'#db2777', Evocation:'#dc2626', Illusion:'#8b5cf6',
  Necromancy:'#4b5563', Transmutation:'#d97706', Necromancy2:'#6b7280',
}
const RARITY_COLORS: Record<string, string> = {
  common:'#9CAF88', uncommon:'#4D9B4D', rare:'#4A90D9', 'very rare':'#9B59B6', legendary:'#E67E22', artifact:'#E74C3C'
}
function modStr(v: number) { const m = Math.floor((v - 10) / 2); return m >= 0 ? `+${m}` : `${m}` }

type AnyEntry = Record<string, unknown>

function getListLabel(item: AnyEntry, catKey: string): { primary: string; secondary?: string; badge?: string; badgeColor?: string } {
  const name = String(item.name ?? '—')
  if (catKey === 'spells') {
    const lvl = item.level as number
    const school = String(item.school ?? '')
    return { primary: name, secondary: school, badge: lvl === 0 ? 'Cantrip' : `Nv${lvl}`, badgeColor: SCHOOL_COLORS[school] }
  }
  if (catKey === 'monsters') {
    const cr = String(item.cr ?? '?')
    return { primary: name, secondary: String(item.type ?? ''), badge: `CR ${cr}` }
  }
  if (catKey === 'items') {
    const rarity = String(item.rarity ?? 'common')
    return { primary: name, badge: rarity, badgeColor: RARITY_COLORS[rarity] }
  }
  if (catKey === 'feats') {
    return { primary: name, secondary: item.prerequisite ? String(item.prerequisite).slice(0, 30) : undefined }
  }
  if (catKey === 'conditions') {
    return { primary: name, badge: String(item.type ?? '') }
  }
  if (catKey === 'rules') {
    return { primary: name, secondary: String(item.source ?? '') }
  }
  return { primary: name, secondary: item.source ? String(item.source) : undefined }
}

function getDetail(item: AnyEntry, catKey: string): { sections: { label: string; content: string }[]; mainDesc: string } {
  const sections: { label: string; content: string }[] = []
  let mainDesc = ''

  if (catKey === 'spells') {
    const lvl = item.level as number
    sections.push({ label: 'Tipo', content: `${lvl === 0 ? 'Cantrip' : `Nivel ${lvl}`} · ${item.school ?? ''}` })
    if (item.time) sections.push({ label: 'Lanzamiento', content: String(item.time) })
    if (item.range) sections.push({ label: 'Alcance', content: String(item.range) })
    if (item.components) sections.push({ label: 'Componentes', content: String(item.components) })
    if (item.duration) sections.push({ label: 'Duración', content: String(item.duration) })
    if (item.classes && Array.isArray(item.classes) && item.classes.length > 0)
      sections.push({ label: 'Clases', content: (item.classes as string[]).join(', ') })
    if (item.damage) sections.push({ label: 'Daño', content: String(item.damage) })
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  else if (catKey === 'monsters') {
    sections.push({ label: 'Tipo', content: [item.size, item.type, item.alignment ? `(${item.alignment})` : ''].filter(Boolean).join(' ') })
    sections.push({ label: 'CR', content: String(item.cr ?? '?') })
    if (item.ac != null) sections.push({ label: 'CA', content: String(item.ac) })
    if (item.hp) {
      const hp = item.hp as { average?: number; formula?: string }
      sections.push({ label: 'PG', content: `${hp.average ?? '?'} (${hp.formula ?? ''})` })
    }
    if (item.speed) sections.push({ label: 'Velocidad', content: String(item.speed) })
    const abilLine = (['str','dex','con','int','wis','cha'] as const)
      .map(k => `${k.toUpperCase()} ${item[k] ?? 10} (${modStr(Number(item[k] ?? 10))})`).join('  ')
    sections.push({ label: 'Atributos', content: abilLine })
    // Build description from traits + actions
    const traits = (item.traits as { name: string; desc: string }[] | undefined) ?? []
    const actions = (item.actions as { name: string; desc: string }[] | undefined) ?? []
    const legendary = (item.legendary as { name: string; desc: string }[] | undefined) ?? []
    const parts: string[] = []
    if (traits.length) parts.push(...traits.map(t => `**${t.name}**\n${t.desc}`))
    if (actions.length) parts.push('**Acciones**', ...actions.map(a => `**${a.name}**\n${a.desc}`))
    if (legendary.length) parts.push('**Acciones legendarias**', ...legendary.map(l => `**${l.name}**\n${l.desc}`))
    mainDesc = parts.join('\n\n')
  }

  else if (catKey === 'items') {
    if (item.rarity) sections.push({ label: 'Rareza', content: String(item.rarity) })
    if (item.weight) sections.push({ label: 'Peso', content: `${item.weight} lb` })
    if (item.value) sections.push({ label: 'Valor', content: `${item.value} mo` })
    if (item.reqAttune) sections.push({ label: 'Sintonía', content: typeof item.reqAttune === 'string' ? item.reqAttune : 'Requerida' })
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  else if (catKey === 'classes') {
    mainDesc = String(item.description ?? extractText(item.entries) ?? '')
  }

  else if (catKey === 'races') {
    const ab = item.ability as Record<string, number>[] | string | undefined
    if (Array.isArray(ab)) {
      const parts = ab.flatMap(e => Object.entries(e).map(([k, v]) => `${k.toUpperCase()} +${v}`))
      if (parts.length) sections.push({ label: 'Bonus', content: parts.join(', ') })
    }
    if (item.speed) sections.push({ label: 'Velocidad', content: `${typeof item.speed === 'object' ? (item.speed as Record<string,unknown>).walk ?? 30 : item.speed} ft.` })
    if (item.size) sections.push({ label: 'Tamaño', content: String(item.size) })
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  else if (catKey === 'backgrounds') {
    const skills = (item.skillProficiencies as Record<string, boolean>[] | undefined)?.[0]
    if (skills) sections.push({ label: 'Habilidades', content: Object.keys(skills).filter(k => skills[k] === true).join(', ') })
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  else if (catKey === 'feats') {
    if (item.prerequisite) sections.push({ label: 'Prerrequisito', content: String(item.prerequisite) })
    const ab = item.ability as Record<string, number>[] | undefined
    if (Array.isArray(ab)) {
      const parts = ab.flatMap(e => ('choose' in e ? [] : Object.entries(e).map(([k, v]) => `${k.toUpperCase()} +${v}`)))
      if (parts.length) sections.push({ label: 'Atributos', content: parts.join(', ') })
    }
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  else {
    if (item.type) sections.push({ label: 'Tipo', content: String(item.type) })
    mainDesc = item.description ? String(item.description) : extractText(item.entries)
  }

  return { sections, mainDesc }
}

/* ── Translate ──────────────────────────────────────────────── */
function useTranslate(text: string) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const cache = useRef<Record<string, string>>({})
  const prevText = useRef('')

  if (prevText.current !== text) {
    prevText.current = text
    // reset on item change (schedule via state)
  }

  async function translate() {
    if (!text) return
    const key = text.slice(0, 300)
    if (cache.current[key]) { setTranslated(cache.current[key]); return }
    setTranslating(true)
    try {
      const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      const d = await r.json()
      if (d.translated) { cache.current[key] = d.translated; setTranslated(d.translated) }
    } finally { setTranslating(false) }
  }

  return { translated, translating, translate, reset: () => setTranslated(null) }
}

/* ── Main Component ─────────────────────────────────────────── */
export default function ManualBrowser() {
  const [catKey, setCatKey] = useState('spells')
  const [items, setItems] = useState<AnyEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AnyEntry | null>(null)
  const [page, setPage] = useState(0)
  const { translated, translating, translate, reset } = useTranslate(
    selected ? (() => { const { mainDesc } = getDetail(selected, catKey); return mainDesc })() : ''
  )

  const cat = CATEGORIES.find(c => c.key === catKey)!

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setSelected(null)
    setSearch('')
    setPage(0)
    try {
      const r = await fetch(`/api/manual?category=${catKey}`)
      if (!r.ok) throw new Error('not found')
      const data = await r.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [catKey])

  useEffect(() => { fetchItems() }, [fetchItems])

  const filtered = items.filter(i =>
    !search || String(i.name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const PAGE_SIZE = 80
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const { sections, mainDesc } = selected ? getDetail(selected, catKey) : { sections: [], mainDesc: '' }

  function selectCat(key: string) {
    setCatKey(key)
    setSelected(null)
    reset()
  }

  function selectItem(item: AnyEntry) {
    setSelected(item)
    reset()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '175px 1fr 400px', gap: '1rem', height: 'calc(100vh - 220px)', minHeight: 580 }}>

      {/* ── Left: Category nav ── */}
      <div className="parchment-page rounded-xl" style={{ padding: '0.75rem 0', overflowY: 'auto' }}>
        <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)', padding: '0 0.75rem', marginBottom: '0.5rem' }}>
          Categorías
        </p>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => selectCat(c.key)}
            style={{
              width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem',
              background: catKey === c.key ? 'rgba(201,173,106,0.18)' : 'transparent',
              border: 'none', borderLeft: catKey === c.key ? '3px solid var(--cs-gold)' : '3px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'Cinzel, serif', fontSize: '0.76rem',
              color: catKey === c.key ? 'var(--cs-gold)' : 'var(--cs-text)',
            }}>
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* ── Center: List ── */}
      <div className="parchment-page rounded-xl" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search */}
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder={`Buscar en ${cat.label}...`}
          style={{
            background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(201,173,106,0.35)',
            borderRadius: 6, padding: '0.35rem 0.65rem', color: 'var(--cs-text)',
            fontSize: '0.82rem', fontFamily: 'var(--font-montaga, Georgia, serif)',
            marginBottom: '0.5rem', width: '100%', boxSizing: 'border-box', outline: 'none',
          }}
        />
        <p style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
          {loading ? 'Cargando...' : `${filtered.length} entradas${totalPages > 1 ? ` · pág. ${page + 1}/${totalPages}` : ''}`}
        </p>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && pageItems.length === 0 ? (
            <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.82rem', padding: '2rem 0', textAlign: 'center' }}>Sin resultados.</p>
          ) : (
            pageItems.map((item, idx) => {
              const lbl = getListLabel(item, catKey)
              const isSelected = selected === item
              return (
                <button key={`${item.name}-${idx}`}
                  onClick={() => selectItem(item)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.32rem 0.5rem',
                    background: isSelected ? 'rgba(201,173,106,0.18)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(201,173,106,0.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.76rem', color: isSelected ? 'var(--cs-gold)' : 'var(--cs-text)', flex: 1 }}>
                    {lbl.primary}
                  </span>
                  {lbl.secondary && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontStyle: 'italic', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lbl.secondary}
                    </span>
                  )}
                  {lbl.badge && (
                    <span style={{
                      fontSize: '0.55rem', padding: '1px 5px', borderRadius: 8, flexShrink: 0,
                      background: lbl.badgeColor ? `${lbl.badgeColor}33` : 'rgba(201,173,106,0.15)',
                      color: lbl.badgeColor ?? 'var(--cs-gold)',
                      fontFamily: 'Cinzel, serif', fontWeight: 700,
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
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: 'var(--cs-text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              Selecciona una entrada<br/>para ver sus detalles
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'var(--cs-accent)', marginBottom: '0.2rem', lineHeight: 1.2 }}>
              {String(selected.name)}
            </h2>
            {selected.source && (
              <p style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {String(selected.source)}
              </p>
            )}
            <div style={{ height: 1, background: 'var(--cs-gold)', marginBottom: '0.65rem' }} />

            {/* Meta sections */}
            {sections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', marginBottom: '0.65rem' }}>
                {sections.map(s => (
                  <div key={s.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.76rem' }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--cs-text-muted)', minWidth: 80, flexShrink: 0 }}>
                      {s.label}
                    </span>
                    <span style={{ color: 'var(--cs-text)', fontFamily: 'var(--font-montaga, Georgia, serif)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {s.content}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {mainDesc && (
              <>
                <div style={{ height: 1, background: 'rgba(201,173,106,0.3)', marginBottom: '0.55rem' }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--cs-text)', fontFamily: 'var(--font-montaga, Georgia, serif)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {(translated ?? mainDesc).split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} style={{ fontWeight: 700, fontFamily: 'Cinzel, serif', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cs-gold)', margin: '0.5rem 0 0.15rem' }}>{line.slice(2, -2)}</p>
                    }
                    if (line.startsWith('  •')) {
                      return <p key={i} style={{ margin: '0.1rem 0', paddingLeft: '0.8rem' }}>{line.trim()}</p>
                    }
                    if (!line.trim()) return <br key={i} />
                    return <p key={i} style={{ margin: '0.12rem 0' }}>{line}</p>
                  })}
                </div>
                <div style={{ marginTop: '0.65rem' }}>
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
