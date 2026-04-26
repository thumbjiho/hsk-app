// Loads a level's word list from public/data/hsk-{level}.json and caches it.
// Translations are already merged into these files at build time by
// data/build-json.py, so loadLevel is now a thin fetch + cache.

const cache = new Map()
const topicsCache = new Map()

export async function loadLevel(level) {
  if (cache.has(level)) return cache.get(level)

  const res = await fetch(`/data/hsk-${level}.json`)
  if (!res.ok) throw new Error(`Failed to load HSK ${level}: ${res.status}`)

  const words = await res.json()
  cache.set(level, words)
  return words
}

// Loads topic groupings for a level. Resolves to null when the level has no
// curated topics file (e.g. HSK 2-5 placeholders) so callers can branch
// gracefully without a try/catch.
export async function loadTopics(level) {
  if (topicsCache.has(level)) return topicsCache.get(level)

  const res = await fetch(`/data/hsk-${level}-topics.json`)
  if (!res.ok) {
    topicsCache.set(level, null)
    return null
  }
  const data = await res.json()
  topicsCache.set(level, data)
  return data
}
