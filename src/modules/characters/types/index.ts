export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'
export type CustomStatType = 'counter' | 'text' | 'checkbox' | 'tracker'
export type ResetOn = 'short_rest' | 'long_rest' | 'manual'

export interface CharacterClass {
  id: string
  character_id: string
  class_name: string
  subclass_name: string | null
  level: number
  is_primary: boolean
  spellcasting_ability: Ability | null
  spell_save_dc: number | null
  spell_attack_mod: number | null
  is_homebrew: boolean
  homebrew_url: string | null
}

export interface SpellSlot {
  id: string
  character_id: string
  class_id: string
  spell_level: number
  slots_total: number
  slots_used: number
}

export interface CharacterSpell {
  id: string
  character_id: string
  class_id: string
  spell_level: number
  name: string
  custom_notes: string | null
  is_prepared: boolean
  is_always_prepared: boolean
  range: string | null
  damage: string | null
  components: string | null
  source_type?: 'spell' | 'scroll' | 'charges'
  charges_max?: number | null
  charges_used?: number
}

export interface CharacterWeapon {
  id: string
  character_id: string
  name: string
  atk_bonus: string | null
  damage: string | null
  damage_type: string | null
  range: string | null
  weight: string | null
  notes: string | null
}

export interface CharacterEquipment {
  id: string
  character_id: string
  name: string
  quantity: number
  weight: string | null
  notes: string | null
}

export interface CharacterFeature {
  id: string
  character_id: string
  name: string
  description: string
  source: string | null
}

export interface CharacterProficiency {
  id: string
  character_id: string
  type: 'skill' | 'weapon' | 'armor' | 'tool' | 'language' | 'saving_throw'
  name: string
  proficiency_level: ProficiencyLevel
  has_advantage?: boolean
}

export interface ClassResource {
  id: string
  character_id: string
  name: string
  current: number
  maximum: number
  reset_on: ResetOn
}

export interface CustomStat {
  id: string
  character_id: string
  name: string
  current_value: number | null
  max_value: number | null
  text_value: string | null
  bool_value: boolean | null
  stat_type: CustomStatType
  sort_order: number
  notes: string | null
}

export interface Character {
  id: string
  user_id: string
  name: string
  image_url: string | null

  // Basic info
  race: string | null
  subrace: string | null
  background: string | null
  alignment: string | null
  experience_points: number
  speed: number
  inspiration: boolean

  // Ability scores
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number

  // HP
  hp_max: number
  hp_current: number
  hp_temp: number

  // Combat
  ac: number
  initiative_bonus: number
  proficiency_bonus: number
  hit_dice_total: string | null
  hit_dice_current: string | null

  // Death saves
  death_saves_successes: number
  death_saves_failures: number

  // Currency
  pp: number
  gp: number
  sp: number
  cp: number

  // Physical appearance
  age: string | null
  height: string | null
  weight: string | null
  eyes: string | null
  skin: string | null
  hair: string | null

  // Roleplay
  personality: string | null
  ideals: string | null
  bonds: string | null
  flaws: string | null
  backstory: string | null
  additional_equipment: string | null
  notes: string | null

  created_at: string
  updated_at: string

  // Relations (joined)
  classes?: CharacterClass[]
  spell_slots?: SpellSlot[]
  spells?: CharacterSpell[]
  weapons?: CharacterWeapon[]
  equipment?: CharacterEquipment[]
  features?: CharacterFeature[]
  proficiencies?: CharacterProficiency[]
  class_resources?: ClassResource[]
  custom_stats?: CustomStat[]
}
