import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import AudioSettingsMenu from "../components/AudioSettingsMenu.jsx";
import {
  ChevronLeft,
  Pause,
  Play,
  Shuffle,
  Undo,
} from "../components/Icons.jsx";
import { useSession } from "../lib/useSession.js";
import { useAutoplay } from "../lib/useAutoplay.js";
import { useAudioSettings } from "../lib/useAudioSettings.js";
import {
  playWord,
  playExample,
  playChime,
  preloadAudio,
  stopAudio,
} from "../lib/audio.js";
import "./LearnView.css";

export default function LearnView({ title, words, favorites, onToggleFavorite, onBack }) {
  // Preload all audio for this session before we hand control to the user.
  // Once finished, we never re-enter the preload state for this session —
  // remember the word-list identity we already preloaded so re-renders don't
  // loop. Missing files (404) silently count as "done"; TTS will cover them.
  const [preloadProgress, setPreloadProgress] = useState({ done: 0, total: 0 });
  const [preloaded, setPreloaded] = useState(false);
  const preloadedFor = useRef(null);

  useEffect(() => {
    if (!words) return;
    if (preloadedFor.current === words) {
      setPreloaded(true);
      return;
    }
    preloadedFor.current = words;
    setPreloaded(false);
    setPreloadProgress({ done: 0, total: 0 });
    const controller = new AbortController();
    preloadAudio(words, {
      signal: controller.signal,
      onProgress: setPreloadProgress,
    }).then(() => {
      if (!controller.signal.aborted) setPreloaded(true);
    });
    return () => controller.abort();
  }, [words]);

  if (!words) {
    return <div className="learn-view learn-loading">불러오는 중…</div>;
  }
  if (!preloaded) {
    return (
      <PreloadScreen
        title={title}
        done={preloadProgress.done}
        total={preloadProgress.total}
        onBack={onBack}
      />
    );
  }
  return (
    <LearnSession
      title={title}
      words={words}
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
      onBack={onBack}
    />
  );
}

function PreloadScreen({ title, done, total, onBack }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="learn-view">
      <div className="navbar">
        <button className="nav-btn" onClick={onBack} aria-label="뒤로">
          <ChevronLeft />
        </button>
        <div className="navbar-title">{title}</div>
        <div />
      </div>
      <div className="preload-screen">
        <div className="preload-glyph">音</div>
        <div className="preload-title">오디오 준비 중</div>
        <div className="preload-sub">학습 중 끊김 없이 재생되도록 미리 받아두는 중이에요</div>
        <div className="preload-bar">
          <div className="preload-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="preload-count">
          {done} / {total || '…'}
        </div>
      </div>
    </div>
  );
}

