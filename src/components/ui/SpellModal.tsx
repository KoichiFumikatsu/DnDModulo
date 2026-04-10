'use client'

import { useState, useRef, useEffect } from 'react'
import type { SpellEntry } from '@/lib/5etools/data'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (spell: SpellEntry) => void
  spells: SpellEntry[]
}

const SCHOOL_COLORS: Record<string, string> = {
  Abjuration: '#2563eb',
  Conjuration: '#7c3aed',
  Divination: '#0891b2',
  Enchantment: '#db2777',
  Evocation: '#dc2626',
  Illusion: '#8b5cf6',
  Necromancy: '#4b5563',
  Transmutation: '#d97706',
}

export default function SpellModal({ open, onClose, onSelect, spells }: Props) {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | ''>('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [ritualFilter, setRitualFilter] = useState(false)
  const [concFilter, setConcFilter] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setSearch(''); setLevelFilter(''); setSchoolFilter('') }
  }, [open])

  if (!open) return null

  const filtered = spells.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (levelFilter !== '' && s.level !== levelFilter) return false
    if (schoolFilter && s.school !== schoolFilter) return false
    if (ritualFilter && !s.ritual) return false
    if (concFilter && !s.concentration) return false
    return true
  })

  const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort()

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" ref={panelRef} style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <h2 style={{
            fontFamily: 'var(--font-cinzel, Cinzel, serif)',
            fontSize: '1.1rem', margin: 0, color: 'var(--crimson)',
          }}>
            Seleccionar Hechizo
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.4rem',
            cursor: 'pointer', color: 'var(--ink-faded)', lineHeight: 1,
          }}>
            &times;
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--parchment-edge)' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar hechizo por nombre..."
            className="ifield"
            autoFocus
            style={{ marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem', alignItems: 'center' }}>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value === '' ? '' : +e.target.value)}
              className="ifield" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}>
              <option value="">Todos los niveles</option>
              <option value={0}>Trucos (0)</option>
              {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Nivel {n}</option>)}
            </select>
            <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}
              className="ifield" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}>
              <option value="">Todas las escuelas</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--ink-faded)' }}>
              <input type="checkbox" checked={ritualFilter} onChange={e => setRitualFilter(e.target.checked)} />
              Ritual
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--ink-faded)' }}>
              <input type="checkbox" checked={concFilter} onChange={e => setConcFilter(e.target.checked)} />
              Concentracion
            </label>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-light)', fontSize: '0.78rem' }}>
              {filtered.length} hechizos
            </span>
          </div>
        </div>

        {/* Spell list */}
        <div className="modal-body">
          {filtered.length === 0 && (
            <p style={{ color: 'var(--ink-faded)', textAlign: 'center', padding: '2rem 0' }}>
              No se encontraron hechizos
            </p>
          )}
          {filtered.map(spell => (
            <div key={spell.name + spell.source}
              onClick={() => onSelect(spell)}
              style={{
                padding: '0.6rem 0.75rem', marginBottom: '0.4rem', cursor: 'pointer',
                border: '1px solid var(--parchment-edge)', background: 'var(--parchment-dark)',
                transition: 'border-color 0.15s',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'start',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-dark)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--parchment-edge)')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.15rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                    fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)',
                  }}>
                    {spell.name}
                  </span>
                  {spell.ritual && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--hp-good)', fontStyle: 'italic' }}>R</span>
                  )}
                  {spell.concentration && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--hp-warn)', fontStyle: 'italic' }}>C</span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ink-faded)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {spell.range && <span>Range: {spell.range}</span>}
                  {spell.duration && <span>Duration: {spell.duration}</span>}
                  {spell.components && <span>Components: {spell.components}</span>}
                  {spell.time && <span>Time: {spell.time}</span>}
                </div>
                {spell.description && (
                  <div style={{
                    fontSize: '0.82rem', color: 'var(--ink-faded)',
                    lineHeight: 1.35, marginTop: '0.25rem',
                    maxHeight: '2.7em', overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {spell.description.length > 180 ? spell.description.slice(0, 177) + '...' : spell.description}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                  color: SCHOOL_COLORS[spell.school] ?? 'var(--ink-light)',
                  fontWeight: 600,
                }}>
                  {spell.school}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-light)' }}>
                  {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
