import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playWord,
  playMeaning,
  playExample,
  playTranslation,
  stopAudio,
} from './audio.js'

// Build the autoplay sequence for a single card based on user settings.
//   order  - 'zh-first'  → word/meaning, example/translation
//          - 'ko-first'  → meaning/word, translation/example
//   repeat - 1 or 2: how many times each pair is played
function buildSequence({ order = 'zh-first', repeat = 2 } = {}) {
  const wordPair = order === 'ko-first'
    ? [playMeaning, playWord]
    : [playWord, playMeaning]
  const examplePair = order === 'ko-first'
    ? [playTranslation, playExample]
    : [playExample, playTranslation]
  const reps = repeat === 1 ? 1 : 2
  const seq = []
  for (let i = 0; i < reps; i++) seq.push(...wordPair)
  for (let i = 0; i < reps; i++) seq.push(...examplePair)
  return seq
}

// Pause between sub-steps inside one card, and a slightly longer one when
// advancing to the next card (also gives React time to commit the new
// session index before the next audio starts). Speed scales these so faster
// playback also tightens the gaps proportionally.
const STEP_PAUSE_MS = 250
const CARD_PAUSE_MS = 400

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Autoplay hook.
 *
 * @param queue    array of word objects
 * @param getIndex function returning the *current* session index on each call.
 *                 We read this as a live value (via ref) because the session
 *                 index changes while the sequence runs — reveals, user
 *                 interactions, etc. — and we always want the latest.
 * @param onStep   callback to advance the session by one card (dispatch 'step')
 * @param onReveal callback invoked before each sub-step so the card content
 *                 is visible as the audio plays (dispatch 'reveal' twice)
 */
export function useAutoplay({ queue, getIndex, onStep, onReveal, getSettings }) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Mutable flag so the async loop can be canceled without re-renders.
  const activeRef = useRef(false)
  // Latest callbacks captured in refs — avoids stale closures.
  const getIndexRef = useRef(getIndex)
  const onStepRef = useRef(onStep)
  const onRevealRef = useRef(onReveal)
  const getSettingsRef = useRef(getSettings)
  useEffect(() => { getIndexRef.current = getIndex }, [getIndex])
  useEffect(() => { onStepRef.current = onStep }, [onStep])
  useEffect(() => { onRevealRef.current = onReveal }, [onReveal])
  useEffect(() => { getSettingsRef.current = getSettings }, [getSettings])

  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    stopAudio()
    setIsPlaying(false)
  }, [])

  const start = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true
    setIsPlaying(true)

    try {
      // Seed idx from the session's current card, then own it locally for
      // the rest of the loop. Reading from getIndexRef inside the loop was
      // racy: a freshly dispatched 'step' hasn't committed to React state
      // yet on the next iteration, so the ref returns the old index. That
      // was causing the current word to play twice and then fall one step
      // behind the visible card.
      let idx = getIndexRef.current()

      while (activeRef.current && idx >= 0 && idx < queue.length) {
        const word = queue[idx]
        if (!word) break

        // Read fresh settings on each card so changes mid-play take effect.
        const settings = getSettingsRef.current?.() ?? {}
        const speed = settings.speed ?? 1
        const sequence = buildSequence(settings)
        const stepPause = STEP_PAUSE_MS / speed
        const cardPause = CARD_PAUSE_MS / speed

        onRevealRef.current?.()

        for (let step = 0; step < sequence.length; step++) {
          if (!activeRef.current) return
          await sequence[step](word, { speed })
          if (!activeRef.current) return
          // Pause between sub-steps only; no pause after the last step
          // since we pause again when advancing to the next card.
          if (step < sequence.length - 1) await delay(stepPause)
        }

        // Advance past every card — including the last. The reducer's
        // autoStep marks unanswered cards as 'again' and walks index past
        // queue.length when everything is answered, which trips the
        // session's "done" branch.
        idx++
        onStepRef.current?.()
        if (idx >= queue.length) break
        // Pause between cards, and let React commit the dispatched step
        // so the card UI is already on the new word when audio resumes.
        await delay(cardPause)
      }
    } finally {
      activeRef.current = false
      setIsPlaying(false)
    }
  }, [queue])

  // Clean up if the component unmounts or the queue changes mid-play.
  useEffect(() => {
    return () => {
      activeRef.current = false
      stopAudio()
    }
  }, [queue])

  return { isPlaying, start, stop }
}
