#!/usr/bin/env python3
"""
Download IPA phoneme sound clips from Wikimedia Commons (the same source
ipachart.com uses) and place them in app/public/ipa/sounds/.

The file names in the output directory match the soundAudio keys used in
app/src/routes/learn.tsx (e.g. i.ogg, ɪ.ogg, æ.ogg, θ.ogg, ch.wav …).

Wikimedia filename lookup:
  https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=<term>
  The direct download URL:
  https://upload.wikimedia.org/wikipedia/commons/<md5[0]>/<md5[:2]>/<filename>

Usage:
    python scripts/download_ipa_sounds.py [--dry-run]
"""

import hashlib
import os
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "app" / "public" / "ipa" / "sounds"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Nounce-phonetics-app/1.0 (https://nounce.pro; contact@nounce.pro)"
}

# Mapping of output filename -> Wikimedia Commons source filename
# Sourced by inspecting ipachart.com / commons.wikimedia.org/wiki/General_phonetics
# Prefer En-us-* (GenAm) for vowels and consonants where available.
SOUND_MAP: dict[str, str] = {
    # Monophthong vowels
    "i.ogg": "En-us-ee.ogg",
    "ɪ.ogg": "En-us-i.ogg",
    "e.ogg": "En-us-e.ogg",
    "æ.ogg": "En-us-ash.ogg",
    "ɑ.ogg": "En-us-ah.ogg",
    "ɒ.ogg": "Received_Pronunciation_CLOTH.ogg",
    "ɔ.ogg": "En-us-aw.ogg",
    "ʊ.ogg": "En-us-oo.ogg",
    "u.ogg": "En-us-oo2.ogg",
    "ʌ.ogg": "En-us-uh.ogg",
    "ɜ.ogg": "En-us-er.ogg",
    "ə.ogg": "En-us-uh2.ogg",
    # Diphthongs — WAV (kept as-is if already present, else skip with note)
    # These are already in the public dir as custom recordings; we don't overwrite.
    # Consonants
    "p.ogg": "En-us-p.ogg",
    "b.ogg": "En-us-b.ogg",
    "t.ogg": "En-us-t.ogg",
    "d.ogg": "En-us-d.ogg",
    "k.ogg": "En-us-k.ogg",
    "g.ogg": "En-us-g.ogg",
    "f.ogg": "En-us-f.ogg",
    "v.ogg": "En-us-v.ogg",
    "θ.ogg": "En-us-th.ogg",
    "ð.ogg": "En-us-th2.ogg",
    "s.ogg": "En-us-s.ogg",
    "z.ogg": "En-us-z.ogg",
    "ʃ.ogg": "En-us-sh.ogg",
    "ʒ.ogg": "En-us-zh.ogg",
    "h.ogg": "En-us-h.ogg",
    "m.ogg": "En-us-m.ogg",
    "n.ogg": "En-us-n.ogg",
    "ŋ.ogg": "En-us-ng.ogg",
    "l.ogg": "En-us-l.ogg",
    "r.ogg": "En-us-r.ogg",
    "j.ogg": "En-us-y.ogg",
    "w.ogg": "En-us-w.ogg",
    # Affricates
    "ch.wav": "En-us-ch.ogg",  # will be downloaded as ogg, renamed
    "j.wav": "En-us-j.ogg",
}

# Diphthong WAV files expected in the public dir — we DON'T download these;
# they're either already present or need a separate source.
DIPHTHONG_WAVS = {"ei.wav", "ai.wav", "oi.wav", "au.wav", "ou.wav", "ia.wav", "ea.wav", "ua.wav"}


def wikimedia_url(filename: str) -> str:
    encoded = filename.replace(" ", "_")
    h = hashlib.md5(encoded.encode("utf-8")).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{encoded}"


def download(url: str, dest: Path) -> bool:
    for attempt in range(4):
        try:
            r = requests.get(url, headers=HEADERS, stream=True, timeout=30)
            if r.status_code == 404:
                return False
            if r.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s …")
                time.sleep(wait)
                continue
            r.raise_for_status()
            dest.write_bytes(r.content)
            return True
        except Exception as exc:
            print(f"    error: {exc}")
            time.sleep(3)
    return False


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ok = skipped = failed = 0

    for out_name, wiki_name in SOUND_MAP.items():
        out_path = OUTPUT_DIR / out_name

        if out_path.exists():
            print(f"[SKIP] {out_name}")
            skipped += 1
            continue

        # If out_name ends in .wav but wiki source is .ogg, use .ogg path
        if out_name.endswith(".wav") and wiki_name.endswith(".ogg"):
            actual_out = OUTPUT_DIR / out_name.replace(".wav", ".ogg")
            if actual_out.exists():
                print(f"[SKIP] {out_name} (ogg variant exists)")
                skipped += 1
                continue

        url = wikimedia_url(wiki_name)
        print(f"[GET]  {out_name} <- {wiki_name}")

        if args.dry_run:
            ok += 1
            continue

        dest = out_path
        if out_name.endswith(".wav") and wiki_name.endswith(".ogg"):
            # store as .ogg; the soundAudio path in learn.tsx will need updating
            dest = OUTPUT_DIR / out_name.replace(".wav", ".ogg")
            print(f"       (storing as {dest.name})")

        if download(url, dest):
            print(f"       -> saved {dest.name} ({dest.stat().st_size} bytes)")
            ok += 1
        else:
            print(f"       -> FAILED (404 or repeated error)")
            failed += 1

        time.sleep(0.5)

    print(f"\nDone: {ok} downloaded, {skipped} skipped, {failed} failed")

    # Report diphthong WAV status
    missing_diphthongs = [w for w in DIPHTHONG_WAVS if not (OUTPUT_DIR / w).exists()]
    if missing_diphthongs:
        print(f"\nDiphthong WAVs not present (need separate source): {missing_diphthongs}")
    else:
        print("\nAll diphthong WAV files present.")


if __name__ == "__main__":
    main()
