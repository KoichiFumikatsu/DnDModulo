// D&D 5e 2014 — XP thresholds por nivel
// Index = nivel (1-based), valor = XP mínimo para ese nivel
export const XP_THRESHOLDS = [
  0,       // nivel 1
  300,     // nivel 2
  900,     // nivel 3
  1_800,   // nivel 4
  3_800,   // nivel 5
  7_500,   // nivel 6
  9_000,   // nivel 7
  11_000,  // nivel 8
  14_000,  // nivel 9
  16_000,  // nivel 10
  21_000,  // nivel 11
  27_000,  // nivel 12
  34_000,  // nivel 13
  41_000,  // nivel 14
  48_000,  // nivel 15
  57_000,  // nivel 16
  64_000,  // nivel 17
  75_000,  // nivel 18
  85_000,  // nivel 19
  100_000, // nivel 20
]

export function getLevelFromXP(xp: number): number {
  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function getNextLevelXP(xp: number): number | null {
  const level = getLevelFromXP(xp)
  if (level >= 20) return null
  return XP_THRESHOLDS[level] // índice = próximo nivel (0-based array pero 1-based level)
}

export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

/** Retorna { current, needed, pct } para la barra de progreso */
export function getXPProgress(xp: number): {
  current: number
  nextLevelXP: number | null
  currentLevelXP: number
  progressXP: number
  neededXP: number
  pct: number
  level: number
} {
  const level = getLevelFromXP(xp)
  const currentLevelXP = XP_THRESHOLDS[level - 1]
  const nextLevelXP = level < 20 ? XP_THRESHOLDS[level] : null

  if (!nextLevelXP) {
    return { current: xp, nextLevelXP: null, currentLevelXP, progressXP: xp, neededXP: 0, pct: 100, level }
  }

  const progressXP = xp - currentLevelXP
  const neededXP = nextLevelXP - currentLevelXP
  const pct = Math.round((progressXP / neededXP) * 100)

  return { current: xp, nextLevelXP, currentLevelXP, progressXP, neededXP, pct, level }
}
