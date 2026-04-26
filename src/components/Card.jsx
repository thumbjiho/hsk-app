import { useState } from 'react'
import {
  EyeOpen,
  EyeClosed,
  RefreshCw,
  Speaker,
  Star,
} from './Icons.jsx'
import './Card.css'

// Small helper: mark a button click as handled so the parent
// region's onClick (which plays audio) doesn't also fire.
const stop = (fn) => (e) => {
  e.stopPropagation()
  fn?.(e)
}

/**
 * The learning card.
 *
 * Layout is a flex column with two main regions:
 *   - WordRegion:    hanzi + pinyin + meaning, click anywhere to play word audio.
 *                    Contains the top bar (script toggle, eye, star).
 *   - ExampleRegion: example + example pinyin + Korean gloss, click to play sentence.
 *                    Contains the reveal bar at the bottom.
 *
 * Each region owns its hover tint via a direct `background` (no ::before
 * tricks). The card's `overflow: hidden` + `border-radius` clips the tint
 * naturally at rounded corners.
 */
export default function Card({
  word,
  script,
  reveal,
  favorited,
  autoReveal,
  onPlayWord,
  onPlayExample,
  onSetScript,
  onToggleAutoReveal,
  onToggleFavorite,
  onRevealMeaning,
  onRevealPinyin,
  onRevealAll,
  onHide,
}) {
  const [wordPlaying, setWordPlaying] = useState(false)
  const [examplePlaying, setExamplePlaying] = useState(false)

  const hanzi = script === 'trad' ? word.traditional : word.simplified
  // `example_zh_trad` is only present on hand-curated samples. Fall back to
  // the simplified sentence if the traditional form isn't available yet.
  const exampleZh = (script === 'trad' && word.example_zh_trad)
    ? word.example_zh_trad
    : word.example_zh
  const hasExample = !!word.example_zh
  const nothingRevealed = !reveal.meaning && !reveal.pinyin

  const handleWordClick = () => {
    onPlayWord?.(word)
    setWordPlaying(true)
    setTimeout(() => setWordPlaying(false), 900)
  }

  const handleExampleClick = () => {
    if (!word.example_zh) return
    onPlayExample?.(word)
    setExamplePlaying(true)
    setTimeout(() => setExamplePlaying(false), 1400)
  }

  return (
    <div className="card">
      {/* --- word region (top half) ---------------------------------- */}
      <div
        className={`region word-region${wordPlaying ? ' playing' : ''}`}
        onClick={handleWordClick}
        role="button"
        aria-label="단어 발음 재생"
      >
        <div className="card-top">
          <button
            className={`star${favorited ? ' on' : ''}`}
            onClick={stop(onToggleFavorite)}
            aria-label={favorited ? '즐겨찾기 해제' : '즐겨찾기'}
            aria-pressed={favorited}
          >
            <Star size={20} filled={favorited} />
          </button>

          <div className="card-top-right">
            <div className="script-toggle" role="group" aria-label="간체/번체">
              <button
                className={`script-opt${script === 'simp' ? ' active' : ''}`}
                onClick={stop(() => onSetScript('simp'))}
                aria-pressed={script === 'simp'}
              >
                简
              </button>
              <button
                className={`script-opt${script === 'trad' ? ' active' : ''}`}
                onClick={stop(() => onSetScript('trad'))}
                aria-pressed={script === 'trad'}
              >
                繁
              </button>
            </div>

            <button
              className={`icon-btn eye-btn${autoReveal ? ' active' : ''}`}
              onClick={stop(onToggleAutoReveal)}
              aria-label="뜻/병음 자동 표시"
              aria-pressed={autoReveal}
            >
              {autoReveal ? <EyeOpen /> : <EyeClosed />}
            </button>
          </div>
        </div>

        <div className="word-display">
          <div className="hanzi">{hanzi}</div>
          <div className={`pinyin${reveal.pinyin ? ' revealed' : ''}`}>
            {word.pinyin}
          </div>
          <div className={`meaning${reveal.meaning ? ' revealed' : ''}${word.meaning_ko ? '' : ' empty'}`}>
            {word.meaning_ko || '뜻 미등록'}
          </div>
        </div>

        <div className="speaker-hint word-hint" aria-hidden="true">
          <Speaker size={16} />
        </div>
      </div>

      <div className="divider" />

      {/* --- example region (bottom half) ---------------------------- */}
      <div
        className={`region example-region${examplePlaying ? ' playing' : ''}${hasExample ? '' : ' empty'}`}
        onClick={hasExample ? handleExampleClick : undefined}
        role={hasExample ? 'button' : undefined}
        aria-label={hasExample ? '예문 발음 재생' : undefined}
      >
        {hasExample ? (
          <div className="example">
            <div className="speaker-hint example-hint" aria-hidden="true">
              <Speaker size={14} />
            </div>
            <div className="example-zh">{exampleZh}</div>
            <div className={`example-pinyin${reveal.pinyin ? ' revealed' : ''}`}>
              {word.example_pinyin}
            </div>
            <div className={`example-ko${reveal.meaning ? ' revealed' : ''}`}>
              {word.example_ko}
            </div>
          </div>
        ) : (
          <div className="example-empty">예문 준비 중</div>
        )}

        {/* All four slots render unconditionally so each button keeps its
            fixed grid column. Buttons that don't apply to the current state
            become invisible (visibility: hidden) — the slot stays. */}
        <div className="reveal-bar" onClick={stop(() => {})}>
          <button
            className={`hide-btn${nothingRevealed ? ' slot-hidden' : ''}`}
            onClick={stop(onHide)}
            aria-label="의미/병음 다시 가리기"
            tabIndex={nothingRevealed ? -1 : 0}
            aria-hidden={nothingRevealed}
          >
            <RefreshCw />
          </button>
          <button
            className={`reveal-btn${reveal.meaning ? ' slot-hidden' : ''}`}
            onClick={stop(onRevealMeaning)}
            tabIndex={reveal.meaning ? -1 : 0}
            aria-hidden={reveal.meaning}
          >
            의미
          </button>
          <button
            className={`reveal-btn${reveal.pinyin ? ' slot-hidden' : ''}`}
            onClick={stop(onRevealPinyin)}
            tabIndex={reveal.pinyin ? -1 : 0}
            aria-hidden={reveal.pinyin}
          >
            병음
          </button>
          <button
            className={`reveal-btn${nothingRevealed ? '' : ' slot-hidden'}`}
            onClick={stop(onRevealAll)}
            tabIndex={nothingRevealed ? 0 : -1}
            aria-hidden={!nothingRevealed}
          >
            둘다
          </button>
        </div>
      </div>
    </div>
  )
}
