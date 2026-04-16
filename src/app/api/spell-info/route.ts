import { NextRequest, NextResponse } from 'next/server'
import SPELLS from '@/lib/5etools-processed/spells.json'

type SpellRecord = {
  name: string
  level: number
  school: string
  time?: string
  range?: string
  components?: string
  duration?: string
  description?: string
  damage?: string
  healingFormula?: string
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'no name' }, { status: 400 })

  const spell = (SPELLS as SpellRecord[]).find(
    s => s.name.toLowerCase() === name.toLowerCase()
  )
  if (!spell) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    name: spell.name,
    level: spell.level,
    school: spell.school,
    time: spell.time,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    description: spell.description ?? null,
    damage: spell.damage ?? null,
    healingFormula: spell.healingFormula ?? null,
  })
}
