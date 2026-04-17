import { NextRequest, NextResponse } from 'next/server'
import SPELLS from '@/lib/5etools-processed/spells.json'
import ITEMS from '@/lib/5etools-processed/items.json'
import RACES from '@/lib/5etools-processed/races.json'
import BACKGROUNDS from '@/lib/5etools-processed/backgrounds.json'
import FEATS from '@/lib/5etools-processed/feats.json'
import CLASSES_MAP from '@/lib/5etools-processed/classes.json'
import MONSTERS from '@/lib/5etools-processed/monsters.json'
import CONDITIONS from '@/lib/5etools-processed/conditions.json'
import RULES from '@/lib/5etools-processed/rules.json'

type Item = Record<string, unknown>

// Convert classes map → array for browsing
const CLASSES_ARR: Item[] = Object.entries(CLASSES_MAP as Record<string, unknown>).map(([name, data]) => ({
  name,
  ...((data as Record<string, unknown>) ?? {}),
}))

const DATA: Record<string, Item[]> = {
  spells: SPELLS as Item[],
  items: (ITEMS as Item[]).filter(i => i.name),
  races: (RACES as unknown as Item[]).filter(i => i.name),
  backgrounds: (BACKGROUNDS as unknown as Item[]).filter(i => i.name),
  feats: (FEATS as Item[]).filter(i => i.name),
  classes: CLASSES_ARR,
  monsters: MONSTERS as Item[],
  conditions: CONDITIONS as Item[],
  rules: RULES as Item[],
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category || !DATA[category]) {
    return NextResponse.json({ error: 'Unknown category', available: Object.keys(DATA) }, { status: 400 })
  }
  return NextResponse.json(DATA[category], {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
