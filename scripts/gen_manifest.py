#!/usr/bin/env python3
"""
gen_manifest.py — (re)generate data/manifest.json, the prompt index the verify harness maps to.

Sources of truth:
  - doc/validation_sentences.md   -> the 25 reference sentences (ref_001..ref_025)
  - app/src/routes/learn.tsx       -> the /learn IPA_AUDIO_MAP example words (word_NN)

The manifest lists, in recording order, every prompt the takes should contain: 25 sentences
then the /learn words. A few words back two distinct /learn files (cat->cat.wav+cat-k.wav, go,
sit) and were recorded twice; the first take is the primary slot and the second is appended as
an extra slot (word_41+). Recordings live on disk under references/<author>/ and learn/<author>/
and are discovered by mod/dev/verify.py — they are NOT listed here.

Run from repo root:  python scripts/gen_manifest.py
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VALIDATION_MD = REPO / "doc" / "validation_sentences.md"
LEARN_TSX = REPO / "app" / "src" / "routes" / "learn.tsx"
DATA = REPO / "data"


def parse_references() -> list[dict]:
    text = VALIDATION_MD.read_text(encoding="utf-8")
    row_re = re.compile(r"^\|\s*`(ref_\d{3})`\s*\|\s*(.+?)\s*\|", re.MULTILINE)
    refs = [{"id": m.group(1), "text": m.group(2)} for m in row_re.finditer(text)]
    if not refs:
        sys.exit(f"ERROR: no ref_NNN rows found in {VALIDATION_MD}")
    return refs


def parse_learn_words() -> list[dict]:
    """One slot per recorded TAKE (single dest each); second takes of dual-dest words (cat, go,
    sit) are appended as word_41+ in map order, matching how the orders append them at the end."""
    text = LEARN_TSX.read_text(encoding="utf-8")
    entry_re = re.compile(
        r'(\S+):\s*\{\s*word:\s*"([^"]+)",\s*wordAudio:\s*"([^"]+)"', re.MULTILINE
    )
    primaries: dict[str, dict] = {}
    order: list[str] = []
    extras: list[dict] = []
    for phoneme, word, dest in entry_re.findall(text):
        phoneme = phoneme.strip("\"'")
        if word not in primaries:
            primaries[word] = {"word": word, "phonemes": [phoneme], "dest": dest}
            order.append(word)
            continue
        p = primaries[word]
        if dest == p["dest"]:
            if phoneme not in p["phonemes"]:
                p["phonemes"].append(phoneme)
        elif not any(e["word"] == word and e["dest"] == dest for e in extras):
            extras.append({"word": word, "phonemes": [phoneme], "dest": dest})
    if not primaries:
        sys.exit(f"ERROR: no IPA_AUDIO_MAP word entries found in {LEARN_TSX}")
    slots = [primaries[w] for w in order] + extras
    return [{"id": f"word_{i:02d}", **s} for i, s in enumerate(slots, start=1)]


def main() -> None:
    refs = parse_references()
    words = parse_learn_words()
    manifest = {
        "_note": "Prompt index (reference sentences + /learn word->dest mapping). Recordings live "
                 "on disk under references/<author>/ and learn/<author>/ and are discovered by "
                 "mod/dev/verify.py. Author metadata is in data/authors.json. Regenerate with "
                 "scripts/gen_manifest.py.",
        "references": [{"id": r["id"], "text": r["text"]} for r in refs],
        "learn_words": words,
    }
    (DATA / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"manifest -> data/manifest.json  ({len(refs)} sentences, {len(words)} words)")


if __name__ == "__main__":
    main()
