import { useEffect, useMemo, useState } from 'react'
import { loadLevel } from '../lib/loadLevel.js'
import {
  ChevronLeft,
  Circle,
  CheckCircle,
  Star,
} from '../components/Icons.jsx'
import './ChapterView.css'

// Default chapter size. Easy to adjust — try 10/20/50 and see what feels right.
export const CHAPTER_SIZE = 20

export default function ChapterView({
  level,
  favorites,
  onBack,
  onSelectChapter,
  onStudyAll,
  onStudySelected,
  onStudyFavorites,
}) {
  const [words, setWords] = useState(null)
  const [error, setError] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    loadLevel(level)
      .then((w) => { if (!cancelled) setWords(w) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [level])

  const chapters = words ? chunk(words, CHAPTER_SIZE) : []

  // Favorite words belonging to THIS level — the favorites Set is global,
  // but we only surface the slice that this level's word list owns so the
  // "즐겨찾기" session on HSK 1 doesn't pull in words from other levels.
  const favoriteWords = useMemo(() => {
    if (!words || !favorites || favorites.size === 0) return []
    return words.filter((w) => favorites.has(w.id))
  }, [words, favorites])

  const enterSelectMode = () => setSelectMode(true)
  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleRowClick = (idx) => {
    if (selectMode) toggleSelect(idx)
    else onSelectChapter(idx)
  }

  return (
    <div className="chapter-view">
      <div className="navbar">
        <button className="nav-btn" onClick={onBack} aria-label="뒤로">
          <ChevronLeft />
        </button>
        <div className="navbar-title">
          HSK {level}급{selectMode && <span className="select-hint"> · 선택</span>}
        </div>
        <div />
      </div>

      <div className="chapter-body">
        {error && <div className="chapter-error">데이터를 불러오지 못했어요: {error}</div>}
        {!words && !error && <div className="chapter-loading">불러오는 중…</div>}
        {words && (
          <>
            <div className="chapter-summary">
              총 {words.length.toLocaleString()}단어 · {chapters.length}챕터 ·
              {' '}챕터당 {CHAPTER_SIZE}단어
            </div>
            <div className="chapter-list">
              {!selectMode && favoriteWords.length > 0 && (
                <button
                  className="chapter-row favorites-row"
                  onClick={() => onStudyFavorites?.(favoriteWords)}
                >
                  <div className="chapter-row-left">
                    <div className="chapter-row-title">
                      <span className="favorites-icon" aria-hidden="true">
                        <Star size={16} filled />
                      </span>
                      즐겨찾기
                    </div>
                    <div className="chapter-row-preview">
                      {favoriteWords.slice(0, 5).map((w) => w.simplified).join(', ')}
                      {favoriteWords.length > 5 ? '…' : ''}
                    </div>
                  </div>
                  <div className="chapter-row-right">
                    <div className="chapter-row-range">{favoriteWords.length}단어</div>
                    <ChevronLeft className="chapter-row-chevron" />
                  </div>
                </button>
              )}
              {chapters.map((chunk, idx) => (
                <ChapterRow
                  key={idx}
                  index={idx}
                  words={chunk}
                  selectMode={selectMode}
                  selected={selected.has(idx)}
                  onClick={() => handleRowClick(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {words && (
        <div className="chapter-cta">
          {selectMode ? (
            <>
              <button className="cta-btn secondary" onClick={exitSelectMode}>
                취소
              </button>
              <button
                className="cta-btn primary"
                onClick={() => onStudySelected(Array.from(selected), words)}
                disabled={selected.size === 0}
              >
                학습하기{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </>
          ) : (
            <>
              <button className="cta-btn secondary" onClick={enterSelectMode}>
                챕터 선택
              </button>
              <button
                className="cta-btn primary"
                onClick={() => onStudyAll(words)}
              >
                전체 학습하기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ChapterRow({ index, words, selectMode, selected, onClick }) {
  const start = index * CHAPTER_SIZE + 1
  const end = index * CHAPTER_SIZE + words.length
  const preview = words.slice(0, 5).map((w) => w.simplified).join(', ')
  const translated = words.filter((w) => w.meaning_ko).length
  const isPlaceholder = translated === 0
  const isPartial = translated > 0 && translated < words.length

  const classes = [
    'chapter-row',
    isPlaceholder && 'placeholder',
    selectMode && 'selectable',
    selectMode && selected && 'selected',
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} onClick={onClick}>
      <div className="chapter-row-left">
        <div className="chapter-row-title">
          챕터 {index + 1}
          {isPlaceholder && <span className="coming-soon-inline">준비 중</span>}
          {isPartial && (
            <span className="chapter-row-progress">{translated}/{words.length}</span>
          )}
        </div>
        <div className="chapter-row-preview">{preview}…</div>
      </div>
      <div className="chapter-row-right">
        <div className="chapter-row-range">{start}–{end}</div>
        {selectMode
          ? <span className="chapter-check">
              {selected ? <CheckCircle /> : <Circle />}
            </span>
          : <ChevronLeft className="chapter-row-chevron" />}
      </div>
    </button>
  )
}

function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}
