#!/usr/bin/env python3
"""
normalize_audio.py — normalize loudness of reference word recordings in data/learn/.

Processes all WAV files under data/learn/<author>/ in-place (or to --output-dir),
targeting -16 LUFS integrated loudness via pyloudnorm. Output stays WAV PCM 16 kHz mono.

Usage:
    python3 scripts/normalize_audio.py [--data-root data] [--output-dir <dir>] [--dry-run]

Options:
    --data-root  Path to the data/ directory (default: data next to this script)
    --output-dir Write normalized files here instead of overwriting in-place
    --target     Target integrated loudness in LUFS (default: -16)
    --dry-run    Print measured loudness per file; do not write

After running, re-upload with:
    python3 scripts/upload_learn_audio.py --force
"""

import argparse
import pathlib
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf


TARGET_LUFS = -16.0
SAMPLE_RATE = 16000


def measure_and_normalize(path: pathlib.Path, target_lufs: float, dry_run: bool, output_path: pathlib.Path) -> dict:
    data, sr = sf.read(str(path))
    if data.ndim > 1:
        data = data.mean(axis=1)  # force mono
    if sr != SAMPLE_RATE:
        # should not happen — all clips are already 16 kHz
        print(f"  WARNING: {path.name} is {sr} Hz, not {SAMPLE_RATE} Hz", file=sys.stderr)

    meter = pyln.Meter(sr)
    try:
        loudness = meter.integrated_loudness(data)
    except Exception as exc:
        return {"file": str(path), "error": str(exc)}

    peak_before = float(np.max(np.abs(data)))

    if not dry_run:
        normalized = pyln.normalize.loudness(data, loudness, target_lufs)
        peak_after = float(np.max(np.abs(normalized)))
        clipped = peak_after > 1.0
        if clipped:
            # True-peak clip guard: scale down to 0.99 headroom
            normalized = normalized * (0.99 / peak_after)
            peak_after = 0.99
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(output_path), normalized, sr, subtype="PCM_16")
    else:
        peak_after = None
        clipped = None

    return {
        "file": path.name,
        "lufs_before": round(loudness, 2),
        "peak_before": round(peak_before, 4),
        "peak_after": round(peak_after, 4) if peak_after is not None else None,
        "clipped": clipped,
    }


def main():
    parser = argparse.ArgumentParser(description="Normalize loudness of audio recordings under data/.")
    parser.add_argument("--data-root", default=None, help="Path to data/ dir")
    parser.add_argument("--subdir", default="learn", help="Subdirectory under data/ to process (default: learn)")
    parser.add_argument("--output-dir", default=None, help="Write output here instead of in-place")
    parser.add_argument("--target", type=float, default=TARGET_LUFS, help="Target LUFS (default: -16)")
    parser.add_argument("--dry-run", action="store_true", help="Measure only, do not write")
    args = parser.parse_args()

    script_dir = pathlib.Path(__file__).parent
    data_root = pathlib.Path(args.data_root) if args.data_root else script_dir.parent / "data"
    learn_root = data_root / args.subdir

    if not learn_root.exists():
        sys.exit(f"directory not found: {learn_root}")

    wav_files = sorted(learn_root.glob("*/*.wav"))
    if not wav_files:
        sys.exit(f"No WAV files found under {learn_root}")

    output_root = pathlib.Path(args.output_dir) if args.output_dir else None

    total = 0
    clipped_count = 0
    errors = []

    for wav in wav_files:
        relative = wav.relative_to(learn_root)
        out_path = (output_root / relative) if output_root else wav

        result = measure_and_normalize(wav, args.target, args.dry_run, out_path)

        if "error" in result:
            errors.append(result)
            print(f"  ERROR  {wav.parent.name}/{result['file']}: {result['error']}")
            continue

        total += 1
        clip_marker = " [CLIP-GUARD]" if result["clipped"] else ""
        if args.dry_run:
            print(f"  {wav.parent.name}/{result['file']:20s}  {result['lufs_before']:7.2f} LUFS  peak {result['peak_before']:.4f}")
        else:
            print(f"  {wav.parent.name}/{result['file']:20s}  {result['lufs_before']:7.2f} -> {args.target:.1f} LUFS  peak {result['peak_after']:.4f}{clip_marker}")
            if result["clipped"]:
                clipped_count += 1

    print(f"\n{'Measured' if args.dry_run else 'Normalized'} {total} file(s).", end="")
    if not args.dry_run and clipped_count:
        print(f" {clipped_count} file(s) had clip-guard applied.")
    else:
        print()
    if errors:
        print(f"{len(errors)} error(s).")


if __name__ == "__main__":
    main()
