"""
Google Cloud Text-to-Speech audio builder.

Per translated word, generates up to 4 mp3s:
  words/{id}.mp3         - Chinese word          (cmn-CN-Wavenet-B, male)
  examples/{id}.mp3      - Chinese example       (cmn-CN-Wavenet-B, male)
  meanings/{id}.mp3      - Korean meaning        (ko-KR-Chirp3-HD-Aoede, female)
  translations/{id}.mp3  - Korean example trans  (ko-KR-Chirp3-HD-Aoede, female)

Male Chinese / female Korean is intentional — the gender contrast helps
the listener parse which language they're hearing during autoplay.

Usage:
  python3 data/build-audio-google.py            # WaveNet   -> public/audio/google/
  python3 data/build-audio-google.py --chirp3   # Chirp3 HD -> public/audio/chirp3/

Setup (simplest — uses your gcloud login, no service-account key needed):
  1. pip3 install --user google-cloud-texttospeech
  2. gcloud auth application-default login
  3. gcloud services enable texttospeech.googleapis.com  (if not already on)

Idempotent: skips any mp3 that already exists on disk, so re-running after
adding new translations only generates the new files.

Pricing (Apr 2026): WaveNet $16/1M chars, Chirp3 HD $30/1M. 1M chars free
per month. 4,316 words × 4 clips ≈ 250k chars total — well inside the tier.
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from google.cloud import texttospeech  # type: ignore
except ImportError:
    sys.exit(
        "google-cloud-texttospeech is not installed.\n"
        "Run: pip3 install --user google-cloud-texttospeech"
    )

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT / "public" / "data"
LEVELS = [1, 2, 3, 4, 5]

# Per-model configuration. The inner "clips" entries map one word field to
# (text_field, voice_name, language_code, speaking_rate, output_subdir).
MODELS = {
    "wavenet": {
        # Chinese: WaveNet (user A/B-preferred over Chirp3 for Mandarin).
        # Korean:  Chirp3 HD (Aoede) — the newer generation sounds more
        # natural for Korean than WaveNet-A in our ears; swap the name
        # below if you want to try other HD voices (e.g. Kore, Leda, Aoede).
        "out_dir": ROOT / "public" / "audio" / "google",
        "clips": [
            ("simplified",  "cmn-CN-Wavenet-B",      "cmn-CN", 0.85, "words"),
            ("example_zh",  "cmn-CN-Wavenet-B",      "cmn-CN", 0.9,  "examples"),
            ("meaning_ko",  "ko-KR-Chirp3-HD-Aoede", "ko-KR",  1.0,  "meanings"),
            ("example_ko",  "ko-KR-Chirp3-HD-Aoede", "ko-KR",  1.0,  "translations"),
        ],
    },
    "chirp3": {
        "out_dir": ROOT / "public" / "audio" / "chirp3",
        "clips": [
            ("simplified",  "cmn-CN-Chirp3-HD-Charon", "cmn-CN", 0.85, "words"),
            ("example_zh",  "cmn-CN-Chirp3-HD-Charon", "cmn-CN", 0.95, "examples"),
            ("meaning_ko",  "ko-KR-Wavenet-A",         "ko-KR",  0.95, "meanings"),
            ("example_ko",  "ko-KR-Wavenet-A",         "ko-KR",  0.95, "translations"),
        ],
    },
}


def synth(client, text: str, voice_name: str, language_code: str,
          rate: float, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=rate,
        ),
    )
    out_path.write_bytes(response.audio_content)


def build(model_key: str) -> None:
    cfg = MODELS[model_key]

    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        sys.exit(
            f"Could not find Google credentials: {e}\n"
            "Run `gcloud auth application-default login` or set "
            "GOOGLE_APPLICATION_CREDENTIALS."
        )

    # Collect all words across HSK levels. Only generate audio for words
    # that have content — skip files that already exist on disk.
    all_words = []
    for lv in LEVELS:
        path = PUBLIC_DATA_DIR / f"hsk-{lv}.json"
        if not path.exists():
            continue
        all_words.extend(json.loads(path.read_text(encoding="utf-8")))

    translated = [w for w in all_words if w.get("meaning_ko")]
    print(f"Building {model_key} audio for {len(translated)} translated words "
          f"(of {len(all_words)} total)...")

    new_count = 0
    for w in translated:
        word_id = w["id"]
        for field, voice, lang, rate, subdir in cfg["clips"]:
            text = w.get(field, "")
            if not text:
                continue
            out_path = cfg["out_dir"] / subdir / f"{word_id}.mp3"
            if out_path.exists():
                continue
            synth(client, text, voice, lang, rate, out_path)
            new_count += 1

    print(f"Done -> {cfg['out_dir'].relative_to(ROOT)} ({new_count} new files)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--chirp3", action="store_const", const="chirp3",
                        dest="model", help="Use Chirp3 HD voices")
    parser.add_argument("--wavenet", action="store_const", const="wavenet",
                        dest="model", help="Use WaveNet voices (default)")
    parser.set_defaults(model="wavenet")
    args = parser.parse_args()
    build(args.model)
