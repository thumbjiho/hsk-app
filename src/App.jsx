import { useEffect, useState } from 'react'
import LevelView from './views/LevelView.jsx'
import ChapterView, { CHAPTER_SIZE } from './views/ChapterView.jsx'
import WordsView from './views/WordsView.jsx'
import LearnView from './views/LearnView.jsx'
import { loadLevel } from './lib/loadLevel.js'
import { useFavorites } from './lib/useFavorites.js'

// State-machine navigation. Four screens, but Words and Learn can both be
// entered from multiple places (a chapter, a topic group, favorites,
// multi-chapter selection, "study all"), so we decouple them with two
// prebuilt input objects:
//
//   wordsInputs = { title, words: Word[] | null }   shown in WordsView preview
//   learnInputs = { title, words: Word[], backScreen }
//
//   level   -> pick HSK 1-5
//   chapter -> pick chapters / topics / favorites / "전체 학습"
//   words   -> preview a chapter or topic before flashcards
//   learn   -> flashcard session
export default function App() {
  const [screen, setScreen] = useState('level')
  const [navDir, setNavDir] = useState('forward')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [wordsInputs, setWordsInputs] = useState(null)
  const [learnInputs, setLearnInputs] = useState(null)
  // Lifted out of ChapterView so the chosen tab survives the round-trip
  // through WordsView / LearnView (each navigation remounts the screen).
  const [chapterTab, setChapterTab] = useState('chapters')

  const { favorites, toggleFavorite } = useFavorites()

  // Navigate with direction: 'forward' slides new screen in from the right,
  // 'back' slides it in from the left. Pairs with .screen CSS animations.
  const goTo = (next, dir = 'forward') => {
    setNavDir(dir)
    setScreen(next)
  }

  // Chapter previews enter Words with title set but words still null —
  // load + slice the chapter here once so we don't block the screen
  // transition. Topic previews already arrive with words populated.
  useEffect(() => {
    if (screen !== 'words') return
    if (!wordsInputs || wordsInputs.words) return
    if (selectedChapter == null) return
    let cancelled = false
    loadLevel(selectedLevel).then((all) => {
      if (cancelled) return
      const start = selectedChapter * CHAPTER_SIZE
      setWordsInputs((prev) => prev && {
        ...prev,
        words: all.slice(start, start + CHAPTER_SIZE),
      })
    })
    return () => { cancelled = true }
  }, [screen, wordsInputs, selectedLevel, selectedChapter])

  let body
  if (screen === 'level') {
    body = (
      <LevelView
        onSelectLevel={(level) => {
          setSelectedLevel(level)
          goTo('chapter')
        }}
      />
    )
  } else if (screen === 'chapter') {
    body = (
      <ChapterView
        level={selectedLevel}
        favorites={favorites}
        tab={chapterTab}
        onTabChange={setChapterTab}
        onBack={() => goTo('level', 'back')}
        onSelectChapter={(chapterIdx) => {
          setSelectedChapter(chapterIdx)
          setWordsInputs({
            title: `HSK ${selectedLevel}급 · 챕터 ${chapterIdx + 1}`,
            words: null, // populated by the effect above
          })
          goTo('words')
        }}
        onStudyAll={(words) => {
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · 전체`,
            words,
            backScreen: 'chapter',
          })
          goTo('learn')
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
          goTo('learn')
        }}
        onStudyFavorites={(words) => {
          setLearnInputs({
            title: `HSK ${selectedLevel}급 · 즐겨찾기`,
            words,
            backScreen: 'chapter',
          })
          goTo('learn')
        }}
        onPreviewTopic={(topic, topicWords) => {
          // Clear chapter selection so the words effect doesn't try to
          // re-load a chapter slice on top of the topic words.
          setSelectedChapter(null)
          setWordsInputs({
            title: `HSK ${selectedLevel}급 · ${topic.label}`,
            words: topicWords,
          })
          goTo('words')
        }}
      />
    )
  } else if (screen === 'words') {
    body = (
      <WordsView
        title={wordsInputs?.title}
        words={wordsInputs?.words}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={() => goTo('chapter', 'back')}
        onStartLearn={() => {
          setLearnInputs({
            title: wordsInputs.title,
            words: wordsInputs.words,
            backScreen: 'words',
          })
          goTo('learn')
        }}
      />
    )
  } else {
    body = (
      <LearnView
        title={learnInputs.title}
        words={learnInputs.words}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={() => goTo(learnInputs.backScreen, 'back')}
      />
    )
  }

  return (
    <div className="screen" data-nav-dir={navDir} key={screen}>
      {body}
    </div>
  )
}
