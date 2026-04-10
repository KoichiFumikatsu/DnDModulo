// D&D 5e — XP thresholds (fuente: 5etools / PHB)
// XP mínimo para alcanzar cada nivel
export const XP_THRESHOLDS = [
  0,         // nivel 1
  300,       // nivel 2
  900,       // nivel 3
  2_700,     // nivel 4
  6_500,     // nivel 5
  14_000,    // nivel 6
  23_000,    // nivel 7
  34_000,    // nivel 8
  48_000,    // nivel 9
  64_000,    // nivel 10
  85_000,    // nivel 11
  100_000,   // nivel 12
  120_000,   // nivel 13
  140_000,   // nivel 14
  165_000,   // nivel 15
  195_000,   // nivel 16
  225_000,   // nivel 17
  265_000,   // nivel 18
  305_000,   // nivel 19
  355_000,   // nivel 20
]

// Bonus de proficiencia por nivel total
export const PROFICIENCY_BONUS: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6,
}

export function getLevelFromXP(xp: number): number {
  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function getProficiencyBonus(level: number): number {
  return PROFICIENCY_BONUS[level] ?? 2
}

export function getXPProgress(xp: number): {
  current: number
  nextLevelXP: number | null
  currentLevelXP: number
  progressXP: number
  neededXP: number
  pct: number
  level: number
  proficiencyBonus: number
} {
  const level = getLevelFromXP(xp)
  const currentLevelXP = XP_THRESHOLDS[level - 1]
  const nextLevelXP = level < 20 ? XP_THRESHOLDS[level] : null
  const proficiencyBonus = getProficiencyBonus(level)

  if (!nextLevelXP) {
    return { current: xp, nextLevelXP: null, currentLevelXP, progressXP: xp, neededXP: 0, pct: 100, level, proficiencyBonus }
  }

  const progressXP = xp - currentLevelXP
  const neededXP = nextLevelXP - currentLevelXP
  const pct = Math.round((progressXP / neededXP) * 100)

  return { current: xp, nextLevelXP, currentLevelXP, progressXP, neededXP, pct, level, proficiencyBonus }
}
