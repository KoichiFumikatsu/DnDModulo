'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CharacterEquipment } from '@/modules/characters/types'

/** Parse a contents entry like "10x torch" or "rope|xphb" */
function parseContent(entry: string): { name: string; qty: number } {
  const multi = entry.match(/^(\d+)x (.+)$/)
  if (multi) return { qty: parseInt(multi[1]), name: multi[2] }
  return { qty: 1, name: entry.split('|')[0] }
}

/** Look up pack contents from static catalog (passed as prop) */
interface CatalogItem {
  name: string
  contents?: string[]
}

export default function EquipmentTracker({
  initialEquipment,
  catalog,
}: {
  initialEquipment: CharacterEquipment[]
  catalog: CatalogItem[]
}) {
  const supabase = createClient()
  const [items, setItems] = useState(initialEquipment)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
    <section className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--on-dark-muted)' }}>
        Equipo
      </h3>
      <div className="rounded-xl border divide-y"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {items.map(item => {
          const catalogEntry = catalog.find(c => c.name === item.name)
          const contents = catalogEntry?.contents ?? []
          const isOpen = expanded.has(item.id)
          return (
            <div key={item.id}>
              <div className="flex items-center gap-3 px-4 py-3 text-sm"
                style={{ borderColor: 'var(--border)' }}>
                {/* Quantity controls */}
                <button onClick={() => changeQty(item.id, -1)}
                  className="w-6 h-6 rounded flex items-center justify-center text-base leading-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>−</button>
                <span className="w-6 text-center font-bold"
                  style={{
                    color: item.quantity === 0 ? 'var(--danger)' : 'var(--accent-gold)',
                  }}>
                  {item.quantity}
                </span>
                <button onClick={() => changeQty(item.id, 1)}
                  className="w-6 h-6 rounded flex items-center justify-center text-base leading-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>+</button>

                {/* Name */}
                <span className="flex-1 font-medium"
                  style={{
                    color: item.quantity === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: item.quantity === 0 ? 'line-through' : undefined,
                  }}>
                  {item.name}
                </span>

                {/* Expand toggle if has contents */}
                {contents.length > 0 && (
                  <button onClick={() => toggleExpand(item.id)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
                    {isOpen ? '▲' : '▼'} {contents.length} items
                  </button>
                )}
              </div>

              {/* Pack contents */}
              {contents.length > 0 && isOpen && (
                <div className="px-4 pb-3"
                  style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div className="flex flex-wrap gap-1 pt-2">
                    {contents.map((c, i) => {
                      const { name, qty } = parseContent(c)
                      return (
                        <span key={i} className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}>
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
    </section>
  )
}
