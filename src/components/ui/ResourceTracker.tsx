'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Resource {
  id: string
  name: string
  current: number
  maximum: number
  reset_on: string | null
}

const RESET_LABEL: Record<string, string> = {
  short_rest: 'descanso corto',
  long_rest: 'descanso largo',
}

export default function ResourceTracker({ resources }: { resources: Resource[] }) {
  const supabase = createClient()
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(resources.map(r => [r.id, r.current]))
  )

  function set(id: string, max: number, val: number) {
    const clamped = Math.max(0, Math.min(max, val))
    setValues(prev => ({ ...prev, [id]: clamped }))
    supabase.from('character_class_resources').update({ current: clamped }).eq('id', id)
  }

  const stepBtn: React.CSSProperties = {
    width: 20, height: 20, flexShrink: 0,
    background: 'var(--cs-gold)', color: 'var(--cs-card)',
    border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.9rem', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 2,
  }

  return (
    <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '0.65rem 0.85rem' }}>
      <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>
        Cargas
      </span>
      <div style={{ height: 1, background: 'var(--cs-gold)', margin: '0.3rem 0 0.5rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {resources.map(r => {
          const current = values[r.id] ?? r.current
          const pct = r.maximum > 0 ? (current / r.maximum) * 100 : 0
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-text)', flex: 1, marginRight: 4 }}>
                  {r.name}
                </span>
                <span className="cs-num" style={{ fontSize: '0.85rem', color: 'var(--cs-accent)' }}>
                  {current}<span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.7rem', color: 'var(--cs-text-muted)' }}>/{r.maximum}</span>
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(201,173,106,0.25)', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--cs-accent)', borderRadius: 2, transition: 'width 0.2s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button style={stepBtn} onClick={() => set(r.id, r.maximum, current - 1)}>−</button>
                <input
                  type="number" value={current} min={0} max={r.maximum}
                  onChange={e => set(r.id, r.maximum, parseInt(e.target.value) || 0)}
                  style={{ flex: 1, textAlign: 'center', border: '1px solid var(--cs-gold)', background: 'rgba(255,255,255,0.6)', color: 'var(--cs-text)', fontFamily: 'var(--font-cinzel)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', padding: '0.1rem 0', borderRadius: 2 }}
                />
                <button style={stepBtn} onClick={() => set(r.id, r.maximum, current + 1)}>+</button>
                {r.reset_on && (
                  <span style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', whiteSpace: 'nowrap' }}>
                    ↺ {RESET_LABEL[r.reset_on] ?? r.reset_on}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
