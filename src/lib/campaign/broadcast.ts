import type { SupabaseClient } from '@supabase/supabase-js'

export interface RollEvent {
  type: 'skill' | 'attack' | 'damage' | 'spell'
  label: string        // "Perception", "Blunderbuss", "Fireball"
  total: number
  d20?: number
  detail?: string
  isCrit?: boolean
  isMiss?: boolean
  isPrivate?: boolean  // DM-only rolls
  characterName?: string
}

export function getActiveCampaignId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('activeCampaignId')
}

export function setActiveCampaignId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem('activeCampaignId', id)
  else localStorage.removeItem('activeCampaignId')
}

export async function broadcastRoll(
  supabase: SupabaseClient,
  campaignId: string,
  roll: RollEvent,
  characterName?: string
) {
  try {
    await supabase.from('campaign_events').insert({
      campaign_id: campaignId,
      type: 'dice_roll',
      character_name: characterName ?? roll.characterName ?? null,
      data: roll,
      is_private: roll.isPrivate ?? false,
    })
  } catch {
    // Silently fail — broadcast is best-effort
  }
}
