import { fetchBackgrounds, fetchClasses, fetchFeats, fetchRaces, fetchRaceAbilities, fetchClassDetails } from '@/lib/5etools/data'
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
    fetchRaceAbilities(),
    fetchFeats(),
    fetchClassDetails(),
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
