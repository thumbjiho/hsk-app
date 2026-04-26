// Audio playback for words, meanings, and example sentences.
//
// Chinese audio (word, example_zh)   -> pre-generated WaveNet mp3 (male)
// Korean audio  (meaning, example_ko) -> pre-generated WaveNet mp3 (female)
// Fallback -> Web Speech API in the appropriate language
//
// All play* functions return a Promise<void> that resolves when playback
// finishes (natural end, or when interrupted by a new play / stopAudio).
// This lets the autoplay hook await each step in sequence.

const AUDIO_BASE = '/audio/google'

let currentAudio = null
let pendingResolve = null

// Lazily-constructed AudioContext for synthesized chimes (e.g. completion).
// Created on first use because some browsers require a user-gesture origin.
let chimeCtx = null
function getChimeCtx() {
  if (typeof window === 'undefined') return null
  if (chimeCtx) return chimeCtx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  chimeCtx = new Ctx()
  return chimeCtx
}

// Plays a short major-triad arpeggio — a "ta-da" cue for completion screens.
// Synthesized so there's no asset to ship; tones are sine + tiny attack/decay
// envelope so it doesn't click. Gracefully no-ops if Web Audio is unavailable.
export function playChime() {
  const ctx = getChimeCtx()
  if (!ctx) return
  // Resume in case another audio path suspended the context.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
  // C5, E5, G5, C6 — bright but not piercing.
  const notes = [523.25, 659.25, 783.99, 1046.5]
  const noteDuration = 0.18
  const stagger = 0.09

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)

    const start = now + i * stagger
    const peak = 0.18
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peak, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration)

    osc.start(start)
    osc.stop(start + noteDuration + 0.05)
  })
}

// Cancels any in-flight audio or TTS and resolves the pending play promise.
export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  if (pendingResolve) {
    const r = pendingResolve
    pendingResolve = null
    r()
  }
}

function speakBrowserTTS(text, lang, rate) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    pendingResolve = resolve
    u.onend = () => {
      if (pendingResolve === resolve) pendingResolve = null
      resolve()
    }
    u.onerror = () => {
      if (pendingResolve === resolve) pendingResolve = null
      resolve()
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  })
}

// `speed` multiplies playbackRate on the prerecorded mp3s; for TTS fallback
// it scales the per-language base rate (which is < 1 to slow each language to
// a comfortable learning tempo). Pitch is preserved by the browser.
function playFile(url, fallbackText, fallbackLang, fallbackBaseRate, speed = 1) {
  stopAudio()
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.playbackRate = speed
    currentAudio = audio
    pendingResolve = resolve

    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null
        if (pendingResolve === resolve) pendingResolve = null
        resolve()
      }
    }

    const onFail = () => {
      if (currentAudio !== audio) return  // already canceled
      currentAudio = null
      // Hand the pending slot over to speakBrowserTTS so stopAudio still works.
      if (pendingResolve === resolve) pendingResolve = null
      speakBrowserTTS(fallbackText, fallbackLang, fallbackBaseRate * speed).then(resolve)
    }
    audio.onerror = onFail
    audio.play().catch(onFail)
  })
}

export function playWord(word, { speed = 1 } = {}) {
  return playFile(
    `${AUDIO_BASE}/words/${word.id}.mp3`,
    word.simplified, 'zh-CN', 0.85, speed,
  )
}

export function playExample(word, { speed = 1 } = {}) {
  if (!word.example_zh) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/examples/${word.id}.mp3`,
    word.example_zh, 'zh-CN', 0.8, speed,
  )
}

export function playMeaning(word, { speed = 1 } = {}) {
  if (!word.meaning_ko) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/meanings/${word.id}.mp3`,
    word.meaning_ko, 'ko-KR', 0.95, speed,
  )
}

export function playTranslation(word, { speed = 1 } = {}) {
  if (!word.example_ko) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/translations/${word.id}.mp3`,
    word.example_ko, 'ko-KR', 0.95, speed,
  )
}

// Build every audio URL the session will play. We skip files for fields the
// word doesn't have (e.g. no example → no example/translation mp3s).
function audioUrlsForWord(word) {
  const urls = [`${AUDIO_BASE}/words/${word.id}.mp3`]
  if (word.meaning_ko) urls.push(`${AUDIO_BASE}/meanings/${word.id}.mp3`)
  if (word.example_zh) urls.push(`${AUDIO_BASE}/examples/${word.id}.mp3`)
  if (word.example_ko) urls.push(`${AUDIO_BASE}/translations/${word.id}.mp3`)
  return urls
}

/**
 * Warm the browser cache for every audio file the upcoming session will touch,
 * so playback during learning is instant.
 *
 * Fetches run with bounded concurrency — 500-word sessions produce ~2k requests,
 * and firing them all at once can choke the browser's network queue and stall
 * the first few plays. Eight parallel workers strikes a good balance.
 *
 * Missing files (typical for unwritten example audio) silently count as done.
 *
 * @param words         array of word objects
 * @param onProgress    callback({ done, total }) fired on each completion
 * @param signal        optional AbortSignal to cancel in-flight fetches
 * @returns Promise<void> resolving when all requests have settled
 */
export async function preloadAudio(words, { onProgress, signal, concurrency = 8 } = {}) {
  const urls = words.flatMap(audioUrlsForWord)
  const total = urls.length
  if (total === 0) return
  let done = 0
  let cursor = 0

  onProgress?.({ done, total })

  async function worker() {
    while (cursor < urls.length) {
      if (signal?.aborted) return
      const url = urls[cursor++]
      try {
        // Read the body so the response is actually stored by the browser's
        // HTTP cache — a HEAD or an unconsumed GET may not persist.
        const res = await fetch(url, { signal, cache: 'force-cache' })
        if (res.ok) await res.blob()
      } catch { /* 404 / network: ignore, TTS fallback handles playback */ }
      done++
      onProgress?.({ done, total })
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    () => worker(),
  )
  await Promise.all(workers)
}
