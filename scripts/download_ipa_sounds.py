#!/usr/bin/env python3
"""
Download IPA phoneme sound clips for the /learn page.

Uses the Wikimedia Commons API to resolve actual download URLs (avoids
MD5-hash path issues). Files are saved to app/public/ipa/sounds/.

Usage:
    python scripts/download_ipa_sounds.py [--dry-run]
"""

import sys
import time
import urllib.request
import urllib.parse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "app" / "public" / "ipa" / "sounds"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Nounce-phonetics-app/1.0 (https://nounce.pro; contact@nounce.pro)"
}

# Maps output filename -> Wikimedia Commons source filename
# Vowels use pure IPA recordings; consonants use English-specific where available.
SOUND_MAP: dict[str, str] = {
    # Monophthong vowels
    "i.ogg":  "Close_front_unrounded_vowel.ogg",
    "e.ogg":  "Close-mid_front_unrounded_vowel.ogg",
    "ae.ogg": "Near-open_front_unrounded_vowel.ogg",
    "A.ogg":  "Open_back_unrounded_vowel.ogg",
    "O.ogg":  "Open-mid_back_rounded_vowel.ogg",
    "u.ogg":  "Close_back_rounded_vowel.ogg",
    "V.ogg":  "Open-mid_back_unrounded_vowel.ogg",
    "3.ogg":  "Open-mid_central_unrounded_vowel.ogg",
    "schwa.ogg": "Mid-central_vowel.ogg",
    # Near-close vowels
    "I.ogg":  "Near-close_near-front_unrounded_vowel.ogg",
    "U.ogg":  "Near-close_near-back_rounded_vowel.ogg",
    # RP /ɒ/ — open back rounded
    "Q.ogg":  "Open_back_rounded_vowel.ogg",
    # Consonants
    "p.ogg":  "Voiceless_bilabial_plosive.ogg",
    "b.ogg":  "Voiced_bilabial_plosive.ogg",
    "t.ogg":  "Voiceless_alveolar_plosive.ogg",
    "d.ogg":  "Voiced_alveolar_plosive.ogg",
    "k.ogg":  "Voiceless_velar_plosive.ogg",
    "g.ogg":  "Voiced_velar_plosive.ogg",
    "f.ogg":  "Voiceless_labiodental_fricative.ogg",
    "v.ogg":  "Voiced_labiodental_fricative.ogg",
    "th.ogg": "Voiceless_dental_fricative.ogg",
    "dh.ogg": "Voiced_dental_fricative.ogg",
    "s.ogg":  "Voiceless_alveolar_sibilant.ogg",
    "z.ogg":  "Voiced_alveolar_sibilant.ogg",
    "sh.ogg": "Voiceless_palato-alveolar_sibilant.ogg",
    "zh.ogg": "Voiced_palato-alveolar_sibilant.ogg",
    "h.ogg":  "Voiceless_glottal_fricative.ogg",
    "tsh.ogg":"Voiceless_palato-alveolar_affricate.ogg",
    "dzh.ogg":"Voiced_palato-alveolar_affricate.ogg",
    "m.ogg":  "Bilabial_nasal.ogg",
    "n.ogg":  "Alveolar_nasal.ogg",
    "ng.ogg": "Velar_nasal.ogg",
    "l.ogg":  "Alveolar_lateral_approximant.ogg",
    "r.ogg":  "Alveolar_approximant.ogg",
    "j.ogg":  "Palatal_approximant.ogg",
    "w.ogg":  "Voiced_labio-velar_approximant.ogg",
}

