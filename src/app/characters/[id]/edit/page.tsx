import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAllSpells,
  fetchBackgrounds,
  fetchClasses,
  fetchEquipmentItems,
  fetchFeats,
  fetchRaces,
} from '@/lib/5etools/data'
import {
  loadLocalBackgroundSkills,
  loadLocalClassDetails,
  loadLocalRaceSkills,
} from '@/lib/5etools/local'
import EditCharacterClient from './EditCharacterClient'

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
    { data: spells },
    { data: weapons },
    { data: equipment },
    { data: features },
    { data: proficiencies },
    { data: classResources },
    { data: customStats },
    raceOptions,
    backgroundOptions,
    classMap,
    spellList,
    equipmentItems,
    allFeats,
    classDetails,
    backgroundSkills,
    raceSkills,
  ] = await Promise.all([
    supabase.from('character_classes').select('*').eq('character_id', id),
    supabase.from('character_spells').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_weapons').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_equipment').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_features').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_proficiencies').select('*').eq('character_id', id),
    supabase.from('character_class_resources').select('*').eq('character_id', id).order('sort_order'),
    supabase.from('character_custom_stats').select('*').eq('character_id', id).order('sort_order'),
    fetchRaces(),
    fetchBackgrounds(),
    fetchClasses(),
    fetchAllSpells(),
    fetchEquipmentItems(),
    fetchFeats(),
    loadLocalClassDetails(),
    loadLocalBackgroundSkills(),
    loadLocalRaceSkills(),
  ])

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
        spells={spells ?? []}
        weapons={weapons ?? []}
        equipment={equipment ?? []}
        features={features ?? []}
        proficiencies={proficiencies ?? []}
        classResources={classResources ?? []}
        customStats={customStats ?? []}
        raceOptions={raceOptions}
        backgroundOptions={backgroundOptions}
        classMap={classMap}
        spellList={spellList}
        equipmentItems={equipmentItems}
        allFeats={allFeats}
        classDetails={classDetails}
        backgroundSkills={backgroundSkills}
        raceSkills={raceSkills}
      />
    </div>
  )
}
