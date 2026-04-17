import { createClient } from '@/lib/supabase/server'
import { getXPProgress } from '@/lib/5etools/xp'
import DashboardClient from './DashboardClient'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Campaigns
  const { data: dmCampaigns } = await supabase.from('campaigns').select('id, name, invite_code').eq('dm_id', user!.id).order('created_at', { ascending: false })
  const { data: memberRows } = await supabase.from('campaign_members').select('campaign_id, campaigns(id, name, invite_code)').eq('user_id', user!.id)
  const memberCampaigns = (memberRows ?? []).map(r => r.campaigns as unknown as { id: string; name: string; invite_code: string } | null).filter(Boolean) as { id: string; name: string; invite_code: string }[]

  const { data: rawChars } = await supabase
    .from('characters')
    .select('id, name, race, image_url, hp_current, hp_max, experience_points')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const { data: classes } = await supabase
    .from('character_classes')
    .select('character_id, class_name, level')
    .in('character_id', (rawChars ?? []).map(c => c.id))

  const classesByChar = (classes ?? []).reduce((acc, cls) => {
    if (!acc[cls.character_id]) acc[cls.character_id] = []
    acc[cls.character_id].push(cls.class_name)
    return acc
  }, {} as Record<string, string[]>)

  const characters = (rawChars ?? []).map(c => {
    const xp = getXPProgress(c.experience_points ?? 0)
    return { ...c, level: xp.level, pct: xp.pct, nextLevelXP: xp.nextLevelXP ?? null }
  })

  const allCampaigns = [
    ...(dmCampaigns ?? []).map(c => ({ ...c, role: 'dm' as const })),
    ...memberCampaigns.map(c => ({ ...c, role: 'player' as const })),
  ]

  return (
    <main className="cs-page flex-1 p-6 max-w-7xl mx-auto w-full">
      <DashboardClient characters={characters} classesByChar={classesByChar} />

      {/* Campaigns section */}
      <div style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '1.1rem', color: 'var(--cs-accent)', margin: 0 }}>
            Mis Campañas
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/campaigns/join"
              style={{ fontSize: '0.72rem', padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(201,173,106,0.5)', color: 'var(--cs-gold)', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
              Unirse
            </Link>
            <Link href="/campaigns"
              style={{ fontSize: '0.72rem', padding: '4px 14px', borderRadius: 20, border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
              + Nueva
            </Link>
          </div>
        </div>
        {allCampaigns.length === 0 ? (
          <p style={{ color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.85rem' }}>
            No tienes campañas aún.{' '}
            <Link href="/campaigns" style={{ color: 'var(--cs-gold)', textDecoration: 'none' }}>Crea una</Link>{' '}o{' '}
            <Link href="/campaigns/join" style={{ color: 'var(--cs-gold)', textDecoration: 'none' }}>únete con un código</Link>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {allCampaigns.map(c => (
              <Link key={c.id} href={`/campaigns/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '0.75rem 1.25rem', minWidth: 200, cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cs-accent)' }}>{c.name}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 2 }}>
                    {c.role === 'dm' ? '👑 Master' : '🗡 Jugador'} · {c.invite_code}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
