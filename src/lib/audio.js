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

function playFile(url, fallbackText, fallbackLang, fallbackRate) {
  stopAudio()
  return new Promise((resolve) => {
    const audio = new Audio(url)
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
      speakBrowserTTS(fallbackText, fallbackLang, fallbackRate).then(resolve)
    }
    audio.onerror = onFail
    audio.play().catch(onFail)
  })
}

export function playWord(word) {
  return playFile(
    `${AUDIO_BASE}/words/${word.id}.mp3`,
    word.simplified, 'zh-CN', 0.85,
  )
}

export function playExample(word) {
  if (!word.example_zh) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/examples/${word.id}.mp3`,
    word.example_zh, 'zh-CN', 0.8,
  )
}

export function playMeaning(word) {
  if (!word.meaning_ko) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/meanings/${word.id}.mp3`,
    word.meaning_ko, 'ko-KR', 0.95,
  )
}

export function playTranslation(word) {
  if (!word.example_ko) return Promise.resolve()
  return playFile(
    `${AUDIO_BASE}/translations/${word.id}.mp3`,
    word.example_ko, 'ko-KR', 0.95,
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
