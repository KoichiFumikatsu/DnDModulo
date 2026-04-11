'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageEntry {
  id: string
  image_url: string
  label: string
  sort_order: number
  is_active: boolean
}

interface Props {
  characterId: string
  characterName: string
  classLabel: string
  race: string | null
  mainImageUrl: string | null
  images: ImageEntry[]
}

export default function CharacterPortrait({ characterId, characterName, classLabel, race, mainImageUrl, images }: Props) {
  const [entries, setEntries] = useState<ImageEntry[]>(images)
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = entries.findIndex(e => e.is_active)
    return idx >= 0 ? idx : 0
  })
  const [editing, setEditing] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Current displayed image: from entries if available, else fallback to mainImageUrl
  const currentImage = entries.length > 0
    ? entries[activeIdx]?.image_url
    : mainImageUrl

  async function addImage() {
    if (!newUrl.trim()) return
    setSaving(true)
    const label = newLabel.trim() || 'Default'
    const { data, error } = await supabase.from('character_images').insert({
      character_id: characterId,
      image_url: newUrl.trim(),
      label,
      sort_order: entries.length,
      is_active: entries.length === 0,
    }).select().single()
    if (!error && data) {
      const updated = [...entries, data as ImageEntry]
      setEntries(updated)
      setActiveIdx(updated.length - 1)
      // Also update character.image_url to latest
      await supabase.from('characters').update({ image_url: newUrl.trim() }).eq('id', characterId)
    }
    setNewUrl('')
    setNewLabel('')
    setSaving(false)
    setEditing(false)
  }

  async function switchImage(idx: number) {
    setActiveIdx(idx)
    const entry = entries[idx]
    if (!entry) return
    // Update is_active flags
    await supabase.from('character_images').update({ is_active: false }).eq('character_id', characterId)
    await supabase.from('character_images').update({ is_active: true }).eq('id', entry.id)
    await supabase.from('characters').update({ image_url: entry.image_url }).eq('id', characterId)
  }

  async function removeImage(idx: number) {
    const entry = entries[idx]
    if (!entry) return
    await supabase.from('character_images').delete().eq('id', entry.id)
    const updated = entries.filter((_, i) => i !== idx)
    setEntries(updated)
    if (activeIdx >= updated.length) setActiveIdx(Math.max(0, updated.length - 1))
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Medieval portrait frame */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 280" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer frame */}
          <rect x="2" y="2" width="196" height="276" rx="6" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="3" />
          {/* Inner frame */}
          <rect x="7" y="7" width="186" height="266" rx="3" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="0.8" opacity="0.5" />
          {/* Top arch decoration */}
          <path d="M70,2 Q100,-10 130,2" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="2.5" />
          <circle cx="100" cy="-2" r="3" fill="var(--cs-gold, #C8A855)" />
          {/* Corner flourishes */}
          <path d="M2,20 Q2,2 20,2" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="3" />
          <path d="M180,2 Q198,2 198,20" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="3" />
          <path d="M2,260 Q2,278 20,278" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="3" />
          <path d="M180,278 Q198,278 198,260" fill="none" stroke="var(--cs-gold, #C8A855)" strokeWidth="3" />
          {/* Small diamond decorations at midpoints */}
          <polygon points="100,0 103,4 100,8 97,4" fill="var(--cs-gold, #C8A855)" />
          <polygon points="100,272 103,276 100,280 97,276" fill="var(--cs-gold, #C8A855)" />
        </svg>

        <div style={{ aspectRatio: '5/7', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cs-bg)', overflow: 'hidden', padding: '8px' }}>
          {currentImage ? (
            <img src={currentImage} alt={characterName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--cs-text-muted)' }}>
              <span style={{ fontSize: '4rem' }}>🧙</span>
              <button
                onClick={() => setEditing(true)}
                style={{ fontSize: '0.7rem', color: 'var(--cs-accent)', background: 'none', border: '1px solid var(--cs-gold)', padding: '0.2rem 0.5rem', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>
                Add Image
              </button>
            </div>
          )}
        </div>

        {/* Name overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '2rem 0.75rem 0.75rem', color: 'white',
        }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700 }}>
            {characterName}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
            {race} · {classLabel}
          </div>
        </div>

        {/* Edit icon */}
        {currentImage && (
          <button
            onClick={() => setEditing(!editing)}
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 4,
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--cs-gold)',
              color: 'var(--cs-gold)', cursor: 'pointer', padding: '4px 8px',
              fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
            }}>
            {editing ? '✕' : '✎'}
          </button>
        )}
      </div>

      {/* Image selector tabs */}
      {entries.length > 1 && (
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {entries.map((entry, idx) => (
            <button
              key={entry.id}
              onClick={() => switchImage(idx)}
              style={{
                flex: 1, minWidth: 0,
                padding: '0.2rem 0.4rem',
                fontSize: '0.65rem',
                fontFamily: 'Cinzel, serif',
                background: idx === activeIdx ? 'var(--cs-accent)' : 'var(--cs-card)',
                color: idx === activeIdx ? 'white' : 'var(--cs-text-muted)',
                border: '1px solid var(--cs-gold)',
                cursor: 'pointer',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {/* Edit panel */}
      {editing && (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--cs-accent)', fontFamily: 'Cinzel, serif', marginBottom: '0.4rem' }}>
            ADD IMAGE
          </div>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Rage, Polymorphed)"
            style={{
              width: '100%', marginBottom: '0.3rem', padding: '0.3rem 0.5rem',
              fontSize: '0.8rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-bg)',
              color: 'var(--cs-text)', fontFamily: 'Crimson Text, serif',
            }}
          />
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="Image URL"
            style={{
              width: '100%', marginBottom: '0.3rem', padding: '0.3rem 0.5rem',
              fontSize: '0.8rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-bg)',
              color: 'var(--cs-text)', fontFamily: 'Crimson Text, serif',
            }}
          />
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={addImage}
              disabled={saving || !newUrl.trim()}
              style={{
                flex: 1, padding: '0.3rem', fontSize: '0.75rem', fontFamily: 'Cinzel, serif',
                background: 'var(--cs-accent)', color: 'white', border: '1px solid var(--cs-gold)',
                cursor: saving ? 'wait' : 'pointer', opacity: saving || !newUrl.trim() ? 0.5 : 1,
              }}>
              {saving ? 'Saving...' : 'Add'}
            </button>
            {entries.length > 0 && activeIdx < entries.length && (
              <button
                onClick={() => removeImage(activeIdx)}
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontFamily: 'Cinzel, serif',
                  background: 'none', color: 'var(--cs-accent)', border: '1px solid var(--cs-accent)',
                  cursor: 'pointer',
                }}>
                Remove Current
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
