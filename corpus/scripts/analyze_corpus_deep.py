"""POWSM-consistency checks: tiers, OOV-style labels, duration vs 20 s pad."""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

from paths import corpus_raw_dir, task_dirs

CORPUS_ALIASES = {
    "ej": "eɪ",
    "ow": "oʊ",
    "aj": "aɪ",
    "aw": "aʊ",
    "oy": "ɔɪ",
    "i:": "iː",
    "u:": "uː",
    "a:": "ɑː",
    "3:": "ɜː",
    "o:": "ɔː",
}


def read_wav_dur(p: Path) -> float:
    import struct

    with open(p, "rb") as f:
        h = f.read(44)
    sr = struct.unpack("<I", h[24:28])[0]
    ch = struct.unpack("<H", h[22:24])[0]
    bits = struct.unpack("<H", h[34:36])[0]
    data_bytes = struct.unpack("<I", h[40:44])[0]
    bps = sr * ch * (bits // 8)
    return data_bytes / bps if bps else 0.0


def parse_tier_labels(p: Path, tier_name: str) -> list[str]:
    text = p.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"item \[\d+\]:", text)
    for block in blocks[1:]:
        m = re.search(r'name = "([^"]+)"', block)
        if not m or m.group(1) != tier_name:
            continue
        return [x for x in re.findall(r'text = "([^"]*)"', block) if x.strip()]
    return []


def normalize_candidate(ph: str) -> str:
    ph = ph.strip()
    return CORPUS_ALIASES.get(ph, ph)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    base = corpus_raw_dir()
    print(f"CORPUS_RAW_DIR: {base}")
    if not base.is_dir():
        print("ERROR: raw corpus directory not found.")
        sys.exit(1)

    phones_all: Counter[str] = Counter()
    ref_all: Counter[str] = Counter()
    mismatches_per_file: list[tuple[str, int, int]] = []
    long_files: list[tuple[str, float, int]] = []

    for folder in ["TASK1 audio&textgrids", "TASK2 audio&textgrids"]:
        d = base / folder
        if not d.is_dir():
            continue
        for tg in sorted(d.glob("*.TextGrid")):
            wav = tg.with_suffix(".wav")
            dur = read_wav_dur(wav) if wav.exists() else 0
            phones = parse_tier_labels(tg, "phones")
            ref = parse_tier_labels(tg, "REF-phones")
            for ph in phones:
                phones_all[ph] += 1
            for ph in ref:
                ref_all[ph] += 1
            n_ph, n_ref = len(phones), len(ref)
            mismatches_per_file.append((tg.name, n_ph, n_ref))
            if dur > 20:
                long_files.append((tg.name, dur, n_ph if n_ph else n_ref))

    print(f"Total phone tokens (phones tier): {sum(phones_all.values())}")
    print(f"Total phone tokens (REF-phones tier): {sum(ref_all.values())}")
    print(f"Unique in phones: {len(phones_all)}, in REF: {len(ref_all)}")

    only_actual = set(phones_all) - set(ref_all)
    only_ref = set(ref_all) - set(phones_all)
    print(f"Labels only in phones ({len(only_actual)}): {sorted(only_actual)[:20]}")
    print(f"Labels only in REF-phones ({len(only_ref)}): {sorted(only_ref)[:20]}")

    mapped = Counter()
    for ph, count in phones_all.items():
        mapped[normalize_candidate(ph)] += count
    print(f"After alias map unique: {len(mapped)}")

    long_files.sort(key=lambda x: -x[1])
    print(f"\nFiles > 20s: {len(long_files)}")
    for name, dur, nph in long_files[:10]:
        print(f"  {name}: {dur:.0f}s, {nph} labels, ~{int(dur // 20) + 1} chunks")

    t1_long = [x for x in long_files if "T1" in x[0]]
    t2_long = [x for x in long_files if "T2" in x[0]]
    print(f"TASK1 >20s: {len(t1_long)}/30, TASK2 >20s: {len(t2_long)}/30")

    multi_char = [
        p
        for p in phones_all
        if len(p) > 2 or (len(p) == 2 and p not in CORPUS_ALIASES)
    ]
    print(f"\nMulti-char phone symbols ({len(multi_char)} types):")
    for p in sorted(multi_char, key=lambda x: -phones_all[x])[:25]:
        print(f"  {p!r}: {phones_all[p]}")

    for folder, phone_tier in [
        ("TASK1 audio&textgrids", "phones"),
        ("TASK2 audio&textgrids", "REF-phones"),
    ]:
        d = base / folder
        counts: list[int] = []
        empty: list[str] = []
        for tg in sorted(d.glob("*.TextGrid")):
            n = len(parse_tier_labels(tg, phone_tier))
            counts.append(n)
            if n == 0:
                empty.append(tg.name)
        if not counts:
            continue
        print(
            f"\n{folder} [{phone_tier}]: "
            f"min={min(counts)} max={max(counts)} total={sum(counts)} empty={len(empty)}"
        )
        if empty:
            print(f"  empty: {empty}")

    big_diff = sorted(
        ((n, abs(a - r), a, r) for n, a, r in mismatches_per_file),
        key=lambda x: -x[1],
    )[:8]
    print("\nLargest |phones| vs |REF-phones| gap (TASK2 has no phones tier):")
    for name, gap, a, r in big_diff:
        print(f"  {name}: phones={a} ref={r} gap={gap}")


if __name__ == "__main__":
    main()
