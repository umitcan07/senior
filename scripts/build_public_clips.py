#!/usr/bin/env python3
"""
Build the bundled, BLIND audio set for the /intelligibility-score page from the
private rating manifest (sig/validation/clips.json).

For each clip it transcodes the source wav -> <out>/<clip_id>.mp3 (filename is the
opaque clip_id, NOT the speaker, so the deployed page leaks no identity), and writes
<out>/clips.json containing only {clip_id, file, sentence, is_anchor} — speaker is
dropped. The clip_id -> speaker mapping stays private in sig/validation/clips.json
for the #35 analysis join.

Needs ffmpeg + the real source audio (run on the pod / after `git lfs pull`).

Usage:
    python scripts/build_public_clips.py --out app/public/intelligibility
"""

import argparse
import json
import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="sig/validation/clips.json")
    ap.add_argument("--out", default="app/public/intelligibility")
    ap.add_argument("--bitrate", default="96k")
    args = ap.parse_args()

    src = json.loads((REPO / args.manifest).read_text(encoding="utf-8"))
    out = REPO / args.out
    out.mkdir(parents=True, exist_ok=True)

    public = []
    missing = 0
    for c in src["clips"]:
        wav = REPO / c["audio"]
        mp3 = out / f"{c['clip_id']}.mp3"
        if not wav.exists():
            print(f"  [miss] {c['clip_id']}: {wav}")
            missing += 1
            continue
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav), "-ar", "16000", "-ac", "1",
             "-b:a", args.bitrate, str(mp3)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        public.append({
            "clip_id": c["clip_id"],
            "file": f"{c['clip_id']}.mp3",
            "sentence": c["sentence"],
            "is_anchor": c["_is_anchor"],
        })

    (out / "clips.json").write_text(
        json.dumps({"n_clips": len(public), "clips": public}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    print(f"\nwrote {len(public)} mp3 + clips.json -> {out}  ({missing} missing source)")


if __name__ == "__main__":
    main()
