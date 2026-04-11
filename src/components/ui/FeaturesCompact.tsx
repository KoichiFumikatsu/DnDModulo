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

/** Extract a short mechanical summary from a feature description */
function autoSummary(desc: string): string {
  if (!desc) return ''
  // Look for common mechanical patterns
  const patterns: string[] = []

  // +N bonuses
  const bonusMatch = desc.match(/\+(\d+)\s+(?:bonus\s+to\s+)?(\w[\w\s]*?)(?:\.|,|$)/i)
  if (bonusMatch) patterns.push(`+${bonusMatch[1]} ${bonusMatch[2].trim()}`)

  // Advantage mentions
  const advMatch = desc.match(/advantage\s+on\s+([\w\s]+?)(?:\s+(?:check|save|throw|roll)s?)?(?:\.|,|$)/i)
  if (advMatch) patterns.push(`Adv ${advMatch[1].trim()}`)

  // Resistance
  const resMatch = desc.match(/resistance\s+to\s+([\w\s,]+?)(?:\s+damage)?(?:\.|,|$)/i)
  if (resMatch) patterns.push(`Resist ${resMatch[1].trim()}`)

  // Proficiency
  const profMatch = desc.match(/(?:gain|have)\s+proficiency\s+(?:in|with)\s+([\w\s,]+?)(?:\.|,|$)/i)
  if (profMatch) patterns.push(`Prof ${profMatch[1].trim()}`)

  // Darkvision
  if (/darkvision/i.test(desc)) {
    const range = desc.match(/darkvision.*?(\d+)\s*(?:ft|feet)/i)
    patterns.push(range ? `Darkvision ${range[1]}ft` : 'Darkvision')
  }

  // Speed bonus
  const speedMatch = desc.match(/(?:speed|walking)\s+(?:increases?|is)\s+(?:by\s+)?(\d+)/i)
  if (speedMatch) patterns.push(`Speed +${speedMatch[1]}`)

  if (patterns.length > 0) return patterns.join(', ')

  // Fallback: first 50 chars
  const first = desc.replace(/\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}/g, '$1').substring(0, 50)
  return first + (desc.length > 50 ? '...' : '')
}

export default function FeaturesCompact({ features }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!features || features.length === 0) return null

  const openFeature = features.find(f => f.id === openId)

  // Clean 5etools tags from description for display
  function cleanDesc(text: string): string {
    return text
      .replace(/\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}/g, '$1')
      .replace(/\{@\w+\s+([^}]+)\}/g, '$1')
  }

  return (
    <>
      <div className="cs-frame cs-frame-corners" style={{ position: 'relative', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
        <h3 className="cs-heading" style={{ marginBottom: '0.5rem' }}>Features & Traits</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {features.map(f => {
            const summary = f.summary || autoSummary(f.description)
            const sourceLabel = f.source
              ? f.source.charAt(0).toUpperCase() + f.source.slice(1)
              : null
            return (
              <div
                key={f.id}
                onClick={() => setOpenId(f.id)}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: '0.4rem',
                  padding: '0.25rem 0', borderBottom: '1px solid var(--cs-gold)',
                  cursor: 'pointer', fontSize: '0.82rem',
                }}
                title="Click for details"
              >
                <span style={{ fontWeight: 700, color: 'var(--cs-accent)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                {sourceLabel && (
                  <span style={{
                    fontSize: '0.6rem', fontFamily: 'Cinzel, serif',
                    color: 'var(--cs-text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    padding: '0.1rem 0.3rem', border: '1px solid var(--cs-gold)',
                    lineHeight: 1,
                  }}>
                    {sourceLabel}
                  </span>
                )}
                <span style={{
                  flex: 1, color: 'var(--cs-text-muted)', fontSize: '0.75rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {summary}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail modal */}
      {openFeature && (
        <div
          onClick={() => setOpenId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--cs-bg, #FBF3E4)',
              border: '2px solid var(--cs-gold, #C8A855)',
              maxWidth: 550, width: '100%', maxHeight: '80vh',
              overflow: 'auto', padding: '1.5rem',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              position: 'relative',
            }}>
            {/* Close button */}
            <button
              onClick={() => setOpenId(null)}
              style={{
                position: 'absolute', top: 8, right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.2rem', color: 'var(--cs-text-muted)',
              }}>
              ✕
            </button>

            <h2 style={{
              fontFamily: 'Cinzel, serif', fontSize: '1.1rem',
              color: 'var(--cs-accent, #8b1a1a)', marginBottom: '0.25rem',
            }}>
              {openFeature.name}
            </h2>
            {openFeature.source && (
              <div style={{
                fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
                color: 'var(--cs-text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: '0.75rem',
              }}>
                Source: {openFeature.source}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                fontSize: '0.65rem', fontFamily: 'Cinzel, serif',
                color: 'var(--cs-gold-dk)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '0.3rem',
              }}>
                Description (English)
              </div>
              <p style={{
                fontSize: '0.88rem', color: 'var(--cs-text, #2C1810)',
                lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {cleanDesc(openFeature.description)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
