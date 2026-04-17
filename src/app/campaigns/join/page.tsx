'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function JoinCampaignPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true); setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Find campaign by invite code
    const { data: campaign, error: lookupErr } = await supabase
      .from('campaigns')
      .select('id, name, dm_id')
      .eq('invite_code', trimmed)
      .single()

    if (lookupErr || !campaign) {
      setError('Código inválido. Verifica con tu Master.')
      setLoading(false); return
    }

    if (campaign.dm_id === user.id) {
      // DM joining their own campaign — just redirect
      router.push(`/campaigns/${campaign.id}`)
      return
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('campaign_members')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      const { error: joinErr } = await supabase.from('campaign_members').insert({
        campaign_id: campaign.id,
        user_id: user.id,
      })
      if (joinErr) { setError(joinErr.message); setLoading(false); return }
    }

    router.push(`/campaigns/${campaign.id}`)
  }

  return (
    <div className="parchment-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>
        <Link href="/campaigns" style={{ fontSize: '0.75rem', color: 'var(--cs-gold)', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
          ← Campañas
        </Link>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'var(--cs-accent)', margin: '0.5rem 0 1.5rem' }}>
          Unirse a Campaña
        </h1>

        <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '1.5rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginBottom: '1rem' }}>
            Ingresa el código de invitación que te proporcionó tu Master.
          </p>
          <form onSubmit={join} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABCD1234"
              className="ifield"
              maxLength={8}
              style={{ textAlign: 'center', fontSize: '1.2rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.2em', fontWeight: 700 }}
              required
            />
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.78rem', fontFamily: 'var(--font-montaga)', textAlign: 'center' }}>{error}</p>
            )}
            <button type="submit" disabled={loading}
              style={{ padding: '0.6rem', borderRadius: 20, border: 'none', background: 'var(--cs-accent)', color: '#fff', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Verificando...' : 'Unirse'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
