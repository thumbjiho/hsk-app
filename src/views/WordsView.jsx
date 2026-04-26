import { ChevronLeft, Speaker, Star } from '../components/Icons.jsx'
import { playWord } from '../lib/audio.js'
import './WordsView.css'

// Preview screen between ChapterView and LearnView.
// Shows every word in the chapter / topic at a glance — tap a row to hear
// it, tap the star to favorite, hit "학습 시작" to jump into the flashcard
// session. The parent decides what `title` to show; this component is
// agnostic to whether the source is a chapter slice or a topic group.
export default function WordsView({
  title,
  words,
  favorites,
  onToggleFavorite,
  onBack,
  onStartLearn,
}) {
  if (!words) {
    return <div className="words-view words-loading">불러오는 중…</div>
  }

  const translatedCount = words.filter((w) => w.meaning_ko).length

  return (
    <div className="words-view">
      <div className="navbar">
        <button className="nav-btn" onClick={onBack} aria-label="뒤로">
          <ChevronLeft />
        </button>
        <div className="navbar-title">{title}</div>
        <div />
      </div>

      <div className="words-summary">
        총 {words.length}단어 · {translatedCount}개 뜻 등록됨
      </div>

      <div className="words-list">
        {words.map((w, i) => (
          <WordRow
            key={w.id}
            word={w}
            index={i}
            favorited={favorites?.has(w.id) ?? false}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      <div className="words-cta">
        <button className="start-btn" onClick={onStartLearn}>
          학습 시작
        </button>
      </div>
    </div>
  )
}

function WordRow({ word, index, favorited, onToggleFavorite }) {
  const handleClick = () => playWord(word)
  const handleStar = (e) => {
    e.stopPropagation()
    onToggleFavorite?.(word.id)
  }
  return (
    <button className="word-row" onClick={handleClick}>
      <div className="word-row-index">{index + 1}</div>
      <div className="word-row-hanzi">{word.simplified}</div>
      <div className="word-row-body">
        <div className="word-row-pinyin">{word.pinyin}</div>
        <div className={`word-row-meaning${word.meaning_ko ? '' : ' empty'}`}>
          {word.meaning_ko || '뜻 미등록'}
        </div>
      </div>
      <div className="word-row-actions">
        <span
          className={`word-row-star${favorited ? ' on' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={favorited ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-pressed={favorited}
          onClick={handleStar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleStar(e)
            }
          }}
        >
          <Star size={18} filled={favorited} />
        </span>
        <span className="word-row-speaker" aria-hidden="true">
          <Speaker size={14} />
        </span>
      </div>
    </button>
  )
}
