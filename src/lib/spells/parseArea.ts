export type AoeShape = 'circle' | 'square' | 'cone' | 'line'

export interface ParsedSpell {
  rangeCells: number
  aoe: { shape: AoeShape; sizeCells: number } | null
}

// Campaign convention: 1 cell = 2 m ≈ 6 ft (3 ft per metre).
const FT_PER_CELL = 6

function ftToCells(ft: number): number {
  return Math.max(1, Math.round(ft / FT_PER_CELL))
}

function matchAoe(text: string): ParsedSpell['aoe'] {
  const low = text.toLowerCase()
  let m = low.match(/(\d+)[\s-]*(?:foot|ft|feet)[\s-]*radius/)
  if (m) return { shape: 'circle', sizeCells: ftToCells(Number(m[1])) }
  m = low.match(/(\d+)[\s-]*(?:foot|ft|feet)[\s-]*sphere/)
  if (m) return { shape: 'circle', sizeCells: ftToCells(Number(m[1])) }
  m = low.match(/(\d+)[\s-]*(?:foot|ft|feet)[\s-]*cube/)
  if (m) return { shape: 'square', sizeCells: Math.max(1, Math.floor(ftToCells(Number(m[1])) / 2)) }
  m = low.match(/(\d+)[\s-]*(?:foot|ft|feet)[\s-]*cone/)
  if (m) return { shape: 'cone', sizeCells: ftToCells(Number(m[1])) }
  m = low.match(/(\d+)[\s-]*(?:foot|ft|feet)[\s-]*(?:long[\s-]*)?line/)
  if (m) return { shape: 'line', sizeCells: ftToCells(Number(m[1])) }
  return null
}

export function parseSpell(range: string | undefined | null, description: string | undefined | null): ParsedSpell {
  const out: ParsedSpell = { rangeCells: 0, aoe: null }
  if (range) {
    const low = range.toLowerCase()
    if (low.includes('self')) {
      out.rangeCells = 0
      const selfAoe = matchAoe(low)
      if (selfAoe) out.aoe = selfAoe
    } else if (low.includes('touch')) {
      out.rangeCells = 1
    } else {
      const m = low.match(/(\d+)\s*(?:feet|ft|foot)/)
      if (m) out.rangeCells = ftToCells(Number(m[1]))
    }
  }
  if (!out.aoe && description) out.aoe = matchAoe(description)
  return out
}

export type Direction4 = 'n' | 's' | 'e' | 'w'
export type Direction8 = Direction4 | 'ne' | 'nw' | 'se' | 'sw'

const CARDINAL4 = new Set<Direction8>(['n', 's', 'e', 'w'])

export function pickCardinal(dc: number, dr: number): Direction8 {
  if (dc === 0 && dr === 0) return 'e'
  // Screen coords: dr positive = south. Snap the angle to the nearest 45°.
  const angle = Math.atan2(dr, dc) * 180 / Math.PI
  const snapped = (Math.round(angle / 45) * 45 + 360) % 360
  switch (snapped) {
    case 0: return 'e'
    case 45: return 'se'
    case 90: return 's'
    case 135: return 'sw'
    case 180: return 'w'
    case 225: return 'nw'
    case 270: return 'n'
    case 315: return 'ne'
    default: return 'e'
  }
}

function directionVector(d: Direction8): [number, number] {
  switch (d) {
    case 'e': return [1, 0]
    case 'w': return [-1, 0]
    case 's': return [0, 1]
    case 'n': return [0, -1]
    case 'ne': return [1, -1]
    case 'nw': return [-1, -1]
    case 'se': return [1, 1]
    case 'sw': return [-1, 1]
  }
}

export interface ShapeParams {
  shape: AoeShape
  sizeCells: number
  originCol: number
  originRow: number
  direction?: Direction8
}

// Return the set of (col,row) keys covered by the given shape.
export function shapeCells(p: ShapeParams): Set<string> {
  const out = new Set<string>()
  const { shape, sizeCells, originCol: oc, originRow: or } = p
  if (shape === 'circle') {
    for (let dc = -sizeCells; dc <= sizeCells; dc++) {
      for (let dr = -sizeCells; dr <= sizeCells; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > sizeCells) continue
        out.add(`${oc + dc},${or + dr}`)
      }
    }
  } else if (shape === 'square') {
    for (let dc = -sizeCells; dc <= sizeCells; dc++) {
      for (let dr = -sizeCells; dr <= sizeCells; dr++) {
        out.add(`${oc + dc},${or + dr}`)
      }
    }
  } else if (shape === 'cone') {
    const dir = p.direction ?? 'e'
    if (CARDINAL4.has(dir)) {
      // Straight cone widening by ±d at depth d.
      for (let d = 1; d <= sizeCells; d++) {
        for (let k = -d; k <= d; k++) {
          let c = oc, r = or
          if (dir === 'e') { c = oc + d; r = or + k }
          else if (dir === 'w') { c = oc - d; r = or + k }
          else if (dir === 's') { c = oc + k; r = or + d }
          else if (dir === 'n') { c = oc + k; r = or - d }
          out.add(`${c},${r}`)
        }
      }
    } else {
      // Diagonal cone: quadrant extending outward sizeCells × sizeCells.
      const [cStep, rStep] = directionVector(dir)
      for (let dc = 1; dc <= sizeCells; dc++) {
        for (let dr = 1; dr <= sizeCells; dr++) {
          out.add(`${oc + dc * cStep},${or + dr * rStep}`)
        }
      }
    }
  } else if (shape === 'line') {
    const dir = p.direction ?? 'e'
    const [cStep, rStep] = directionVector(dir)
    for (let d = 1; d <= sizeCells; d++) {
      out.add(`${oc + cStep * d},${or + rStep * d}`)
    }
  }
  return out
}

// Weapon range parser — prefer meters (user-entered), fall back to feet.
export function parseWeaponRange(range: string | null | undefined): number {
  if (!range) return 1
  const low = range.toLowerCase()
  if (/melee|touch|toque|cuerpo/.test(low)) return 1
  let m = low.match(/(\d+(?:\.\d+)?)\s*m(?!in|\w)/)
  if (m) return Math.max(1, Math.round(Number(m[1]) / 2))
  m = low.match(/(\d+)\s*(?:feet|ft|foot|pies)/)
  if (m) return Math.max(1, Math.round(Number(m[1]) / 6))
  // Bare number → meters (user convention).
  m = low.match(/^(\d+)/)
  if (m) return Math.max(1, Math.round(Number(m[1]) / 2))
  return 1
}
