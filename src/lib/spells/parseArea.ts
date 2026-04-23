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

export function pickCardinal(dc: number, dr: number): Direction4 {
  if (dc === 0 && dr === 0) return 'e'
  if (Math.abs(dc) >= Math.abs(dr)) return dc >= 0 ? 'e' : 'w'
  return dr >= 0 ? 's' : 'n'
}

export interface ShapeParams {
  shape: AoeShape
  sizeCells: number
  originCol: number
  originRow: number
  direction?: Direction4
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
  } else if (shape === 'line') {
    const dir = p.direction ?? 'e'
    for (let d = 1; d <= sizeCells; d++) {
      let c = oc, r = or
      if (dir === 'e') c = oc + d
      else if (dir === 'w') c = oc - d
      else if (dir === 's') r = or + d
      else if (dir === 'n') r = or - d
      out.add(`${c},${r}`)
    }
  }
  return out
}
