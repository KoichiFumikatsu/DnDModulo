'use client'

import { useState } from 'react'

interface Feature {
  id: string
  name: string
  description: string
  source: string | null
  summary: string | null
}

interface Props {
  features: Feature[]
}

function cleanDesc(text: string): string {
  return text
    .replace(/\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1')
}

export default function FeaturesCompact({ features }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  if (!features || features.length === 0) return null

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="cs-frame cs-frame-corners" style={{
      position: 'relative',
      border: '1px solid var(--cs-gold)',
      background: 'var(--cs-card)',
      padding: '1rem 1.1rem',
    }}>
      <h3 className="cs-heading" style={{ marginBottom: '0.75rem' }}>Features &amp; Traits</h3>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {features.map((f, i) => {
          const isOpen = openIds.has(f.id)
          const desc = cleanDesc(f.description)
          return (
            <div
              key={f.id}
              style={{
                paddingTop: i === 0 ? 0 : '0.6rem',
                paddingBottom: '0.6rem',
                borderBottom: i < features.length - 1 ? '1px solid rgba(201,173,106,0.3)' : 'none',
              }}
            >
              {/* Name row — clickable */}
              <button
                onClick={() => toggle(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, textAlign: 'left', width: '100%',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--cs-accent)',
                  flex: 1,
                }}>
                  {f.name}
                </span>
                <span style={{
                  fontSize: '0.6rem',
                  color: 'var(--cs-gold)',
                  display: 'inline-block',
                  transition: 'transform 0.15s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}>
                  ▼
                </span>
              </button>

              {/* Description — shown when open */}
              {isOpen && desc && (
                <p style={{
                  margin: '0.35rem 0 0',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-montaga, Georgia, serif)',
                  color: 'var(--cs-text)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {desc}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
