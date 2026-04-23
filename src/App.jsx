import { useEffect, useState } from 'react'
import LevelView from './views/LevelView.jsx'
import ChapterView, { CHAPTER_SIZE } from './views/ChapterView.jsx'
import WordsView from './views/WordsView.jsx'
import LearnView from './views/LearnView.jsx'
import { loadLevel } from './lib/loadLevel.js'
import { useFavorites } from './lib/useFavorites.js'

// State-machine navigation. Four screens, but Learn can be entered from
// multiple places (single chapter, all-level, multi-chapter selection,
// favorites), so we decouple it by passing a prebuilt `learnInputs` object
// into it.
//
//   level   -> pick HSK 1-5
//   chapter -> pick chapters (single or multi-select), favorites, or "전체 학습하기"
//   words   -> preview a single chapter before flashcards
//   learn   -> flashcard session over whatever words Learn was handed
//
// learnInputs = {
//   title:      string,          // shown in the learn navbar
//   words:      Word[],          // the session queue
//   backScreen: 'chapter' | 'words', // where the back button goes
// }
export default function App() {
  const [screen, setScreen] = useState('level')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [chapterWords, setChapterWords] = useState(null)
  const [learnInputs, setLearnInputs] = useState(null)

  const { favorites, toggleFavorite } = useFavorites()

  // Load + slice the chapter when entering the words screen. Cached inside
  // loadLevel so repeat trips are instant.
  useEffect(() => {
    if (screen !== 'words') return
    let cancelled = false
    loadLevel(selectedLevel).then((words) => {
      if (cancelled) return
      const start = selectedChapter * CHAPTER_SIZE
      setChapterWords(words.slice(start, start + CHAPTER_SIZE))
    })
    return () => { cancelled = true }
  }, [screen, selectedLevel, selectedChapter])

  if (screen === 'level') {
    return (
      <LevelView
        onSelectLevel={(level) => {
          setSelectedLevel(level)
          setScreen('chapter')
        }}
      />
    )
  }

  if (screen === 'chapter') {
    return (
      <ChapterView
        level={selectedLevel}
        favorites={favorites}
        onBack={() => setScreen('level')}
        onSelectChapter={(chapterIdx) => {
          setSelectedChapter(chapterIdx)
          setScreen('words')
        }}
        onStudyAll={(words) => {
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · 전체`,
            words,
            backScreen: 'chapter',
          })
          setScreen('learn')
        }}
        onStudySelected={(chapterIndices, allWords) => {
          const selectedWords = chapterIndices
            .slice()
            .sort((a, b) => a - b)
            .flatMap((idx) => {
              const start = idx * CHAPTER_SIZE
              return allWords.slice(start, start + CHAPTER_SIZE)
            })
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · ${chapterIndices.length}개 챕터`,
            words: selectedWords,
            backScreen: 'chapter',
          })
          setScreen('learn')
        }}
        onStudyFavorites={(words) => {
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · 즐겨찾기`,
            words,
            backScreen: 'chapter',
          })
          setScreen('learn')
        }}
      />
    )
  }

  if (screen === 'words') {
    return (
      <WordsView
        level={selectedLevel}
        chapterIndex={selectedChapter}
        words={chapterWords}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={() => setScreen('chapter')}
        onStartLearn={() => {
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · 챕터 ${selectedChapter + 1}`,
            words: chapterWords,
            backScreen: 'words',
          })
          setScreen('learn')
        }}
      />
    )
  }

  // screen === 'learn'
  return (
    <LearnView
      title={learnInputs.title}
      words={learnInputs.words}
      favorites={favorites}
      onToggleFavorite={toggleFavorite}
      onBack={() => setScreen(learnInputs.backScreen)}
    />
  )
}
