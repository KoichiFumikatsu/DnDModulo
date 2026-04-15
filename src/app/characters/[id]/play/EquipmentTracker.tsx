'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CharacterEquipment } from '@/modules/characters/types'

function parseContent(entry: string): { name: string; qty: number } {
  const multi = entry.match(/^(\d+)x (.+)$/)
  if (multi) return { qty: parseInt(multi[1]), name: multi[2] }
  return { qty: 1, name: entry.split('|')[0] }
}

interface CatalogItem {
  name: string
  contents?: string[]
}

export default function EquipmentTracker({
  initialEquipment,
  catalog = [],
  variant = 'dark',
}: {
  initialEquipment: CharacterEquipment[]
  catalog?: CatalogItem[]
  variant?: 'dark' | 'parchment'
}) {
  const supabase = createClient()
  const [items, setItems] = useState(initialEquipment)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const isDark = variant === 'dark'
  const colors = {
    title: isDark ? 'var(--on-dark-muted)' : 'var(--cs-text-muted)',
    bg: isDark ? 'var(--bg-card)' : 'var(--cs-card)',
    border: isDark ? 'var(--border)' : 'rgba(201,173,106,0.35)',
    btnBg: isDark ? 'var(--bg-secondary)' : 'rgba(201,173,106,0.15)',
    btnColor: isDark ? 'var(--text-muted)' : 'var(--cs-text-muted)',
    qty: isDark ? 'var(--accent-gold)' : 'var(--cs-gold)',
    name: isDark ? 'var(--text-primary)' : 'var(--cs-text)',
    nameMuted: isDark ? 'var(--text-muted)' : 'var(--cs-text-muted)',
    subBg: isDark ? 'var(--bg-secondary)' : 'rgba(201,173,106,0.08)',
  }

  async function changeQty(id: string, delta: number) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const newQty = Math.max(0, i.quantity + delta)
      supabase.from('character_equipment').update({ quantity: newQty }).eq('id', id)
      return { ...i, quantity: newQty }
    }))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (items.length === 0) return null

  return (
    <div className={isDark ? 'mt-6' : undefined}>
      {/* Title — only in dark (play) variant; parchment wrapper supplies its own title via cs-card--notched */}
      {isDark ? (
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
          style={{ color: colors.title }}>
          Equipo
        </h3>
      ) : (
        <>
          <span className="cs-section-title">Equipo</span>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, margin: '0.4rem 0 0.5rem' }} />
        </>
      )}

      <div className={isDark ? 'rounded-xl border divide-y' : undefined}
        style={{
          background: colors.bg,
          borderColor: colors.border,
          border: isDark ? undefined : 'none',
          display: 'flex', flexDirection: 'column',
          gap: isDark ? undefined : '0.2rem',
        }}>
        {items.map(item => {
          const catalogEntry = catalog.find(c => c.name === item.name)
          const contents = catalogEntry?.contents ?? []
          const isOpen = expanded.has(item.id)
          return (
            <div key={item.id}
              style={{
                borderBottom: isDark ? undefined : `1px solid ${colors.border}`,
                paddingBottom: isDark ? undefined : '0.1rem',
              }}>
              <div className="flex items-center gap-2 px-2 py-1 text-sm"
                style={{ borderColor: colors.border }}>
                {/* − qty + */}
                <button onClick={() => changeQty(item.id, -1)}
                  className="w-5 h-5 rounded flex items-center justify-center leading-none"
                  style={{ background: colors.btnBg, color: colors.btnColor, border: `1px solid ${colors.border}`, fontSize: '0.9rem' }}>
                  −
                </button>
                <span className="w-5 text-center font-bold"
                  style={{ color: item.quantity === 0 ? 'var(--danger)' : colors.qty, fontFamily: 'Cinzel, serif', fontSize: '0.82rem' }}>
                  {item.quantity}
                </span>
                <button onClick={() => changeQty(item.id, 1)}
                  className="w-5 h-5 rounded flex items-center justify-center leading-none"
                  style={{ background: colors.btnBg, color: colors.btnColor, border: `1px solid ${colors.border}`, fontSize: '0.9rem' }}>
                  +
                </button>

                {/* Name */}
                <span className="flex-1"
                  style={{
                    color: item.quantity === 0 ? colors.nameMuted : colors.name,
                    textDecoration: item.quantity === 0 ? 'line-through' : undefined,
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-montaga, Georgia, serif)',
                  }}>
                  {item.name}
                </span>

                {/* Expand toggle for packs with catalog contents */}
                {contents.length > 0 && (
                  <button onClick={() => toggleExpand(item.id)}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: colors.btnColor, border: `1px solid ${colors.border}`, fontSize: '0.6rem' }}>
                    {isOpen ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {contents.length > 0 && isOpen && (
                <div className="px-3 pb-2"
                  style={{ background: colors.subBg, borderTop: `1px solid ${colors.border}` }}>
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {contents.map((c, i) => {
                      const { name, qty } = parseContent(c)
                      return (
                        <span key={i} className="text-xs px-2 py-0.5 rounded"
                          style={{ background: colors.bg, color: colors.nameMuted, border: `1px solid ${colors.border}` }}>
                          {qty > 1 ? `${qty}× ` : ''}{name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
