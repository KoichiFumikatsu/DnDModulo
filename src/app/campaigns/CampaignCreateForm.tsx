'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function nanoid8() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function CampaignCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No autenticado'); setLoading(false); return }

    const { data, error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim() || null,
      dm_id: user.id,
      invite_code: nanoid8(),
      is_active: true,
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/campaigns/${data.id}`)
  }

  return (
    <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <label style={{ fontSize: '0.68rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Nombre
        </label>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="La Maldición de Strahd..."
          className="ifield"
          required
        />
      </div>
      <div>
        <label style={{ fontSize: '0.68rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Descripción (opcional)
        </label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Aventuras en Barovia..."
          className="ifield"
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', fontFamily: 'var(--font-montaga)' }}>{error}</p>}
      <button type="submit" disabled={loading}
        style={{ padding: '0.5rem 1.5rem', borderRadius: 20, border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff', fontFamily: 'Cinzel, serif', fontSize: '0.8rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, alignSelf: 'flex-start' }}>
        {loading ? 'Creando...' : 'Crear campaña'}
      </button>
    </form>
  )
}
