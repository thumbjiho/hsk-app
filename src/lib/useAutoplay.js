import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playWord,
  playMeaning,
  playExample,
  playTranslation,
  stopAudio,
} from './audio.js'

// The autoplay sequence for a single card:
//   1. word (zh)
//   2. meaning (ko)
//   3. word (zh)
//   4. meaning (ko)
//   5. example (zh)
//   6. translation (ko)
//   7. example (zh)
//   8. translation (ko)
// then advance to the next card and repeat. Stops at the last card.
const SEQUENCE = [
  playWord, playMeaning, playWord, playMeaning,
  playExample, playTranslation, playExample, playTranslation,
]

// Pause between sub-steps inside one card, and a slightly longer one when
// advancing to the next card (also gives React time to commit the new
// session index before the next audio starts).
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
export function useAutoplay({ queue, getIndex, onStep, onReveal }) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Mutable flag so the async loop can be canceled without re-renders.
  const activeRef = useRef(false)
  // Latest callbacks captured in refs — avoids stale closures.
  const getIndexRef = useRef(getIndex)
  const onStepRef = useRef(onStep)
  const onRevealRef = useRef(onReveal)
  useEffect(() => { getIndexRef.current = getIndex }, [getIndex])
  useEffect(() => { onStepRef.current = onStep }, [onStep])
  useEffect(() => { onRevealRef.current = onReveal }, [onReveal])

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

        onRevealRef.current?.()

        for (let step = 0; step < SEQUENCE.length; step++) {
          if (!activeRef.current) return
          await SEQUENCE[step](word)
          if (!activeRef.current) return
          // Pause between sub-steps only; no pause after the last step
          // since we pause again when advancing to the next card.
          if (step < SEQUENCE.length - 1) await delay(STEP_PAUSE_MS)
        }

        if (idx >= queue.length - 1) break
        idx++
        onStepRef.current?.()
        // Pause between cards, and let React commit the dispatched 'step'
        // so the card UI is already on the new word when audio resumes.
        await delay(CARD_PAUSE_MS)
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
