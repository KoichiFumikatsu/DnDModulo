import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CampaignCreateForm from './CampaignCreateForm'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Campaigns where user is DM
  const { data: dmCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, invite_code, is_active, created_at')
    .eq('dm_id', user.id)
    .order('created_at', { ascending: false })

  // Campaigns where user is a member
  const { data: memberRows } = await supabase
    .from('campaign_members')
    .select('campaign_id, campaigns(id, name, invite_code, is_active)')
    .eq('user_id', user.id)

  const memberCampaigns = (memberRows ?? [])
    .map(r => r.campaigns as { id: string; name: string; invite_code: string; is_active: boolean } | null)
    .filter(Boolean) as { id: string; name: string; invite_code: string; is_active: boolean }[]

  return (
    <div className="parchment-page" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <Link href="/dashboard" style={{ fontSize: '0.75rem', color: 'var(--cs-gold)', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
              ← Grimorio
            </Link>
            <h1 style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '2rem', color: 'var(--cs-accent)', margin: '0.25rem 0 0' }}>
              Campañas
            </h1>
          </div>
          <Link href="/campaigns/join"
            style={{ padding: '0.5rem 1.25rem', borderRadius: 20, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', fontFamily: 'Cinzel, serif', fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer' }}>
            Unirse con código
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* Left: Create new */}
          <div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'var(--cs-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Nueva Campaña
            </h2>
            <CampaignCreateForm />
          </div>

          {/* Right: My campaigns */}
          <div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'var(--cs-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Mis Campañas
            </h2>

            {/* DM campaigns */}
            {(dmCampaigns ?? []).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                  Como Master
                </p>
                {(dmCampaigns ?? []).map(c => (
                  <CampaignCard key={c.id} campaign={c} role="dm" />
                ))}
              </div>
            )}

            {/* Member campaigns */}
            {memberCampaigns.length > 0 && (
              <div>
                <p style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                  Como Jugador
                </p>
                {memberCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} role="player" />
                ))}
              </div>
            )}

            {(dmCampaigns ?? []).length === 0 && memberCampaigns.length === 0 && (
              <p style={{ color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.85rem' }}>
                Aún no tienes campañas. Crea una o únete con un código.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CampaignCard({ campaign, role }: { campaign: { id: string; name: string; invite_code: string; is_active: boolean }; role: 'dm' | 'player' }) {
  return (
    <div style={{
      border: '1px solid var(--cs-gold)', background: 'var(--cs-card)',
      padding: '0.75rem 1rem', marginBottom: '0.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cs-accent)' }}>
          {campaign.name}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 2 }}>
          {role === 'dm' ? '👑 Master' : '🗡 Jugador'} · Código: <strong style={{ color: 'var(--cs-gold)' }}>{campaign.invite_code}</strong>
        </div>
      </div>
      <Link href={`/campaigns/${campaign.id}`}
        style={{ padding: '4px 16px', borderRadius: 20, border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff', fontFamily: 'Cinzel, serif', fontSize: '0.72rem', textDecoration: 'none' }}>
        Entrar
      </Link>
    </div>
  )
}
