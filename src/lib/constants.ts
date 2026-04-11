/** Standard D&D 5e skills — shared between view and edit pages */
export const SKILLS = [
  { name: 'Acrobatics', ability: 'dex', key: 'Acrobatics' },
  { name: 'Animal Handling', ability: 'wis', key: 'Animal Handling' },
  { name: 'Arcana', ability: 'int', key: 'Arcana' },
  { name: 'Athletics', ability: 'str', key: 'Athletics' },
  { name: 'Deception', ability: 'cha', key: 'Deception' },
  { name: 'History', ability: 'int', key: 'History' },
  { name: 'Insight', ability: 'wis', key: 'Insight' },
  { name: 'Intimidation', ability: 'cha', key: 'Intimidation' },
  { name: 'Investigation', ability: 'int', key: 'Investigation' },
  { name: 'Medicine', ability: 'wis', key: 'Medicine' },
  { name: 'Nature', ability: 'int', key: 'Nature' },
  { name: 'Perception', ability: 'wis', key: 'Perception' },
  { name: 'Performance', ability: 'cha', key: 'Performance' },
  { name: 'Persuasion', ability: 'cha', key: 'Persuasion' },
  { name: 'Religion', ability: 'int', key: 'Religion' },
  { name: 'Sleight of Hand', ability: 'dex', key: 'Sleight of Hand' },
  { name: 'Stealth', ability: 'dex', key: 'Stealth' },
  { name: 'Survival', ability: 'wis', key: 'Survival' },
] as const

export const ABILITY_NAMES: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}
