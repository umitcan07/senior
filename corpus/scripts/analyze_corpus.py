"""Inventory raw corpus: duration, tiers, phone symbols."""
from __future__ import annotations

import re
import struct
import sys
from collections import Counter
from pathlib import Path

from paths import task_dirs

TASK_DIRS = task_dirs()


def read_wav_info(p: Path) -> dict | None:
    with open(p, "rb") as f:
        h = f.read(44)
    if h[:4] != b"RIFF":
        return None
    sr = struct.unpack("<I", h[24:28])[0]
    ch = struct.unpack("<H", h[22:24])[0]
    bits = struct.unpack("<H", h[34:36])[0]
    data_bytes = struct.unpack("<I", h[40:44])[0]
    bps = sr * ch * (bits // 8)
    dur = data_bytes / bps if bps else 0.0
    return {"sr": sr, "ch": ch, "bits": bits, "dur_s": round(dur, 2)}


def parse_textgrid(p: Path) -> dict[str, list[str]]:
    text = p.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"item \[\d+\]:", text)
    out: dict[str, list[str]] = {}
    for block in blocks[1:]:
        m = re.search(r'name = "([^"]+)"', block)
        if not m:
            continue
        name = m.group(1)
        labels = re.findall(r'text = "([^"]*)"', block)
        non_empty = [label for label in labels if label.strip()]
        if non_empty:
            out[name] = non_empty
    return out


def main() -> None:
    all_phones: Counter[str] = Counter()
    oov_like: Counter[str] = Counter()
    tier_names: set[str] = set()
    speaker_ids: set[str] = set()

    raw = TASK_DIRS["task1"].parent
    print(f"CORPUS_RAW_DIR: {raw}")
    if not raw.is_dir():
        print("ERROR: raw corpus directory not found. Set CORPUS_RAW_DIR or corpus/raw symlink.")
        sys.exit(1)

    for task, d in TASK_DIRS.items():
        if not d.is_dir():
            print(f"WARNING: missing {d}")
            continue
        wavs = sorted(d.glob("*.wav"))
        durs = []
        for wav in wavs:
            info = read_wav_info(wav)
            if not info:
                continue
            durs.append(info["dur_s"])
            spk = re.match(r"S(\d+)", wav.stem)
            if spk:
                speaker_ids.add(spk.group(1))
        print(f"=== {task.upper()} ({len(wavs)} wav) ===")
        if durs:
            print(
                f"  duration: total={sum(durs) / 3600:.2f}h "
                f"min={min(durs):.1f}s max={max(durs):.1f}s mean={sum(durs) / len(durs):.1f}s"
            )
        if wavs:
            print(f"  audio format (first file): {read_wav_info(wavs[0])}")

    phone_pattern = re.compile(r"^[a-zA-Zɑæəɚɝɪʊʌɛɔɒθðŋʃʒʧʤɹjwɾɫˈˌː]+$")
    slash_tokens: Counter[str] = Counter()

    for task, d in TASK_DIRS.items():
        if not d.is_dir():
            continue
        for tg in sorted(d.glob("*.TextGrid")):
            tiers = parse_textgrid(tg)
            tier_names.update(tiers.keys())
            for ph in tiers.get("phones", []):
                ph = ph.strip()
                if not ph:
                    continue
                all_phones[ph] += 1
                if "/" in ph:
                    slash_tokens[ph] += 1
                if not phone_pattern.match(ph.replace(" ", "")):
                    oov_like[ph] += 1

    print(
        f"\nSpeakers: {len(speaker_ids)} "
        f"({sorted(speaker_ids, key=int)[:5]}…{sorted(speaker_ids, key=int)[-3:]})"
    )
    print(f"TextGrid tier names: {sorted(tier_names)}")
    print(f"Unique phone labels (phones tier): {len(all_phones)}")
    print(f"Top 30 phones: {all_phones.most_common(30)}")
    if slash_tokens:
        print(f"Labels with slashes: {slash_tokens.most_common(5)}")
    if oov_like:
        print(f"Unusual phone labels: {oov_like.most_common(25)}")

    task1 = TASK_DIRS["task1"]
    if task1.is_dir():
        sample = sorted(task1.glob("*.TextGrid"))[0]
        tiers = parse_textgrid(sample)
        print(f"\nSample phones from {sample.name} (first 40):")
        print(" ".join(tiers.get("phones", [])[:40]))
        words = tiers.get("words", [])
        ref = tiers.get("REF-words", [])
        print(f"\n{sample.name}: words={len(words)}, REF-words={len(ref)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
