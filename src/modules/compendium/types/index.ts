// Future module — 5etools compendium reference
export interface Spell {
  name: string
  source: string
  level: number
  school: string
  time: { number: number; unit: string }[]
  range: { type: string; distance?: { type: string; amount?: number } }
  components: { v?: boolean; s?: boolean; m?: string | { text: string } }
  duration: { type: string; duration?: { type: string; amount?: number } }[]
  classes: { fromClassList?: { name: string; source: string }[] }
  entries: unknown[]
  savingThrow?: string[]
  damageInflict?: string[]
}

export interface ClassData {
  name: string
  source: string
  hd: { number: number; faces: number }
  proficiency: string[]
  spellcastingAbility?: string
  subclasses: { name: string; shortName: string }[]
}
