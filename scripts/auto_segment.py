#!/usr/bin/env python3
"""
auto_segment.py — auto-detect utterance segments in a long take via ffmpeg silencedetect.

For a take that is a sequence of prompts in a known order, separated by consistent pauses
(the Fiverr orders: 25 sentences ref_001..ref_025, then 40 words word_01..word_40), this finds
the speech regions and assigns the manifest ids to them in time order. It writes an Audacity
label file (data/labels/<author>.txt) — the exact format split_audio.py consumes — so you can:
  * cut immediately (--cut), or
  * import the labels into Audacity (File > Import > Labels) to eyeball/nudge, re-export, then cut.

ffmpeg must be on PATH (it is inside the worker container). Run there:
    docker compose -f docker-compose.dev.yml exec worker-assessment python3 \
      /worker/scripts/auto_segment.py /data/fiverr/genam_jordan.wav --author genam_jordan --cut

Tuning (defaults suit clean studio takes with clear pauses):
    --noise -30dB     silence threshold (lower = stricter: e.g. -35dB if pauses are very quiet)
    --min-silence 0.4 min pause length (s) that counts as a gap between prompts
    --min-seg 0.30    drop detected speech blips shorter than this (s)
    --pad 0.10        widen each segment by this much on both sides (s)

If the detected count != the expected count (65 for a reference voice, 25 for a test user) the
labels are still written (named seg_001..) and the script warns instead of misaligning — adjust
the thresholds or fix it in Audacity.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

TARGET_SR = 16000


def run_silencedetect(raw: Path, noise: str, min_silence: float) -> str:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(raw),
         "-af", f"silencedetect=noise={noise}:d={min_silence}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    return proc.stderr


def parse_duration(stderr: str) -> float:
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
    if not m:
        raise ValueError("could not parse Duration from ffmpeg output")
    h, mn, s = m.groups()
    return int(h) * 3600 + int(mn) * 60 + float(s)


def parse_silences(stderr: str, duration: float) -> list[tuple[float, float]]:
    """Return list of (silence_start, silence_end) intervals."""
    starts = [float(m) for m in re.findall(r"silence_start:\s*(-?\d+\.?\d*)", stderr)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*(-?\d+\.?\d*)", stderr)]
    sils = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else duration  # trailing silence runs to EOF
        sils.append((max(0.0, s), min(duration, e)))
    return sils


def speech_segments(sils, duration, min_seg, pad) -> list[tuple[float, float]]:
    """Complement of the silence intervals within [0, duration], filtered + padded."""
    segs = []
    cursor = 0.0
    for s, e in sils:
        if s > cursor:
            segs.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < duration:
        segs.append((cursor, duration))
    out = []
    for s, e in segs:
        if e - s < min_seg:
            continue
        out.append((max(0.0, s - pad), min(duration, e + pad)))
    return out


def merge_below(segs, thresh) -> list[tuple[float, float]]:
    """Merge adjacent segments whose gap is < thresh (an internal pause split one prompt)."""
    if thresh <= 0 or not segs:
        return segs
    out = [list(segs[0])]
    for s, e in segs[1:]:
        if s - out[-1][1] < thresh:
            out[-1][1] = e
        else:
            out.append([s, e])
    return [tuple(x) for x in out]


def merge_at(segs, times) -> list[tuple[float, float]]:
    """Surgically fuse the boundary (gap) nearest each given timestamp — for an over-split that
    a global --merge-below can't isolate (e.g. a comma pause wider than a real prompt boundary)."""
    segs = [list(s) for s in segs]
    for t in sorted(times, reverse=True):  # high->low so earlier indices stay valid
        def gap_dist(i):
            end, nxt = segs[i][1], segs[i + 1][0]
            return 0.0 if end <= t <= nxt else min(abs(t - end), abs(t - nxt))
        i = min(range(len(segs) - 1), key=gap_dist)
        segs[i][1] = segs[i + 1][1]
        del segs[i + 1]
    return [tuple(s) for s in segs]


def report_gaps(segs) -> None:
    gaps = sorted((segs[i + 1][0] - segs[i][1], i) for i in range(len(segs) - 1))
    print("  tightest gaps (a small one is usually an internal pause that over-split a prompt):")
    for g, i in gaps[:6]:
        print(f"    {g:.2f}s  after segment {i} (ends {segs[i][1]:.2f}s) "
              f"-> pick --merge-below just above this to fuse it")


