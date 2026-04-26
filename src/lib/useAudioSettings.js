import { useCallback, useEffect, useState } from 'react'

// Persisted user preferences for autoplay listening behavior. Lives in
// localStorage so settings carry across sessions and screens.
//
//   order  — 'zh-first' | 'ko-first'   what plays first in each pair
//   repeat — 1 | 2                     number of times each pair plays per card
//   speed  — number (0.7 .. 1.25)      playback rate multiplier

const KEY = 'hsk-audio-settings'

export const DEFAULT_AUDIO_SETTINGS = {
  order: 'zh-first',
  repeat: 2,
  speed: 1,
}

function load() {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_AUDIO_SETTINGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_AUDIO_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_AUDIO_SETTINGS
  }
}

export function useAudioSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings))
    } catch { /* quota / private mode: silently ignore */ }
  }, [settings])

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return [settings, update]
}
