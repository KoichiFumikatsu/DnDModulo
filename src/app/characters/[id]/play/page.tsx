import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchEquipmentItems } from '@/lib/5etools/data'
import QuickStats from '@/modules/characters/components/QuickStats'
import DeathSavesClient from './DeathSavesClient'
import EquipmentTracker from './EquipmentTracker'

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
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
    { data: classResources },
    { data: customStats },
    { data: weapons },
    { data: equipment },
    equipmentCatalog,
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spell_slots').select('*').eq('character_id', id),
    supabase.from('character_class_resources').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_custom_stats').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_equipment').select('*').eq('character_id', id).order('sort_order'),
    fetchEquipmentItems(),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Link href={`/characters/${id}`}
            className="text-sm hover:opacity-100"
            style={{ color: 'var(--on-dark-muted)' }}>
            ← Hoja completa
          </Link>
          <span className="font-bold" style={{ color: 'var(--accent-gold)' }}>
            {character.name} — Modo Mesa ⚡
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: 'var(--on-dark-muted)' }}>
            CA {character.ac} · Perc. Pasiva {10 + Math.floor((character.wis - 10) / 2) + character.proficiency_bonus}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <QuickStats
          character={character}
          classResources={classResources ?? []}
          spellSlots={spellSlots ?? []}
          classes={classes ?? []}
          customStats={customStats ?? []}
        />

        {/* Weapons summary */}
        {weapons && weapons.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--on-dark-muted)' }}>Ataques</h3>
            <div className="rounded-xl border divide-y"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              {weapons.map(w => (
                <div key={w.id} className="flex items-center gap-4 px-4 py-3 text-sm"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="font-bold" style={{ color: 'var(--accent-gold)' }}>{w.atk_bonus}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{w.damage}</span>
                  {w.range && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.range}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Equipment tracker */}
        {equipment && equipment.length > 0 && (
          <EquipmentTracker
            initialEquipment={equipment}
            catalog={equipmentCatalog.map(e => ({ name: e.name, contents: e.contents }))}
          />
        )}

        {/* Death Saves */}
        <DeathSavesClient
          characterId={character.id}
          successes={character.death_saves_successes}
          failures={character.death_saves_failures}
        />
      </div>
    </div>
  )
}