# These are the actual filenames used in learn.tsx soundAudio fields.
# Maps our output name -> the path referenced in learn.tsx.
LEARN_MAP: dict[str, str] = {
    "i.ogg":     "ipa/sounds/i.ogg",
    "I.ogg":     "ipa/sounds/ɪ.ogg",
    "e.ogg":     "ipa/sounds/e.ogg",
    "ae.ogg":    "ipa/sounds/æ.ogg",
    "A.ogg":     "ipa/sounds/ɑ.ogg",
    "Q.ogg":     "ipa/sounds/ɒ.ogg",
    "O.ogg":     "ipa/sounds/ɔ.ogg",
    "U.ogg":     "ipa/sounds/ʊ.ogg",
    "u.ogg":     "ipa/sounds/u.ogg",
    "V.ogg":     "ipa/sounds/ʌ.ogg",
    "3.ogg":     "ipa/sounds/ɜ.ogg",
    "schwa.ogg": "ipa/sounds/ə.ogg",
    "p.ogg":     "ipa/sounds/p.ogg",
    "b.ogg":     "ipa/sounds/b.ogg",
    "t.ogg":     "ipa/sounds/t.ogg",
    "d.ogg":     "ipa/sounds/d.ogg",
    "k.ogg":     "ipa/sounds/k.ogg",
    "g.ogg":     "ipa/sounds/g.ogg",
    "f.ogg":     "ipa/sounds/f.ogg",
    "v.ogg":     "ipa/sounds/v.ogg",
    "th.ogg":    "ipa/sounds/θ.ogg",
    "dh.ogg":    "ipa/sounds/ð.ogg",
    "s.ogg":     "ipa/sounds/s.ogg",
    "z.ogg":     "ipa/sounds/z.ogg",
    "sh.ogg":    "ipa/sounds/ʃ.ogg",
    "zh.ogg":    "ipa/sounds/ʒ.ogg",
    "h.ogg":     "ipa/sounds/h.ogg",
    "tsh.ogg":   "ipa/sounds/ch.ogg",
    "dzh.ogg":   "ipa/sounds/dʒ.ogg",
    "m.ogg":     "ipa/sounds/m.ogg",
    "n.ogg":     "ipa/sounds/n.ogg",
    "ng.ogg":    "ipa/sounds/ŋ.ogg",
    "l.ogg":     "ipa/sounds/l.ogg",
    "r.ogg":     "ipa/sounds/r.ogg",
    "j.ogg":     "ipa/sounds/j.ogg",
    "w.ogg":     "ipa/sounds/w.ogg",
}

# Diphthongs — need a separate source (not on Wikimedia Commons as isolated sounds).
DIPHTHONG_WAVS = {"ei.wav", "ai.wav", "oi.wav", "au.wav", "ou.wav", "ia.wav", "ea.wav", "ua.wav"}


def get_wikimedia_url(filename: str) -> str | None:
    """Use the Wikimedia Commons API to get the actual download URL for a file."""
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
    }
    url = api + "?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        r = urllib.request.urlopen(req, timeout=15)
        data = json.loads(r.read())
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            info = page.get("imageinfo", [])
            if info:
                return info[0].get("url")
    except Exception as exc:
        print(f"    API lookup failed for {filename}: {exc}")
    return None


def download(url: str, dest: Path) -> bool:
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            r = urllib.request.urlopen(req, timeout=30)
            dest.write_bytes(r.read())
            return True
        except Exception as exc:
            if "429" in str(exc):
                wait = 15 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s ...")
                time.sleep(wait)
                continue
            print(f"    error: {exc}")
            time.sleep(3)
    return False


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ok = skipped = failed = 0

    for out_key, wiki_name in SOUND_MAP.items():
        # The actual output path uses the IPA-symbol name from LEARN_MAP
        learn_path = LEARN_MAP.get(out_key)
        if learn_path:
            out_path = REPO_ROOT / "app" / "public" / learn_path
        else:
            out_path = OUTPUT_DIR / out_key

        out_path.parent.mkdir(parents=True, exist_ok=True)

        if out_path.exists():
            print(f"[SKIP] {out_path.name}")
            skipped += 1
            continue

        print(f"[GET]  {out_path.name} <- {wiki_name}")

        if args.dry_run:
            ok += 1
            continue

        dl_url = get_wikimedia_url(wiki_name)
        if not dl_url:
            print(f"       -> FAILED (not found on Commons)")
            failed += 1
            time.sleep(0.5)
            continue

        if download(dl_url, out_path):
            print(f"       -> saved {out_path.name} ({out_path.stat().st_size} bytes)")
            ok += 1
        else:
            print(f"       -> FAILED")
            failed += 1

        time.sleep(0.5)

    print(f"\nDone: {ok} downloaded, {skipped} skipped, {failed} failed")

    missing_diphthongs = [w for w in DIPHTHONG_WAVS if not (OUTPUT_DIR / w).exists()]
    if missing_diphthongs:
        print(f"Diphthong WAVs missing (need separate source): {missing_diphthongs}")


if __name__ == "__main__":
    main()
