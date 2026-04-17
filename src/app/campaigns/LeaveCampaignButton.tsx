'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LeaveCampaignButton({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function leave() {
    if (!confirm('¿Abandonar esta campaña? Podrás volver a unirte con el código.')) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('campaign_members')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
    router.refresh()
  }

  return (
    <button onClick={leave} disabled={loading}
      style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(220,50,50,0.5)', background: 'transparent', color: 'rgba(220,100,100,0.9)', fontFamily: 'Cinzel, serif', fontSize: '0.68rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
      {loading ? '...' : 'Abandonar'}
    </button>
  )
}
