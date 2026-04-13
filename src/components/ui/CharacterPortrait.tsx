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
  userId: string
  characterName: string
  classLabel: string
  race: string | null
  mainImageUrl: string | null
  images: ImageEntry[]
}

export default function CharacterPortrait({ characterId, userId, characterName, classLabel, race, mainImageUrl, images }: Props) {
  const [entries, setEntries] = useState<ImageEntry[]>(images)
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = entries.findIndex(e => e.is_active)
    return idx >= 0 ? idx : 0
  })
  const [editing, setEditing] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const currentImage = entries.length > 0
    ? entries[activeIdx]?.image_url
    : mainImageUrl

  async function saveImageEntry(imageUrl: string) {
    const label = newLabel.trim() || 'Default'
    const { data, error } = await supabase.from('character_images').insert({
      character_id: characterId,
      image_url: imageUrl,
      label,
      sort_order: entries.length,
      is_active: entries.length === 0,
    }).select().single()
    if (!error && data) {
      const updated = [...entries, data as ImageEntry]
      setEntries(updated)
      setActiveIdx(updated.length - 1)
      await supabase.from('characters').update({ image_url: imageUrl }).eq('id', characterId)
    }
    setNewUrl('')
    setNewLabel('')
    setSaving(false)
    setEditing(false)
    setUploadError('')
  }

  async function addFromUrl() {
    if (!newUrl.trim()) return
    setSaving(true)
    await saveImageEntry(newUrl.trim())
  }

  async function uploadFile(file: File) {
    setSaving(true)
    setUploadError('')

    // Validate type
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setUploadError('Only PNG, JPEG, WebP, GIF allowed')
      setSaving(false)
      return
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Max file size: 5MB')
      setSaving(false)
      return
    }

    const ext = file.name.split('.').pop() || 'png'
    const fileName = `${userId}/${characterId}-${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('character-portraits')
      .upload(fileName, file, { contentType: file.type, upsert: false })

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setSaving(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('character-portraits')
      .getPublicUrl(fileName)

    await saveImageEntry(urlData.publicUrl)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  async function switchImage(idx: number) {
    setActiveIdx(idx)
    const entry = entries[idx]
    if (!entry) return
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

  const inputStyle = {
    width: '100%', marginBottom: '0.3rem', padding: '0.3rem 0.5rem',
    fontSize: '0.8rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-bg)',
    color: 'var(--cs-text)', fontFamily: 'Crimson Text, serif',
  } as const

  const goldGrad = 'linear-gradient(90deg, rgb(194,122,44), rgb(250,248,190) 50%, rgb(186,114,40))'

  return (
    <div style={{ position: 'relative' }}>
      {/* Portrait frame — double gold border with corner ornaments */}
      <div style={{
        position: 'relative',
        padding: '6px',
        background: `
          linear-gradient(var(--cs-bg), var(--cs-bg)) padding-box,
          ${goldGrad} border-box
        `,
        border: '3px solid transparent',
        borderRadius: 6,
      }}>
        {/* Inner border line */}
        <div style={{
          position: 'absolute', inset: 10,
          border: '1px solid rgba(201,173,106,0.45)',
          borderRadius: 3,
          pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Corner ornaments — L-bracket style */}
        {[
          { top: 2, left: 2 },
          { top: 2, right: 2, transform: 'scaleX(-1)' },
          { bottom: 2, left: 2, transform: 'scaleY(-1)' },
          { bottom: 2, right: 2, transform: 'scale(-1,-1)' },
        ].map((pos, i) => (
          <svg key={i} width="22" height="22" viewBox="0 0 22 22" fill="none"
            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 2, ...pos }}>
            <path d="M2 20 L2 4 Q2 2 4 2 L20 2" stroke="url(#cg)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <circle cx="2" cy="2" r="1.5" fill="url(#cg)" />
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e6a028"/>
                <stop offset="0.5" stopColor="#faf8be"/>
                <stop offset="1" stopColor="#ba7228"/>
              </linearGradient>
            </defs>
          </svg>
        ))}

        <div style={{ aspectRatio: '5/7', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cs-bg)', overflow: 'hidden', borderRadius: 3 }}>
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

        {/* Name overlay — Figma Bona Nova SC style */}
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0, zIndex: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            border: '3px solid #c27a2c', borderRadius: 58,
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 20px',
          }}>
            <span style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '1.4rem', fontWeight: 700, color: 'white', letterSpacing: '0.04em' }}>
              {characterName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '0.8rem', color: 'white', opacity: 0.9 }}>
            <span>{race}</span>
            <span>{classLabel}</span>
          </div>
        </div>

        {/* Edit icon */}
        {currentImage && (
          <button
            onClick={() => setEditing(!editing)}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 4,
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--cs-gold)',
              color: 'var(--cs-gold)', cursor: 'pointer', padding: '4px 8px',
              fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
            }}>
            {editing ? '✕' : '✎'}
          </button>
        )}
      </div>{/* end portrait frame */}

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

          {/* Label input (shared) */}
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Rage, Polymorphed)"
            style={inputStyle}
          />

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.4rem' }}>
            <button
              onClick={() => setMode('file')}
              style={{
                flex: 1, padding: '0.25rem', fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
                background: mode === 'file' ? 'var(--cs-accent)' : 'transparent',
                color: mode === 'file' ? 'white' : 'var(--cs-text-muted)',
                border: '1px solid var(--cs-gold)', cursor: 'pointer',
              }}>
              Upload File
            </button>
            <button
              onClick={() => setMode('url')}
              style={{
                flex: 1, padding: '0.25rem', fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
                background: mode === 'url' ? 'var(--cs-accent)' : 'transparent',
                color: mode === 'url' ? 'white' : 'var(--cs-text-muted)',
                border: '1px solid var(--cs-gold)', cursor: 'pointer',
              }}>
              Paste URL
            </button>
          </div>

          {mode === 'file' ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={saving}
                style={{
                  width: '100%', marginBottom: '0.3rem', padding: '0.25rem',
                  fontSize: '0.75rem', border: '1px solid var(--cs-gold)',
                  background: 'var(--cs-bg)', color: 'var(--cs-text)',
                }}
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)' }}>
                PNG, JPEG, WebP, GIF — Max 5MB
              </div>
            </div>
          ) : (
            <>
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
              <button
                onClick={addFromUrl}
                disabled={saving || !newUrl.trim()}
                style={{
                  width: '100%', padding: '0.3rem', fontSize: '0.75rem', fontFamily: 'Cinzel, serif',
                  background: 'var(--cs-accent)', color: 'white', border: '1px solid var(--cs-gold)',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving || !newUrl.trim() ? 0.5 : 1,
                }}>
                {saving ? 'Saving...' : 'Add URL'}
              </button>
            </>
          )}

          {/* Error message */}
          {uploadError && (
            <div style={{ fontSize: '0.75rem', color: '#c33', marginTop: '0.3rem', fontWeight: 600 }}>
              {uploadError}
            </div>
          )}

          {/* Saving indicator */}
          {saving && (
            <div style={{ fontSize: '0.75rem', color: 'var(--cs-accent)', marginTop: '0.3rem', fontStyle: 'italic' }}>
              Uploading...
            </div>
          )}

          {/* Remove current button */}
          {entries.length > 0 && activeIdx < entries.length && (
            <button
              onClick={() => removeImage(activeIdx)}
              style={{
                width: '100%', marginTop: '0.4rem',
                padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
                background: 'none', color: 'var(--cs-accent)', border: '1px solid var(--cs-accent)',
                cursor: 'pointer',
              }}>
              Remove Current Image
            </button>
          )}
        </div>
      )}
    </div>
  )
}
