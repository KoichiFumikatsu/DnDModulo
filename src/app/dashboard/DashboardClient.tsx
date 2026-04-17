'use client'

import { useState } from 'react'
import Link from 'next/link'
import ManualBrowser from '@/components/ui/ManualBrowser'
import DeleteCharacterButton from '@/components/ui/DeleteCharacterButton'

interface Character {
  id: string
  name: string
  race: string | null
  image_url: string | null
  hp_current: number
  hp_max: number
  experience_points: number | null
  level: number
  pct: number
  nextLevelXP: number | null
}

interface Props {
  characters: Character[]
  classesByChar: Record<string, string[]>
}

type Tab = 'personajes' | 'manual'

const TAB_STYLES = (active: boolean): React.CSSProperties => ({
  fontFamily: 'Cinzel, serif', fontSize: '0.8rem', fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '0.5rem 1.5rem',
  background: 'transparent', border: 'none',
  borderBottom: active ? '2px solid var(--cs-gold)' : '2px solid transparent',
  color: active ? 'var(--cs-gold)' : 'var(--cs-text-muted)',
  cursor: 'pointer', transition: 'color 0.15s',
})

export default function DashboardClient({ characters, classesByChar }: Props) {
  const [tab, setTab] = useState<Tab>('personajes')

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1.8rem', letterSpacing: '0.05em' }}>
            Grimorio
          </h1>
          <div style={{ height: 1, background: 'var(--cs-gold)', margin: '0.4rem 0 0.3rem' }} />
          <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
            {characters.length} personaje{characters.length !== 1 ? 's' : ''} registrados
          </p>
        </div>
        {tab === 'personajes' && (
          <Link href="/characters/new" style={{
            textDecoration: 'none', display: 'inline-block',
            padding: '0.45rem 1.1rem',
            background: 'var(--cs-accent)', color: '#fff',
            fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.78rem',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            border: '1px solid var(--cs-accent)', borderRadius: 2,
          }}>
            + Nuevo Personaje
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,173,106,0.25)', marginBottom: '1.5rem', gap: '0.25rem' }}>
        <button style={TAB_STYLES(tab === 'personajes')} onClick={() => setTab('personajes')}>
          📜 Mis Aventureros
        </button>
        <button style={TAB_STYLES(tab === 'manual')} onClick={() => setTab('manual')}>
          📖 Manual D&D 5e
        </button>
      </div>

      {/* Characters Tab */}
      {tab === 'personajes' && (
        !characters.length ? (
          <div style={{
            background: 'var(--cs-card)', border: '1px solid var(--cs-gold)',
            textAlign: 'center', padding: '4rem 2rem', borderRadius: 2,
          }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</p>
            <p style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '1.2rem', color: 'var(--cs-accent)', marginBottom: '0.5rem' }}>
              El grimorio está vacío
            </p>
            <p style={{ color: 'var(--cs-text-muted)', marginBottom: '1.5rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)' }}>
              Escribe tu primer aventurero en estas páginas
            </p>
            <Link href="/characters/new" style={{
              textDecoration: 'none', display: 'inline-block',
              padding: '0.5rem 1.25rem',
              background: 'var(--cs-accent)', color: '#fff',
              fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.82rem',
              fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              borderRadius: 2,
            }}>
              Crear Personaje
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {characters.map(character => {
              const hpPct = Math.max(0, Math.min(100, character.hp_max > 0 ? (character.hp_current / character.hp_max) * 100 : 0))
              const hpColor = hpPct > 50 ? '#2d6a2d' : hpPct > 25 ? '#b06000' : 'var(--cs-accent)'
              const classNames = classesByChar[character.id] ?? []
              return (
                <div key={character.id} style={{ position: 'relative' }}>
                  <DeleteCharacterButton characterId={character.id} characterName={character.name} />
                  <Link href={`/characters/${character.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      background: 'var(--cs-card)', border: '2px solid var(--cs-gold)',
                      borderRadius: 2, overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(140,100,40,0.15)',
                      transition: 'box-shadow 0.2s, transform 0.15s',
                    }}>
                      <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', background: 'rgba(201,173,106,0.08)', overflow: 'hidden' }}>
                        {character.image_url ? (
                          <img src={character.image_url} alt={character.name}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', opacity: 0.35 }}>
                            🧙
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 4, left: 4, width: 16, height: 16, borderTop: '2px solid var(--cs-gold)', borderLeft: '2px solid var(--cs-gold)' }} />
                        <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderTop: '2px solid var(--cs-gold)', borderRight: '2px solid var(--cs-gold)' }} />
                        <div style={{ position: 'absolute', bottom: 4, left: 4, width: 16, height: 16, borderBottom: '2px solid var(--cs-gold)', borderLeft: '2px solid var(--cs-gold)' }} />
                        <div style={{ position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderBottom: '2px solid var(--cs-gold)', borderRight: '2px solid var(--cs-gold)' }} />
                        <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                          <svg viewBox="0 0 38 46" width={38} height={46}>
                            <path d="M2 2 L36 2 L36 30 L19 44 L2 30 Z" fill="var(--cs-gold)" stroke="var(--cs-gold-dk)" strokeWidth="1.5" />
                            <text x="19" y="22" textAnchor="middle" dominantBaseline="middle"
                              fontFamily="Cinzel, serif" fontSize="13" fontWeight="700" fill="var(--cs-card)">
                              {character.level}
                            </text>
                          </svg>
                        </div>
                      </div>
                      <div style={{ height: 2, background: 'var(--cs-gold)' }} />
                      <div style={{ padding: '0.65rem 0.85rem 0.75rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--cs-accent)', fontSize: '1rem', lineHeight: 1.2, marginBottom: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {character.name}
                        </h2>
                        <p style={{ color: 'var(--cs-text-muted)', fontSize: '0.72rem', fontStyle: 'italic', fontFamily: 'var(--font-montaga, Georgia, serif)', marginBottom: '0.6rem' }}>
                          {character.race}{classNames.length > 0 && ` · ${classNames.join(' / ')}`}
                        </p>
                        <div style={{ marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>PV</span>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: hpColor }}>
                              {character.hp_current}<span style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)' }}> / {character.hp_max}</span>
                            </span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(201,173,106,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, borderRadius: 2 }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>XP</span>
                            <span style={{ fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.68rem', color: 'var(--cs-text-muted)' }}>
                              {(character.experience_points ?? 0).toLocaleString()}
                              {character.nextLevelXP ? ` / ${character.nextLevelXP.toLocaleString()}` : ''}
                            </span>
                          </div>
                          {character.nextLevelXP && (
                            <div style={{ height: 4, background: 'rgba(201,173,106,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${character.pct}%`, background: 'linear-gradient(90deg, var(--cs-gold-dk), var(--cs-gold))', borderRadius: 2 }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Manual Tab */}
      {tab === 'manual' && <ManualBrowser />}
    </>
  )
}
