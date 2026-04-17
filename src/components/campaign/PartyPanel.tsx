'use client'

import { useState } from 'react'

interface Member {
  userId: string
  username: string
  characterId: string | null
  characterName: string | null
  race: string | null
  className: string | null
  level: number | null
  portraitUrl: string | null
  isOnline: boolean
}

interface Props {
  members: Member[]
  isDM: boolean
  onViewSheet?: (characterId: string) => void
}

export default function PartyPanel({ members, isDM, onViewSheet }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {members.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', padding: '0.5rem 0' }}>
          Esperando jugadores...
        </p>
      )}
      {members.map(m => (
        <div key={m.userId} className="camp-party-card">
          {/* Online indicator + portrait */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: m.portraitUrl ? `url(${m.portraitUrl}) center/cover` : 'rgba(201,173,106,0.2)',
              border: '2px solid var(--cs-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--cs-accent)', fontWeight: 700,
            }}>
              {!m.portraitUrl && (m.characterName?.[0] ?? m.username?.[0] ?? '?')}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: '50%',
              background: m.isOnline ? '#22c55e' : '#6b7280',
              border: '1.5px solid var(--cs-card)',
            }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', fontWeight: 700, color: 'var(--cs-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.characterName ?? '—'}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>
              {[m.race, m.className, m.level ? `Nv${m.level}` : null].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 1 }}>
              👤 {m.username}
            </div>
          </div>

          {/* DM: ver hoja */}
          {isDM && m.characterId && onViewSheet && (
            <button onClick={() => onViewSheet(m.characterId!)}
              style={{ flexShrink: 0, fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>
              Ver PJ
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
