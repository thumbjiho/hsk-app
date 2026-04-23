import { useReducer } from 'react'

// Session state shape:
//   originalQueue - pristine word list (for un-shuffling and redo-all)
//   queue         - active word list (may be shuffled or filtered to "again" words)
//   index         - current position in queue; === queue.length means "done"
//   answers       - parallel to queue; null | 'know' | 'again'
//   autoReveal    - if true, new cards show meaning/pinyin on entry
//   reveal        - per-card visibility: { meaning: bool, pinyin: bool }
//   script        - 'simp' | 'trad'
//   shuffled      - whether queue is currently shuffled
//
// Favorites live outside the session (App.jsx + useFavorites) so every screen
// shares one source of truth — don't add them back here.

const initial = (words) => ({
  originalQueue: words,
  queue: words,
  index: 0,
  answers: new Array(words.length).fill(null),
  autoReveal: false,
  reveal: { meaning: false, pinyin: false },
  script: 'simp',
  shuffled: false,
})

// Fisher-Yates in-place shuffle on a copy.
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Reveal state to apply when moving to a new card.
function freshReveal(state) {
  return state.autoReveal
    ? { meaning: true, pinyin: true }
    : { meaning: false, pinyin: false }
}

function reducer(state, action) {
  switch (action.type) {
    case 'answer': {
      // Mark current card, advance to next unanswered. If all answered,
      // index moves past the end — caller detects this as "done".
      const answers = [...state.answers]
      answers[state.index] = action.answer
      let next = state.index + 1
      while (next < answers.length && answers[next] !== null) next++
      return {
        ...state,
        answers,
        index: next,
        reveal: freshReveal(state),
      }
    }
    case 'undo': {
      // Step back and clear the answer there. If currently "done", go to last.
      if (state.index === 0 && state.answers[0] === null) return state
      const target = state.index >= state.queue.length
        ? state.queue.length - 1
        : state.index - 1
      if (target < 0) return state
      const answers = [...state.answers]
      answers[target] = null
      return {
        ...state,
        answers,
        index: target,
        reveal: freshReveal(state),
      }
    }
    case 'step': {
      // Autoplay-style advance: index + 1 without touching answers.
      // Stops at last card (does not overshoot into "done").
      if (state.index >= state.queue.length - 1) return state
      return {
        ...state,
        index: state.index + 1,
        reveal: freshReveal(state),
      }
    }
    case 'toggleShuffle': {
      // Shuffling (or unshuffling) resets the session — answers are cleared
      // because the queue index mapping changes.
      const nextShuffled = !state.shuffled
      const queue = nextShuffled
        ? shuffle(state.originalQueue)
        : state.originalQueue
      return {
        ...state,
        shuffled: nextShuffled,
        queue,
        index: 0,
        answers: new Array(queue.length).fill(null),
        reveal: freshReveal({ ...state, autoReveal: state.autoReveal }),
      }
    }
    case 'redoAgain': {
      // Filter queue to only the "again"-marked words and start over.
      const remaining = state.queue.filter(
        (_, i) => state.answers[i] === 'again',
      )
      if (remaining.length === 0) return state
      return {
        ...state,
        queue: remaining,
        originalQueue: remaining,
        index: 0,
        answers: new Array(remaining.length).fill(null),
        shuffled: false,
        reveal: freshReveal(state),
      }
    }
    case 'reveal':
      return { ...state, reveal: { ...state.reveal, [action.field]: true } }
    case 'revealAll':
      return { ...state, reveal: { meaning: true, pinyin: true } }
    case 'hide':
      return { ...state, reveal: { meaning: false, pinyin: false } }
    case 'toggleAutoReveal': {
      const next = !state.autoReveal
      return {
        ...state,
        autoReveal: next,
        reveal: next ? { meaning: true, pinyin: true } : state.reveal,
      }
    }
    case 'setScript':
      return { ...state, script: action.script }
    default:
      return state
  }
}

export function useSession(words) {
  const [state, dispatch] = useReducer(reducer, words, initial)
  return [state, dispatch]
}
