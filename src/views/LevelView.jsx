import { useEffect, useState } from 'react'
import './LevelView.css'

// Level metadata. Word counts are re-confirmed at runtime against /data/index.json
// (which is the source of truth written by build-json.py) — but we keep the hardcoded
// counts as the initial render to avoid a flash of blank cards.
// `ready: false` marks levels whose Korean translations haven't been written yet —
// those cards render as disabled placeholders immediately, without waiting for the
// index fetch. Flip to `true` once a level's translations are populated.
// Each level gets its own accent color: red → orange → gold → green → blue.
const LEVELS = [
  { level: 1, wordCount: 500,  accent: '#e63946', ready: true  },
  { level: 2, wordCount: 772,  accent: '#f59e0b', ready: false },
  { level: 3, wordCount: 973,  accent: '#d4a574', ready: false },
  { level: 4, wordCount: 1000, accent: '#4ade80', ready: false },
  { level: 5, wordCount: 1071, accent: '#2e74c7', ready: false },
]

export default function LevelView({ onSelectLevel }) {
  // translatedByLevel[1..5] = number of words with meaning_ko populated.
  // null while loading; empty object if the index fetch failed.
  const [translatedByLevel, setTranslatedByLevel] = useState(null)

  useEffect(() => {
    fetch('/data/index.json')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        const map = {}
        for (const lv of data.levels) map[lv.level] = lv.translated
        setTranslatedByLevel(map)
      })
      .catch(() => setTranslatedByLevel({}))
  }, [])

  return (
    <div className="level-view">
      <div className="navbar">
        <div />
        <div className="navbar-title">HSK 단어 학습</div>
        <div />
      </div>

      <div className="level-grid">
        {LEVELS.map(({ level, wordCount, accent, ready }) => {
          const translated = translatedByLevel?.[level] ?? 0
          // Placeholder when the hardcoded `ready` flag is false, or when the
          // index confirms no translations exist yet. The hardcoded flag keeps
          // the disabled state visible on first paint, before index.json lands.
          const isPlaceholder = !ready || (translatedByLevel !== null && translated === 0)
          return (
            <button
              key={level}
              className={`level-card${isPlaceholder ? ' placeholder' : ''}`}
              onClick={() => !isPlaceholder && onSelectLevel(level)}
              disabled={isPlaceholder}
              style={{ '--accent-level': accent }}
            >
              <div className="level-card-badge">HSK</div>
              <div className="level-card-num">{level}</div>
              <div className="level-card-sub">
                {level}급 · {wordCount.toLocaleString()}단어
                {translated > 0 && translated < wordCount && (
                  <span className="level-card-progress">
                    {' '}· {translated}개 등록
                  </span>
                )}
              </div>
              {isPlaceholder && (
                <div className="coming-soon">준비 중</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