// Keyed on the `words` prop by the parent so useSession's reducer picks up a
// fresh initial state when the queue changes.
function LearnSession({ title, words, favorites, onToggleFavorite, onBack }) {
  const [state, dispatch] = useSession(words);
  const [audioSettings, updateAudioSettings] = useAudioSettings();
  const audioSettingsRef = useRef(audioSettings);
  useEffect(() => { audioSettingsRef.current = audioSettings; }, [audioSettings]);

  const total = state.queue.length;
  const isDone = state.index >= total;

  // Play a short chime exactly once when the session transitions into the
  // done state — covers manual completion and autoplay roll-through alike.
  useEffect(() => {
    if (isDone) playChime();
  }, [isDone]);
  const current = !isDone ? state.queue[state.index] : null;
  const knowCount = useMemo(
    () => state.answers.filter((a) => a === "know").length,
    [state.answers],
  );
  const againCount = useMemo(
    () => state.answers.filter((a) => a === "again").length,
    [state.answers],
  );
  const canUndo =
    state.index > 0 || state.answers.some((a) => a !== null);

  // --- autoplay ---------------------------------------------------------
  // The autoplay loop needs the latest index on each iteration; expose it
  // via a ref-based getter. Update the ref in an effect (not during render).
  const indexRef = useRef(state.index);
  useEffect(() => {
    indexRef.current = state.index;
  }, [state.index]);

  const autoplay = useAutoplay({
    queue: state.queue,
    getIndex: () => indexRef.current,
    // Autoplay marks each card as 'again' (unless the user already
    // answered) so reaching the end naturally lands on the done screen
    // with all unseen words queued for re-study.
    onStep: () => dispatch({ type: "autoStep" }),
    onReveal: () => dispatch({ type: "revealAll" }),
    getSettings: () => audioSettingsRef.current,
  });

  // User interactions stop autoplay. Wrap dispatch so *any* dispatched
  // action (answer, undo, shuffle, reveal toggles, etc.) halts playback.
  const dispatchAndStop = useCallback(
    (action) => {
      if (autoplay.isPlaying) autoplay.stop();
      dispatch(action);
    },
    [autoplay, dispatch],
  );

  // Starting autoplay should flip autoReveal on so the learner can read the
  // card while the audio sweeps through. (Leaving it off meant the pinyin/
  // meaning stayed hidden even though the audio was already saying them.)
  // We don't flip it off again on stop — the user can toggle manually.
  const startAutoplay = useCallback(() => {
    if (!state.autoReveal) dispatch({ type: "toggleAutoReveal" });
    autoplay.start();
  }, [autoplay, dispatch, state.autoReveal]);

  // Same for direct audio (word/example region clicks): stop autoplay first.
  const playWordAndStop = useCallback(
    (word) => {
      if (autoplay.isPlaying) autoplay.stop();
      playWord(word);
    },
    [autoplay],
  );
  const playExampleAndStop = useCallback(
    (word) => {
      if (autoplay.isPlaying) autoplay.stop();
      playExample(word);
    },
    [autoplay],
  );

  // --- keyboard ---------------------------------------------------------
  useEffect(() => {
    function onKey(e) {
      if (e.key === "1" || e.key === "ArrowLeft")
        dispatchAndStop({ type: "answer", answer: "again" });
      else if (e.key === "2" || e.key === "ArrowRight")
        dispatchAndStop({ type: "answer", answer: "know" });
      else if (e.key === "z") dispatchAndStop({ type: "undo" });
      else if (e.key === "m")
        dispatchAndStop({ type: "reveal", field: "meaning" });
      else if (e.key === "p")
        dispatchAndStop({ type: "reveal", field: "pinyin" });
      else if (e.key === "h") dispatchAndStop({ type: "hide" });
      else if (e.key === " ") {
        e.preventDefault();
        if (autoplay.isPlaying) autoplay.stop();
        else startAutoplay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatchAndStop, autoplay, startAutoplay]);

  // Stop any audio on unmount.
  useEffect(() => stopAudio, []);

  // --- render -----------------------------------------------------------
  const handleBack = () => {
    if (autoplay.isPlaying) autoplay.stop();
    stopAudio();
    onBack();
  };

  if (isDone) {
    const allKnown = againCount === 0;
    return (
      <div className="learn-view">
        <div className="navbar">
          <button
            className="nav-btn"
            onClick={handleBack}
            aria-label="뒤로"
          >
            <ChevronLeft />
          </button>
          <div className="navbar-title">{title}</div>
          <div />
        </div>
        {allKnown ? (
          <DoneAllKnown
            count={total}
            onBack={handleBack}
          />
        ) : (
          <DoneWithAgain
            knowCount={knowCount}
            againCount={againCount}
            onRedo={() => dispatchAndStop({ type: "redoAgain" })}
            onStop={handleBack}
          />
        )}
      </div>
    );
  }

  const progressPct =
    total > 0 ? ((state.index + 1) / total) * 100 : 0;

  return (
    <div className="learn-view">
      <div className="navbar">
        <button
          className="nav-btn"
          onClick={handleBack}
          aria-label="뒤로"
        >
          <ChevronLeft />
        </button>
        <div className="navbar-title">{title}</div>
        <div className="navbar-actions">
          <button
            className={`shuffle-btn${state.shuffled ? " active" : ""}`}
            onClick={() => dispatchAndStop({ type: "toggleShuffle" })}
            title="전체 셔플"
            aria-pressed={state.shuffled}
            aria-label="전체 셔플"
          >
            <Shuffle />
          </button>
          <AudioSettingsMenu
            settings={audioSettings}
            onChange={updateAudioSettings}
          />
        </div>
      </div>

      <div className="progress-row">
        <div className="progress-count">
          {state.index + 1}/{total}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="progress-dot"
            style={{ left: `${progressPct}%` }}
          />
        </div>
        <div className="answer-counts" aria-label="답변 통계">
          <span className="count-badge again" title="다시 학습">{againCount}</span>
          <span className="count-badge know" title="알고있음">{knowCount}</span>
        </div>
      </div>

      <Card
        key={current.id}
        word={current}
        script={state.script}
        reveal={state.reveal}
        favorited={favorites?.has(current.id) ?? false}
        autoReveal={state.autoReveal}
        onPlayWord={playWordAndStop}
        onPlayExample={playExampleAndStop}
        onSetScript={(s) =>
          dispatchAndStop({ type: "setScript", script: s })
        }
        onToggleAutoReveal={() =>
          dispatchAndStop({ type: "toggleAutoReveal" })
        }
        onToggleFavorite={() => {
          if (autoplay.isPlaying) autoplay.stop();
          onToggleFavorite?.(current.id);
        }}
        onRevealMeaning={() =>
          dispatchAndStop({ type: "reveal", field: "meaning" })
        }
        onRevealPinyin={() =>
          dispatchAndStop({ type: "reveal", field: "pinyin" })
        }
        onRevealAll={() => dispatchAndStop({ type: "revealAll" })}
        onHide={() => dispatchAndStop({ type: "hide" })}
      />

      <div className="action-bar">
        <button
          className="action-icon undo"
          onClick={() => dispatchAndStop({ type: "undo" })}
          disabled={!canUndo}
          title="되돌리기 (Z)"
          aria-label="되돌리기"
        >
          <Undo />
        </button>
        <div className="action-pills">
          <button
            className="action-pill again"
            onClick={() =>
              dispatchAndStop({ type: "answer", answer: "again" })
            }
          >
            다시 학습
          </button>
          <button
            className="action-pill know"
            onClick={() =>
              dispatchAndStop({ type: "answer", answer: "know" })
            }
          >
            알고있음
          </button>
        </div>
        <button
          className={`action-icon autoplay${autoplay.isPlaying ? " playing" : ""}`}
          onClick={() =>
            autoplay.isPlaying ? autoplay.stop() : startAutoplay()
          }
          title="자동 재생 (Space)"
          aria-label={
            autoplay.isPlaying ? "자동 재생 정지" : "자동 재생 시작"
          }
          aria-pressed={autoplay.isPlaying}
        >
          {autoplay.isPlaying ? <Pause /> : <Play />}
        </button>
      </div>
    </div>
  );
}

function DoneAllKnown({ count, onBack }) {
  return (
    <div className="done all-known">
      <div className="done-glyph">好</div>
      <div className="done-title">완벽해요!</div>
      <div className="done-sub">{count}개 단어 모두 알고 있어요</div>
      <button
        className="done-btn primary"
        onClick={onBack}
      >
        챕터로 돌아가기
      </button>
    </div>
  );
}

function DoneWithAgain({ knowCount, againCount, onRedo, onStop }) {
  return (
    <div className="done">
      <div className="done-glyph">学</div>
      <div className="done-title">한 바퀴 완료!</div>
      <div className="done-stats">
        <div>
          <div className="stat-num">{knowCount}</div>
          <div className="stat-label">알고있음</div>
        </div>
        <div>
          <div className="stat-num again-num">{againCount}</div>
          <div className="stat-label">다시 학습</div>
        </div>
      </div>
      <div className="done-buttons">
        <button
          className="done-btn primary"
          onClick={onRedo}
        >
          모르는 단어 다시 학습
        </button>
        <button
          className="done-btn secondary"
          onClick={onStop}
        >
          그만하기
        </button>
      </div>
    </div>
  );
}
