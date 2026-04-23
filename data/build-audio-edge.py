"""
Microsoft Edge TTS audio builder (free, no API key).

Generates one mp3 per word and per example sentence. Both use the same
male voice for a unified sound; rate differs (words slower, examples
closer to natural pace).

  public/audio/edge/words/{id}.mp3       <- zh-CN-YunxiNeural (male)
  public/audio/edge/examples/{id}.mp3    <- zh-CN-YunxiNeural (male)

Install:  pip3 install --user edge-tts
Run:      python3 data/build-audio-edge.py
"""

import asyncio
import json
from pathlib import Path

import edge_tts  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "src" / "data" / "sample.json"
OUT_WORDS = ROOT / "public" / "audio" / "edge" / "words"
OUT_EXAMPLES = ROOT / "public" / "audio" / "edge" / "examples"

VOICE_WORD = "zh-CN-YunxiNeural"         # male, clear, natural
VOICE_EXAMPLE = "zh-CN-YunxiNeural"      # same voice, differentiated by rate

# Slow down slightly for learners. edge-tts rate takes "+N%" / "-N%" strings.
RATE_WORD = "-15%"
RATE_EXAMPLE = "-10%"


async def synth(text: str, voice: str, rate: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(out_path))


async def build():
    words = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"Building Edge TTS audio for {len(words)} words...")

    tasks = []
    for w in words:
        word_id = w["id"]
        word_text = w["simplified"]
        example_text = w["example_zh"]

        tasks.append(synth(word_text, VOICE_WORD, RATE_WORD,
                           OUT_WORDS / f"{word_id}.mp3"))
        if example_text:
            tasks.append(synth(example_text, VOICE_EXAMPLE, RATE_EXAMPLE,
                               OUT_EXAMPLES / f"{word_id}.mp3"))

    # Run in parallel but cap concurrency so we don't get rate-limited.
    sem = asyncio.Semaphore(8)
    async def guarded(coro):
        async with sem:
            await coro
    await asyncio.gather(*(guarded(t) for t in tasks))

    print(f"  wrote {len(list(OUT_WORDS.glob('*.mp3')))} word files -> {OUT_WORDS.relative_to(ROOT)}")
    print(f"  wrote {len(list(OUT_EXAMPLES.glob('*.mp3')))} example files -> {OUT_EXAMPLES.relative_to(ROOT)}")


if __name__ == "__main__":
    asyncio.run(build())
