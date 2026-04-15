import { fetchBackgrounds, fetchClasses, fetchFeats, fetchRaces } from '@/lib/5etools/data'
import { loadLocalClassDetails, loadLocalRaceAbilities } from '@/lib/5etools/local'
import NewCharacterClient from './NewCharacterClient'

export default async function NewCharacterPage() {
  const [
    races,
    backgrounds,
    classMap,
    raceAbilities,
    feats,
    classDetails,
  ] = await Promise.all([
    fetchRaces(),
    fetchBackgrounds(),
    fetchClasses(),
    loadLocalRaceAbilities(),
    fetchFeats(),
    loadLocalClassDetails(),
  ])

  return (
    <NewCharacterClient
      races={races}
      backgrounds={backgrounds}
      classMap={classMap}
      raceAbilities={raceAbilities}
      feats={feats}
      classDetails={classDetails}
    />
  )
}
