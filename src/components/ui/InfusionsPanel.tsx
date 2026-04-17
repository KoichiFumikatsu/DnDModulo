'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Infusion {
  id: string
  name: string
  description: string | null
  summary: string | null
}

function InfusionPopover({ infusion, onClose }: { infusion: Infusion; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const desc = infusion.description ?? ''
  const parts = desc.split(/\s*•\s*/).map(s => s.trim()).filter(Boolean)
  const hasIntro = parts.length > 1 && !desc.trimStart().startsWith('•')
  const intro = hasIntro ? parts[0] : null
  const items = hasIntro ? parts.slice(1) : parts

  const textStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontFamily: 'var(--font-montaga, Georgia, serif)',
    color: '#3a2e1e',
    lineHeight: 1.5,
    margin: 0,
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 50, left: 0, top: '100%', marginTop: 4,
      width: 320, background: 'var(--parchment, #f5f0e0)',
      border: '1px solid var(--cs-gold)', borderRadius: 8,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)', padding: '0.9rem 1rem',
    }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{
          fontFamily: 'var(--font-cinzel, Cinzel, serif)',
          fontSize: '0.9rem', fontWeight: 700, color: '#3a6fa8',
        }}>
          ⚙ {infusion.name}
        </span>
        {infusion.summary && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: 'var(--cs-text-muted)' }}>
            {infusion.summary}
          </span>
        )}
      </div>
      {desc ? (
        <>
          {intro && <p style={textStyle}>{intro}</p>}
          {items.length > 0 && (
            <ul style={{ margin: intro ? '0.3rem 0 0' : 0, paddingLeft: '1.2rem' }}>
              {items.map((item, i) => (
                <li key={i} style={{ ...textStyle, marginBottom: i < items.length - 1 ? '0.25rem' : 0 }}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p style={{ ...textStyle, color: 'var(--cs-text-muted)' }}>Sin descripción.</p>
      )}
    </div>
  )
}

export default function InfusionsPanel({ infusions }: { infusions: Infusion[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = useCallback((id: string) => setOpenId(prev => prev === id ? null : id), [])

  if (!infusions || infusions.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '0.75rem 1rem' }}>
      <h3 className="cs-heading" style={{ marginBottom: '0.5rem', fontSize: '0.78rem' }}>⚙ Infusiones</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {infusions.map(f => (
          <div key={f.id} style={{ position: 'relative' }}>
            <button
              onClick={() => toggle(f.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.1rem 0', textAlign: 'left',
                fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                fontSize: '0.8rem', fontWeight: 600, color: '#3a6fa8',
              }}
            >
              {f.name}
            </button>
            {openId === f.id && (
              <InfusionPopover infusion={f} onClose={() => setOpenId(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
