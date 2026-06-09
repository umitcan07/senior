#!/usr/bin/env python3
"""
Build the clips manifest for the blind intelligibility-rating harness (E6 #34).

Scans learner recordings (data/test_recordings/<speaker>/ref_NNN.wav) and a sample
of native reference clips (data/references/<author>/ref_NNN.wav, as high-intelligibility
ANCHORS / scale controls), joins each to its sentence text from data/manifest.json, and
writes sig/validation/clips.json — the input to sig/validation/rate.html.

The harness is BLIND: speaker id and anchor flag are stored under underscore-prefixed
keys (`_speaker`, `_is_anchor`, `_ref`) that the rater UI never displays; they exist only
so the analysis step (#35) can join clip_id -> speaker/sentence and the system score.

No audio is read here — it only needs the filenames to exist (LFS pointers are fine), so
this runs anywhere. Re-run after splitting a new speaker (e.g. umut) to include them.

Usage:
    python scripts/build_rating_manifest.py                 # all learners + 12 native anchors
    python scripts/build_rating_manifest.py --anchors 0     # learners only
    python scripts/build_rating_manifest.py --learners erem omer umit ibrahim umut
"""

import argparse
import json
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def load_sentences() -> dict[str, str]:
    m = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    return {r["id"]: r["text"] for r in m.get("references", [])}


def scan_speaker(spk_dir: Path) -> list[str]:
    """Sorted list of ref ids (ref_NNN) with a wav present for this speaker."""
    return sorted(p.stem for p in spk_dir.glob("ref_*.wav"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-recordings", default="data/test_recordings")
    ap.add_argument("--references", default="data/references")
    ap.add_argument("--learners", nargs="*", default=None,
                    help="speaker dir names to include (default: all under test-recordings)")
    ap.add_argument("--anchors", type=int, default=12,
                    help="number of native reference clips to mix in as blind scale anchors")
    ap.add_argument("--out", default="sig/validation/clips.json")
    args = ap.parse_args()

    sentences = load_sentences()
    tr_root = REPO / args.test_recordings
    ref_root = REPO / args.references

    clips: list[dict] = []
    cid = 0

    def add(audio_rel: str, ref_id: str, speaker: str, is_anchor: bool) -> None:
        nonlocal cid
        cid += 1
        clips.append({
            "clip_id": f"c{cid:04d}",
            "audio": audio_rel,                       # repo-root-relative; served from repo root
            "sentence": sentences.get(ref_id, ""),
            "_ref": ref_id,
            "_speaker": speaker,
            "_is_anchor": is_anchor,
        })

    # learners
    learners = args.learners
    if learners is None:
        learners = sorted(d.name for d in tr_root.iterdir()
                          if d.is_dir() and any(d.glob("ref_*.wav")))
    learner_clip_count = 0
    for spk in learners:
        spk_dir = tr_root / spk
        if not spk_dir.is_dir():
            print(f"  [warn] learner dir missing: {spk_dir}")
            continue
        refs = scan_speaker(spk_dir)
        for r in refs:
            add(f"{args.test_recordings}/{spk}/{r}.wav", r, spk, False)
        learner_clip_count += len(refs)
        print(f"  learner {spk}: {len(refs)} clips")

    # native anchors — spread across sentences, rotating voices, capped at --anchors
    if args.anchors > 0 and ref_root.is_dir():
        voices = sorted(d.name for d in ref_root.iterdir()
                        if d.is_dir() and any(d.glob("ref_*.wav")))
        # collect (voice, ref) candidates spread over distinct sentences
        added = 0
        seen_refs: set[str] = set()
        # iterate sentences in order, rotate voice, one anchor per sentence until cap
        all_refs = sorted({p.stem for v in voices for p in (ref_root / v).glob("ref_*.wav")})
        vi = 0
        for r in all_refs:
            if added >= args.anchors:
                break
            v = voices[vi % len(voices)]
            if (ref_root / v / f"{r}.wav").exists() and r not in seen_refs:
                add(f"{args.references}/{v}/{r}.wav", r, f"NATIVE_{v}", True)
                seen_refs.add(r)
                added += 1
                vi += 1
        print(f"  native anchors: {added}")

    out = REPO / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "_note": "Blind intelligibility-rating clips. Underscore keys are hidden from raters "
                 "(analysis-only). Serve the repo root over HTTP and open sig/validation/rate.html.",
        "n_clips": len(clips),
        "n_learner": learner_clip_count,
        "n_anchor": len(clips) - learner_clip_count,
        "clips": clips,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {len(clips)} clips ({learner_clip_count} learner + "
          f"{len(clips) - learner_clip_count} anchor) -> {out}")


if __name__ == "__main__":
    main()
