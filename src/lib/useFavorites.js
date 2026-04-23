import { useCallback, useEffect, useState } from 'react'

// Global favorites: a Set<word.id> persisted to localStorage. Lives at the
// App root so every screen (Words, Chapter, Learn) reads/writes the same
// source of truth — no prop-drill split states getting out of sync.

const KEY = 'hsk.favorites'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([...favorites]))
  }, [favorites])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { favorites, toggleFavorite }
}
