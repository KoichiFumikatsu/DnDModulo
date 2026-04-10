export type UserRole = 'player' | 'dm' | 'admin'

export interface UserProfile {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}
