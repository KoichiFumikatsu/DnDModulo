// Future module — campaigns / session rooms
export interface Campaign {
  id: string
  name: string
  description: string | null
  dm_id: string
  invite_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignMember {
  id: string
  campaign_id: string
  user_id: string
  character_id: string | null
  joined_at: string
}
