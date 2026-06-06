#!/usr/bin/env python3
"""
split_audio.py — slice one author's long take into per-id clips via ffmpeg.

Cut points come from an Audacity label file (.txt): each region label is
`start<TAB>end<TAB>name`, where `name` is the clip id (ref_001, word_01, ...). Such files are
written by `verify.py automap`, `scripts/auto_segment.py`, or exported from an Audacity Label
Track. Each segment is cut and resampled to 16 kHz mono PCM WAV to the canonical path for the
author + id:

    ref_NNN   + reference author  -> <data>/references/<author>/ref_NNN.wav
    ref_NNN   + test_user author  -> <data>/test_recordings/<author>/ref_NNN.wav
    word_NN   / sound_NN          -> <data>/learn/<author>/<id>.wav

The author's kind is read from <data>/authors.json; the data root is inferred from the label
file location (data/labels/... -> data/), overridable with --data-root, so the same command
works on the host or inside the worker container (ffmpeg ships in the image).

--assign-order : ignore label names and assign ids by time order from the manifest
                 (ref_001..ref_NNN then word_01..word_NN for reference voices; refs only for
                 test users). Use this with Audacity's Analyze > Label Sounds auto-detection,
                 where labels come out unnamed but in order. Counts must match.
--dry-run      : print the id -> [start,end] mapping and exit without cutting (verify first).

Examples (in the worker container):
    docker compose -f docker-compose.dev.yml exec worker-assessment python3 \
      /worker/scripts/split_audio.py /data/labels/genam_jordan.txt /data/fiverr/genam_jordan.wav --author genam_jordan
    # auto-detected, unnamed labels:
    ... split_audio.py /data/labels/genam_jordan.txt /data/fiverr/genam_jordan.wav --author genam_jordan --assign-order --dry-run
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

TARGET_SR = 16000


def read_audacity_labels(path: Path) -> list[dict]:
    """Audacity Export Labels format: `start<TAB>end<TAB>name` per region. Lines beginning
    with a backslash are frequency-range continuations and are ignored."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("\\"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        start, end = float(parts[0]), float(parts[1])
        name = parts[2].strip() if len(parts) >= 3 else ""
        rows.append({"id": name, "start": start, "end": end})
    return rows


def manifest_id_order(data_root: Path, kind: str) -> list[str]:
    m = json.loads((data_root / "manifest.json").read_text(encoding="utf-8"))
    ids = [r["id"] for r in m["references"]]
    if kind == "reference":
        ids += [w["id"] for w in m["learn_words"]]
    return ids


def author_kind(data_root: Path, author: str) -> str:
    f = data_root / "authors.json"
    if f.exists():
        meta = json.loads(f.read_text(encoding="utf-8")).get("authors", {}).get(author)
        if meta:
            return meta.get("kind", "reference")
    print(f"  warning: author '{author}' not in {f}; assuming kind=reference")
    return "reference"


def out_path(data_root: Path, row_id: str, author: str, kind: str) -> Path:
    if row_id.startswith("ref_"):
        base = "test_recordings" if kind == "test_user" else "references"
        return data_root / base / author / f"{row_id}.wav"
    if row_id.startswith(("word_", "sound_")):
        return data_root / "learn" / author / f"{row_id}.wav"
    sys.exit(f"Unrecognized id prefix: {row_id!r} (name your Audacity labels ref_NNN / word_NN, or use --assign-order)")


def cut(raw: Path, start: float, end: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(raw),
         "-ar", str(TARGET_SR), "-ac", "1", "-c:a", "pcm_s16le", str(dest)],
        check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", type=Path, help="Audacity label .txt (start<TAB>end<TAB>id per line)")
    ap.add_argument("raw", type=Path, help="this author's long take (any format ffmpeg reads)")
    ap.add_argument("--author", required=True, help="author id (must match authors.json + folder name)")
    ap.add_argument("--data-root", type=Path, help="data/ root (default: inferred from source location)")
    ap.add_argument("--assign-order", action="store_true", help="assign ids by time order from manifest (for unnamed auto labels)")
    ap.add_argument("--dry-run", action="store_true", help="print the id->[start,end] mapping and exit")
    ap.add_argument("--force", action="store_true", help="overwrite existing clips")
    args = ap.parse_args()

    for p in (args.source, args.raw):
        if not p.exists():
            sys.exit(f"ERROR: not found: {p}")

    data_root = args.data_root or args.source.resolve().parent.parent
    kind = author_kind(data_root, args.author)

    rows = read_audacity_labels(args.source)
    rows.sort(key=lambda r: r["start"])

    if args.assign_order:
        ids = manifest_id_order(data_root, kind)
        if len(rows) != len(ids):
            sys.exit(f"ERROR: --assign-order needs exactly {len(ids)} labels for {args.author} "
                     f"(kind={kind}), got {len(rows)}. Adjust the silence threshold / fix labels.")
        for r, rid in zip(rows, ids):
            r["id"] = rid

    if not rows:
        sys.exit("ERROR: no usable segments found in source.")
    if args.dry_run:
        for r in rows:
            print(f"  {r['id'] or '(unnamed)':<10} {r['start']:.3f} -> {r['end']:.3f}")
        print(f"\n{len(rows)} segments (dry run, nothing cut).")
        return

    if not shutil.which("ffmpeg"):
        sys.exit("ERROR: ffmpeg not found on PATH (it is available inside the worker container).")

    made = skipped = 0
    for r in rows:
        if r["end"] <= r["start"]:
            sys.exit(f"ERROR: {r['id']}: end ({r['end']}) <= start ({r['start']})")
        dest = out_path(data_root, r["id"], args.author, kind)
        if dest.exists() and not args.force:
            print(f"  skip  {r['id']}: exists")
            skipped += 1
            continue
        cut(args.raw, r["start"], r["end"], dest)
        print(f"  cut   {r['id']}: {dest} [{r['start']:.2f}-{r['end']:.2f}s]")
        made += 1

    print(f"\ndone ({args.author}, kind={kind}, data={data_root}): {made} cut, {skipped} skipped")


if __name__ == "__main__":
    main()
