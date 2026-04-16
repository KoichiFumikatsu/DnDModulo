import fs from 'fs'
import path from 'path'

export interface FiveToolsRuntimeInfo {
  configuredCandidates: string[]
  candidates: string[]
  dataDir: string | null
}

// Canonical runtime source for this repo:
// keep the raw extracted dataset under src/lib/5etools-v2.26.1/.
// The rest of the candidates are only portability fallbacks.
const DEFAULT_CANDIDATES = [
  'src/lib/5etools-v2.26.1/data',
  'src/lib/5etools-v2.26.1',
  '5etools-v2.26.1/data',
  '5etools-v2.26.1',
  'data/5etools',
  'data/5etools/data',
  'vendor/5etools',
  'vendor/5etools/data',
  'public/5etools-data',
  'public/5etools-data/data',
] as const

function uniq(items: string[]) {
  return [...new Set(items)]
}

function resolveCandidate(candidate: string) {
  const trimmed = candidate.trim()
  if (!trimmed) return null
  return path.resolve(process.cwd(), trimmed)
}

function asDataDir(candidate: string) {
  const normalized = path.resolve(candidate)
  const dataDir = path.basename(normalized).toLowerCase() === 'data'
    ? normalized
    : path.join(normalized, 'data')

  try {
    const stat = fs.statSync(dataDir)
    if (!stat.isDirectory()) return null
  } catch {
    return null
  }

  // Basic sanity check so we do not accidentally point at an unrelated "data" folder.
  const requiredEntries = [
    path.join(dataDir, 'races.json'),
    path.join(dataDir, 'books.json'),
    path.join(dataDir, 'class'),
  ]

  const hasRequiredEntries = requiredEntries.every(entry => fs.existsSync(entry))
  return hasRequiredEntries ? dataDir : null
}

export function getFiveToolsRuntimeInfo(): FiveToolsRuntimeInfo {
  const configuredCandidates = uniq([
    process.env.FIVETOOLS_DATA_DIR ?? '',
    process.env.FIVETOOLS_ROOT ?? '',
    ...DEFAULT_CANDIDATES,
  ].filter(Boolean))

  const candidates = uniq(
    configuredCandidates
      .map(resolveCandidate)
      .filter((value): value is string => Boolean(value))
  )

  for (const candidate of candidates) {
    const dataDir = asDataDir(candidate)
    if (dataDir) {
      return { configuredCandidates, candidates, dataDir }
    }
  }

  return { configuredCandidates, candidates, dataDir: null }
}

export function resolveFiveToolsPath(segments: string[]) {
  const runtime = getFiveToolsRuntimeInfo()
  if (!runtime.dataDir) {
    return {
      ...runtime,
      filePath: null,
      error: '5etools data directory not found',
    }
  }

  const filePath = path.resolve(runtime.dataDir, ...segments)
  const relative = path.relative(runtime.dataDir, filePath)
  const isInsideDataDir =
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)

  if (!isInsideDataDir) {
    return {
      ...runtime,
      filePath: null,
      error: 'Forbidden',
    }
  }

  return {
    ...runtime,
    filePath,
    error: null,
  }
}
