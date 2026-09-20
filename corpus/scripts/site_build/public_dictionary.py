"""Build a corpus-sized, attributed IPA reference from a pinned public dictionary.

python -m corpus.scripts.site_build.public_dictionary --dictionary PATH --data PATH --out PATH
Stress is retained as one label per vowel, not guessed syllable boundaries.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from .reference_ipa import word_key

SOURCE = {
    "name": "English (US) ARPA dictionary",
    "version": "3.0.0",
    "dialect": "General American English",
    "author": "Montreal Forced Aligner; Gorman, Howell and Wagner",
    "url": "https://mfa-models.readthedocs.io/en/latest/dictionary/English/English%20(US)%20ARPA%20dictionary%20v3_0_0.html",
    "download": "https://github.com/MontrealCorpusTools/mfa-models/releases/download/dictionary-english_us_arpa-v3.0.0/english_us_arpa.dict",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "adaptation": "ARPABET converted to broad IPA; vowel stress shown separately. Not the corpus annotator's reference.",
}
SHA256 = "e8c6c7b036ae2b7c78d2768b8dc6b1f9359175b842956d00b48c53c9c332e6b0"

PHONES = dict(zip(
    "AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH".split(),
    "ɑ æ ʌ ɔ aʊ aɪ b tʃ d ð ɛ ɝ eɪ f ɡ h ɪ i dʒ k l m n ŋ oʊ ɔɪ p ɹ s ʃ t θ ʊ u v w j z ʒ".split(),
    strict=True,
))
STRESS = {"0": "unstressed", "1": "primary", "2": "secondary"}


def convert(phones: list[str]) -> dict:
    ipa, stress = [], []
    for phone in phones:
        level = phone[-1] if phone[-1] in STRESS else None
        symbol = phone[:-1] if level is not None else phone
        if symbol not in PHONES:
            raise ValueError(f"Unsupported dictionary phone: {phone}")
        ipa.append("ə" if phone == "AH0" else "ɚ" if phone == "ER0" else PHONES[symbol])
        if level is not None:
            stress.append(STRESS[level])
    return {"ipa": "".join(ipa), "stress": stress}


def generate(dictionary: Path, data: Path) -> dict:
    targets = set()
    for area in ("vowels", "consonants", "stress"):
        for path in (data / "tokens" / area).glob("*.json"):
            for row in json.loads(path.read_text(encoding="utf-8")):
                if row.get("w"):
                    targets.add(word_key(row["w"]))
    raw = dictionary.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("Dictionary checksum differs from the pinned v3.0.0 source")
    entries: dict[str, list] = {}
    for line in raw.decode("utf-8-sig").splitlines():
        fields = line.split()
        if not fields or fields[0].startswith("#"):
            continue
        word = word_key(fields[0])
        if word not in targets:
            continue
        start = 1
        while start < len(fields):
            try:
                float(fields[start])
                start += 1
            except ValueError:
                break
        if start == len(fields):
            raise ValueError(f"Missing pronunciation: {word}")
        variant = convert(fields[start:])
        bucket = entries.setdefault(word, [])
        if variant not in bucket:
            bucket.append(variant)
    return {"source": {**SOURCE, "sha256": hashlib.sha256(raw).hexdigest()},
            "entries": dict(sorted(entries.items())), "unmatched": sorted(targets - entries.keys())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = generate(args.dictionary, args.data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Matched {len(result['entries'])} word forms; unmatched: {result['unmatched']}")
