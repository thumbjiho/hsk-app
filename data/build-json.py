"""
HSK 3.0 CSV -> JSON builder with translation merge.

Reads  data/source/hsk30.csv                (immutable vocab source)
       data/translations/hsk-{1..5}.json    (growing hand/AI-curated Korean)
Writes public/data/hsk-{1..5}.json  +  public/data/index.json

Translations file format: array of objects keyed by `id`. Only the fields
listed in TRANSLATABLE_FIELDS are copied into the output; other fields
(id, simplified, ...) are ignored — the CSV is the authority for those.

Handles variant rows (e.g. "爸爸|爸") by keeping the first form as canonical.
"""

import csv
import json
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "hsk30.csv"
TRANS_DIR = ROOT / "data" / "translations"
OUT_DIR = ROOT / "public" / "data"

LEVELS = [1, 2, 3, 4, 5]

# Only these fields in translations/*.json are allowed to override the
# default-empty strings on each word. Everything else in translations is
# kept for readability (e.g. `simplified`) but not trusted over the CSV.
TRANSLATABLE_FIELDS = (
    "meaning_ko",
    "example_zh",
    "example_zh_trad",
    "example_pinyin",
    "example_ko",
)


def first_form(cell: str) -> str:
    return cell.split("|", 1)[0].strip() if cell else ""


def parse_pos(cell: str) -> List[str]:
    if not cell:
        return []
    return [p.strip() for p in cell.split("/") if p.strip()]


def parse_level(cell: str) -> Optional[int]:
    if not cell:
        return None
    head = cell.split("-", 1)[0]
    try:
        return int(head)
    except ValueError:
        return None


def load_translations(level: int) -> Dict[str, dict]:
    """Return a map of word id -> translation overrides."""
    path = TRANS_DIR / f"hsk-{level}.json"
    if not path.exists():
        return {}
    entries = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for entry in entries:
        wid = entry.get("id")
        if not wid:
            continue
        out[wid] = {k: entry[k] for k in TRANSLATABLE_FIELDS if k in entry}
    return out


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    buckets: Dict[int, List[dict]] = {lv: [] for lv in LEVELS}
    translations = {lv: load_translations(lv) for lv in LEVELS}

    with SRC.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            level = parse_level(row.get("Level", ""))
            if level not in LEVELS:
                continue
            word = {
                "id": row["ID"],
                "simplified": first_form(row["Simplified"]),
                "traditional": first_form(row["Traditional"]),
                "pinyin": first_form(row["Pinyin"]),
                "pos": parse_pos(row.get("POS", "")),
                "level": level,
                "meaning_ko": "",
                "example_zh": "",
                "example_zh_trad": "",
                "example_pinyin": "",
                "example_ko": "",
            }
            # Apply translation overrides for this word, if any.
            override = translations[level].get(word["id"])
            if override:
                word.update(override)
            buckets[level].append(word)

    index = []
    for lv in LEVELS:
        words = buckets[lv]
        translated = sum(1 for w in words if w["meaning_ko"])
        out_path = OUT_DIR / f"hsk-{lv}.json"
        out_path.write_text(
            json.dumps(words, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        index.append({
            "level": lv,
            "count": len(words),
            "translated": translated,
            "file": f"hsk-{lv}.json",
        })
        print(f"  hsk-{lv}.json  {len(words):>5} words  ({translated} translated)")

    (OUT_DIR / "index.json").write_text(
        json.dumps({"levels": index}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    total = sum(b["count"] for b in index)
    total_translated = sum(b["translated"] for b in index)
    print(f"  total: {total} words, {total_translated} translated "
          f"({total_translated * 100 // max(total, 1)}%)")


if __name__ == "__main__":
    build()
