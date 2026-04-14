import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import fs from 'fs'
import nodePath from 'path'
import { createClient } from '@/lib/supabase/server'
import EditCharacterClient from './EditCharacterClient'
import type { EquipmentItem, SpellEntry } from '@/lib/5etools/data'

/* ── Server-side 5etools helpers ── */

const DATA_ROOT = nodePath.join(process.cwd(), 'src/lib/5etools-v2.26.1/data')

function loadItems(): EquipmentItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(nodePath.join(DATA_ROOT, 'items-base.json'), 'utf8'))
    const items: EquipmentItem[] = []
    for (const item of (raw.baseitem ?? raw.item ?? []) as Record<string, unknown>[]) {
      if (!item.name) continue
      if (item.source !== 'PHB' && item.source !== 'XPHB') continue
      items.push({
        name: item.name as string,
        type: (item.type as string) ?? 'Other',
        weight: item.weight as number | undefined,
        value: typeof item.value === 'number' ? item.value / 100 : undefined,
        source: item.source as string,
        ac: item.ac as number | undefined,
        damage: item.dmg1 as string | undefined,
        damageType: item.dmgType as string | undefined,
        range: item.range != null ? String(item.range) : undefined,
        properties: Array.isArray(item.property) ? item.property as string[] : undefined,
        weaponCategory: item.weaponCategory as string | undefined,
        rarity: item.rarity as string | undefined,
      })
    }
    return items.sort((a, b) => (a.name as string).localeCompare(b.name as string))
  } catch {
    return []
  }
}

const SCHOOL_MAP: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  I: 'Illusion', N: 'Necromancy', T: 'Transmutation', V: 'Evocation',
}

function flattenEntries(entries: unknown[]): string {
  const parts: string[] = []
  for (const entry of entries) {
    if (typeof entry === 'string') {
      parts.push(entry)
    } else if (typeof entry === 'object' && entry !== null) {
      const obj = entry as Record<string, unknown>
      if (Array.isArray(obj.entries)) parts.push(flattenEntries(obj.entries))
      if (typeof obj.text === 'string') parts.push(obj.text)
      if (Array.isArray(obj.items)) {
        for (const it of obj.items) {
          if (typeof it === 'string') parts.push(it)
          else if (typeof it === 'object' && it !== null) {
            const o = it as Record<string, unknown>
            if (typeof o.name === 'string' && typeof o.entry === 'string') parts.push(`${o.name}: ${o.entry}`)
            else if (Array.isArray(o.entries)) parts.push(flattenEntries(o.entries))
          }
        }
      }
    }
  }
  return parts.join(' ')
}

function loadSpells(): SpellEntry[] {
  try {
    // Build class lookup
    const lookup = JSON.parse(
      fs.readFileSync(nodePath.join(DATA_ROOT, 'generated/gendata-spell-source-lookup.json'), 'utf8')
    ) as Record<string, Record<string, { class?: Record<string, Record<string, boolean>> }>>

    const classMap: Record<string, Set<string>> = {}
    for (const sourceSpells of Object.values(lookup)) {
      for (const [spellName, spellData] of Object.entries(sourceSpells)) {
        const key = spellName.toLowerCase()
        if (!classMap[key]) classMap[key] = new Set()
        if (spellData.class) {
          for (const classSource of Object.values(spellData.class)) {
            for (const className of Object.keys(classSource)) classMap[key].add(className)
          }
        }
      }
    }

    const spells: SpellEntry[] = []
    const seen = new Set<string>()

    for (const file of ['spells/spells-phb.json', 'spells/spells-xphb.json']) {
      const raw = JSON.parse(fs.readFileSync(nodePath.join(DATA_ROOT, file), 'utf8'))
      for (const sp of (raw.spell ?? []) as Record<string, unknown>[]) {
        if (!sp.name) continue
        const name = sp.name as string
        if (seen.has(name)) continue
        seen.add(name)

        type TimeEntry = { number?: number; unit?: string }
        type DurEntry = { type?: string; duration?: { amount?: number; type?: string }; concentration?: boolean }
        type RangeEntry = { type?: string; distance?: { type?: string; amount?: number } }

        const range = sp.range as RangeEntry | undefined
        const classSet = classMap[name.toLowerCase()]

        spells.push({
          name,
          level: (sp.level as number) ?? 0,
          school: SCHOOL_MAP[sp.school as string] ?? (sp.school as string) ?? 'Unknown',
          source: (sp.source as string) ?? 'PHB',
          time: Array.isArray(sp.time)
            ? (sp.time as TimeEntry[]).map(t => `${t.number ?? ''} ${t.unit ?? ''}`).join(', ').trim()
            : undefined,
          range: range?.type === 'point'
            ? (range.distance?.type === 'self' ? 'Self' : `${range.distance?.amount ?? ''} ${range.distance?.type ?? ''}`.trim())
            : range?.type ?? undefined,
          components: sp.components
            ? [
                (sp.components as { v?: boolean }).v ? 'V' : '',
                (sp.components as { s?: boolean }).s ? 'S' : '',
                (sp.components as { m?: unknown }).m ? 'M' : '',
              ].filter(Boolean).join(', ')
            : undefined,
          duration: Array.isArray(sp.duration)
            ? (sp.duration as DurEntry[]).map(d =>
                d.type === 'instant' ? 'Instantaneous'
                : d.type === 'permanent' ? 'Permanent'
                : d.duration
                  ? `${d.concentration ? 'Concentration, ' : ''}${d.duration.amount ?? ''} ${d.duration.type ?? ''}`.trim()
                  : d.type ?? ''
              ).join(', ')
            : undefined,
          description: Array.isArray(sp.entries) ? flattenEntries(sp.entries as unknown[]) : undefined,
          ritual: (sp.meta as { ritual?: boolean })?.ritual ?? false,
          concentration: Array.isArray(sp.duration)
            ? (sp.duration as DurEntry[]).some(d => d.concentration === true)
            : false,
          classes: classSet ? [...classSet].sort() : [],
        })
      }
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    return spells
  } catch {
    return []
  }
}

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: character } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!character) notFound()

  const [
    { data: classes },
    { data: spellSlots },
    { data: spells },
    { data: weapons },
    { data: equipment },
    { data: features },
    { data: proficiencies },
    { data: classResources },
    { data: customStats },
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_equipment').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
    supabase.from('character_class_resources').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_custom_stats').select('*').eq('character_id', id).order('sort_order'),
  ])

  // Load 5etools catalog data server-side (avoids client fetch issues)
  const catalogItems = loadItems()
  const catalogSpells = loadSpells()

  return (
    <div className="cs-page min-h-screen">
      <div className="border-b px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--book-nav-bg, #2a1f14)', borderColor: 'rgba(201,173,106,0.3)' }}>
        <div className="flex items-center gap-4">
          <Link href={`/characters/${id}`} className="text-sm opacity-60 hover:opacity-100"
            style={{ color: 'var(--cs-text-muted)' }}>← Hoja de {character.name}</Link>
          <h1 className="text-xl font-bold" style={{ color: 'var(--cs-gold)' }}>
            Editar personaje
          </h1>
        </div>
      </div>

      <EditCharacterClient
        character={character}
        classes={classes ?? []}
        spellSlots={spellSlots ?? []}
        spells={spells ?? []}
        weapons={weapons ?? []}
        equipment={equipment ?? []}
        features={features ?? []}
        proficiencies={proficiencies ?? []}
        classResources={classResources ?? []}
        customStats={customStats ?? []}
        catalogItems={catalogItems}
        catalogSpells={catalogSpells}
      />
    </div>
  )
}
