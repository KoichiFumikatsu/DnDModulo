'use client'

import { useState, useRef, useEffect } from 'react'
import type { Feat } from '@/lib/5etools/data'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (feat: Feat) => void
  feats: Feat[]
  characterLevel: number
}

const SOURCE_LABELS: Record<string, string> = {
  PHB: "Player's Handbook",
  XPHB: "PHB 2024",
  TCE: "Tasha's Cauldron",
  XGE: "Xanathar's Guide",
}

const CATEGORIES: Record<string, string> = {
  G: 'General',
  O: 'Origin',
  EB: 'Epic Boon',
  FS: 'Fighting Style',
}

function getPrereqSummary(feat: Feat): string {
  if (!feat.prerequisite?.length) return ''
  const parts: string[] = []
  for (const p of feat.prerequisite) {
    if (p.level) parts.push(`Nivel ${p.level}+`)
    if (Array.isArray(p.ability)) {
      for (const ab of p.ability) {
        for (const [k, v] of Object.entries(ab as Record<string, number>)) {
          parts.push(`${k.toUpperCase()} ${v}+`)
        }
      }
    }
    if (p.spellcasting) parts.push('Lanzar conjuros')
    if (p.other) parts.push(String(p.other))
  }
  return parts.join(', ')
}

function getAbilitySummary(feat: Feat): string {
  if (!feat.ability?.length) return ''
  const parts: string[] = []
  for (const ab of feat.ability) {
    for (const [k, v] of Object.entries(ab)) {
      if (k === 'choose') {
        const c = v as { from?: string[], amount?: number, count?: number }
        const amt = c.amount ?? 1
        const cnt = c.count ?? 1
        parts.push(`+${amt} a ${cnt} de [${(c.from ?? []).map(s => s.toUpperCase()).join(', ')}]`)
      } else if (k !== 'hidden' && typeof v === 'number') {
        parts.push(`${k.toUpperCase()} +${v}`)
      }
    }
  }
  return parts.join(', ')
}

function getFirstEntry(feat: Feat): string {
  if (!feat.entries?.length) return ''
  for (const e of feat.entries) {
    if (typeof e === 'string') return e.length > 200 ? e.slice(0, 197) + '...' : e
  }
  return ''
}

export default function FeatModal({ open, onClose, onSelect, feats, characterLevel }: Props) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [prereqFilter, setPrereqFilter] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  if (!open) return null

  const filtered = feats.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter && f.source !== sourceFilter) return false
    if (categoryFilter && f.category !== categoryFilter) return false
    if (prereqFilter) {
      for (const p of f.prerequisite ?? []) {
        if (p.level && (p.level as number) > characterLevel) return false
      }
    }
    return true
  })

  const sources = [...new Set(feats.map(f => f.source))].sort()
  const categories = [...new Set(feats.map(f => f.category).filter(Boolean))]

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" ref={panelRef}>
        <div className="modal-header">
          <h2 style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '1.1rem', margin: 0, color: 'var(--crimson)' }}>
            Seleccionar Feat
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
            color: 'var(--ink-faded)', lineHeight: 1,
          }}>
            &times;
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--parchment-edge)' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar feat por nombre..."
            className="ifield"
            autoFocus
            style={{ marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="ifield" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}>
              <option value="">Todos los manuales</option>
              {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="ifield" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c} value={c}>{CATEGORIES[c!] ?? c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--ink-faded)' }}>
              <input type="checkbox" checked={prereqFilter} onChange={e => setPrereqFilter(e.target.checked)} />
              Ocultar no elegibles
            </label>
          </div>
        </div>

        <div className="modal-body">
          {filtered.length === 0 && (
            <p style={{ color: 'var(--ink-faded)', textAlign: 'center', padding: '2rem 0' }}>
              No se encontraron feats
            </p>
          )}
          {filtered.map(feat => {
            const prereq = getPrereqSummary(feat)
            const abSummary = getAbilitySummary(feat)
            const desc = getFirstEntry(feat)
            return (
              <div key={feat.name + feat.source}
                onClick={() => onSelect(feat)}
                style={{
                  padding: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer',
                  border: '1px solid var(--parchment-edge)', background: 'var(--parchment-dark)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-dark)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--parchment-edge)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                  <span style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {feat.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-light)', fontFamily: 'var(--font-cinzel, Cinzel, serif)' }}>
                    {SOURCE_LABELS[feat.source] ?? feat.source}
                    {feat.category && ` · ${CATEGORIES[feat.category] ?? feat.category}`}
                  </span>
                </div>
                {prereq && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--crimson)', marginBottom: '0.2rem' }}>
                    Requisito: {prereq}
                  </div>
                )}
                {abSummary && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--hp-good)', marginBottom: '0.2rem' }}>
                    {abSummary}
                  </div>
                )}
                {desc && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-faded)', lineHeight: 1.4 }}>
                    {desc}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
