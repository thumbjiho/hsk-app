import { useEffect, useMemo, useState } from 'react'
import {
  Users, HandHeart, Hash, Clock, UtensilsCrossed, GraduationCap, House,
  Car, MapPin, Compass, CloudSun, Heart, Activity, Palette, Wrench,
  Tag,
} from 'lucide-react'
import { loadLevel, loadTopics } from '../lib/loadLevel.js'
import {
  ChevronLeft,
  Circle,
  CheckCircle,
  Star,
} from '../components/Icons.jsx'
import './ChapterView.css'

// Maps the `icon` field in hsk-{level}-topics.json onto the actual
// lucide-react component. Static so bundlers can tree-shake.
const TOPIC_ICON = {
  Users, HandHeart, Hash, Clock, UtensilsCrossed, GraduationCap, House,
  Car, MapPin, Compass, CloudSun, Heart, Activity, Palette, Wrench,
}

// Default chapter size. Easy to adjust — try 10/20/50 and see what feels right.
export const CHAPTER_SIZE = 20

export default function ChapterView({
  level,
  favorites,
  tab = 'chapters',
  onTabChange,
  onBack,
  onSelectChapter,
  onStudyAll,
  onStudySelected,
  onStudyFavorites,
  onPreviewTopic,
}) {
  const [words, setWords] = useState(null)
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const setTab = onTabChange ?? (() => {})

  useEffect(() => {
    let cancelled = false
    loadLevel(level)
      .then((w) => { if (!cancelled) setWords(w) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    loadTopics(level)
      .then((t) => { if (!cancelled) setTopics(t) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [level])

  const chapters = words ? chunk(words, CHAPTER_SIZE) : []
  const wordById = useMemo(() => {
    if (!words) return null
    const m = new Map()
    for (const w of words) m.set(w.id, w)
    return m
  }, [words])

  // Favorite words belonging to THIS level — the favorites Set is global,
  // but we only surface the slice that this level's word list owns so the
  // "즐겨찾기" session on HSK 1 doesn't pull in words from other levels.
  const favoriteWords = useMemo(() => {
    if (!words || !favorites || favorites.size === 0) return []
    return words.filter((w) => favorites.has(w.id))
  }, [words, favorites])

  const enterSelectMode = () => {
    setSelectMode(true)
    setTab('chapters')
  }
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
            {/* Favorites lives above everything — it's its own bucket and
                shouldn't get hidden by switching between chapter/topic tabs.
                Rendered directly inside chapter-body (a flex column) so it
                stretches to the full width like other rows. */}
            {!selectMode && (
              <FavoritesRow
                favoriteWords={favoriteWords}
                onStudy={() => onStudyFavorites?.(favoriteWords)}
              />
            )}

            {/* Tab toggle — only shown when topics are available for this level
                and we're not in chapter-select mode. */}
            {topics && !selectMode && (
              <div className="chapter-tabs" role="tablist">
                <button
                  className={`chapter-tab${tab === 'chapters' ? ' active' : ''}`}
                  onClick={() => setTab('chapters')}
                  role="tab"
                  aria-selected={tab === 'chapters'}
                >
                  챕터별
                </button>
                <button
                  className={`chapter-tab${tab === 'topics' ? ' active' : ''}`}
                  onClick={() => setTab('topics')}
                  role="tab"
                  aria-selected={tab === 'topics'}
                >
                  주제별
                </button>
              </div>
            )}

            <div className="chapter-summary">
              {tab === 'topics' && topics
                ? `총 ${words.length.toLocaleString()}단어 · ${topics.topics.length}개 주제`
                : `총 ${words.length.toLocaleString()}단어 · ${chapters.length}챕터 · 챕터당 ${CHAPTER_SIZE}단어`}
            </div>

            <div className="chapter-list">
              {tab === 'chapters' && chapters.map((chunk, idx) => (
                <ChapterRow
                  key={idx}
                  index={idx}
                  words={chunk}
                  selectMode={selectMode}
                  selected={selected.has(idx)}
                  onClick={() => handleRowClick(idx)}
                />
              ))}

              {tab === 'topics' && topics && topics.topics.map((t) => {
                const Icon = TOPIC_ICON[t.icon] ?? Tag
                const previewWords = t.wordIds.slice(0, 5)
                  .map((id) => wordById?.get(id))
                  .filter(Boolean)
                return (
                  <button
                    key={t.id}
                    className="chapter-row topic-row"
                    onClick={() => {
                      const topicWords = t.wordIds
                        .map((id) => wordById?.get(id))
                        .filter(Boolean)
                      onPreviewTopic?.(t, topicWords)
                    }}
                  >
                    <div className="topic-icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <div className="chapter-row-left">
                      <div className="chapter-row-title">{t.label}</div>
                      <div className="chapter-row-preview">
                        {previewWords.map((w) => w.simplified).join(', ')}
                        {t.wordIds.length > previewWords.length ? '…' : ''}
                      </div>
                    </div>
                    <div className="chapter-row-right">
                      <div className="chapter-row-range">{t.count}단어</div>
                      <ChevronLeft className="chapter-row-chevron" />
                    </div>
                  </button>
                )
              })}
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

function FavoritesRow({ favoriteWords, onStudy }) {
  if (favoriteWords.length === 0) {
    return (
      <div className="chapter-row favorites-row empty" aria-disabled="true">
        <div className="chapter-row-left">
          <div className="chapter-row-title">
            <span className="favorites-icon" aria-hidden="true">
              <Star size={16} />
            </span>
            즐겨찾기
          </div>
          <div className="chapter-row-preview">
            단어 옆 ☆ 을 눌러 즐겨찾기에 추가해보세요
          </div>
        </div>
        <div className="chapter-row-right">
          <div className="chapter-row-range">0단어</div>
        </div>
      </div>
    )
  }
  return (
    <button className="chapter-row favorites-row" onClick={onStudy}>
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