def manifest_ids(data_root: Path, author: str) -> list[str]:
    kind = "reference"
    af = data_root / "authors.json"
    if af.exists():
        meta = json.loads(af.read_text(encoding="utf-8")).get("authors", {}).get(author)
        kind = meta.get("kind", "reference") if meta else "reference"
    m = json.loads((data_root / "manifest.json").read_text(encoding="utf-8"))
    ids = [r["id"] for r in m["references"]]
    if kind == "reference":
        ids += [w["id"] for w in m["learn_words"]]
    return ids


def write_labels(path: Path, segs, names) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for (s, e), name in zip(segs, names):
            f.write(f"{s:.6f}\t{e:.6f}\t{name}\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("raw", type=Path, help="this author's long take")
    ap.add_argument("--author", required=True)
    ap.add_argument("--data-root", type=Path, help="data/ root (default: inferred from raw, walking up to a dir with manifest.json)")
    ap.add_argument("--out", type=Path, help="label file to write (default: <data>/labels/<author>.txt)")
    ap.add_argument("--noise", default="-30dB")
    ap.add_argument("--min-silence", type=float, default=0.4)
    ap.add_argument("--min-seg", type=float, default=0.30)
    ap.add_argument("--pad", type=float, default=0.10)
    ap.add_argument("--merge-below", type=float, default=0.0, help="fuse adjacent segments whose gap < this (s)")
    ap.add_argument("--merge-at", type=float, nargs="*", default=[], help="surgically fuse the boundary nearest each timestamp (s)")
    ap.add_argument("--cut", action="store_true", help="run split_audio.py on the labels after writing them")
    ap.add_argument("--force", action="store_true", help="passed through to split_audio when --cut")
    args = ap.parse_args()

    if not args.raw.exists():
        sys.exit(f"ERROR: not found: {args.raw}")
    import shutil
    if not shutil.which("ffmpeg"):
        sys.exit("ERROR: ffmpeg not found on PATH (run inside the worker container).")

    data_root = args.data_root
    if data_root is None:
        for p in args.raw.resolve().parents:
            if (p / "manifest.json").exists():
                data_root = p
                break
        if data_root is None:
            sys.exit("ERROR: could not locate data/ root (pass --data-root).")

    stderr = run_silencedetect(args.raw, args.noise, args.min_silence)
    duration = parse_duration(stderr)
    sils = parse_silences(stderr, duration)
    segs = speech_segments(sils, duration, args.min_seg, args.pad)
    segs = merge_below(segs, args.merge_below)
    if args.merge_at:
        segs = merge_at(segs, args.merge_at)

    ids = manifest_ids(data_root, args.author)
    matched = len(segs) == len(ids)
    names = ids if matched else [f"seg_{i + 1:03d}" for i in range(len(segs))]

    out = args.out or (data_root / "labels" / f"{args.author}.txt")
    write_labels(out, segs, names)

    print(f"duration {duration:.1f}s · {len(sils)} silences · {len(segs)} speech segments · expected {len(ids)}")
    print(f"labels -> {out}")
    if not matched:
        print(f"\n!! detected {len(segs)} segments but expected {len(ids)}. Labels written as seg_NNN.")
        report_gaps(segs)
        print("   Then re-run with --merge-below <value> (over-split), or --min-seg up (drop blips),")
        print("   or import the labels into Audacity to fix. Once it matches, add --cut.")
        sys.exit(2)

    print(f"matched all {len(ids)} ids in order ({names[0]} … {names[-1]}).")
    if args.cut:
        script = Path(__file__).with_name("split_audio.py")
        cmd = [sys.executable, str(script), str(out), str(args.raw), "--author", args.author, "--data-root", str(data_root)]
        if args.force:
            cmd.append("--force")
        print("\n$ " + " ".join(cmd))
        sys.exit(subprocess.run(cmd).returncode)
    else:
        print(f"\nreview, then cut:\n  split_audio.py {out} {args.raw} --author {args.author}")


if __name__ == "__main__":
    main()
