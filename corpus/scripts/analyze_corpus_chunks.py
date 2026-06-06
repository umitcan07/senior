"""Estimate utterance chunk counts from word-tier boundaries (≤20 s for POWSM)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

from paths import corpus_raw_dir


def sentence_chunks(words: list[tuple[float, float, str]], max_s: float = 18.0) -> list[float]:
    chunks: list[float] = []
    start = words[0][0]
    end = words[0][1]
    for xmin, xmax, w in words[1:]:
        if xmax - start > max_s or w.rstrip().endswith((".", "?", "!")):
            chunks.append(end - start)
            start = xmin
        end = xmax
    chunks.append(end - start)
    return chunks


def parse_tier_intervals(p: Path, tier_name: str) -> list[tuple[float, float, str]]:
    text = p.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"item \[\d+\]:", text)
    for block in blocks[1:]:
        m = re.search(r'name = "([^"]+)"', block)
        if not m or m.group(1) != tier_name:
            continue
        intervals = re.findall(
            r"xmin = ([\d.]+)\s+xmax = ([\d.]+)\s+text = \"([^\"]*)\"",
            block,
            re.MULTILINE,
        )
        return [(float(a), float(b), t.strip()) for a, b, t in intervals if t.strip()]
    return []


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    base = corpus_raw_dir()
    print(f"CORPUS_RAW_DIR: {base}")
    if not base.is_dir():
        print("ERROR: raw corpus directory not found.")
        sys.exit(1)

    for label, folder, tier in [
        ("TASK1", "TASK1 audio&textgrids", "words"),
        ("TASK2", "TASK2 audio&textgrids", "REF-words-matched"),
    ]:
        all_lens: list[float] = []
        over20 = 0
        d = base / folder
        for tg in sorted(d.glob("*.TextGrid")):
            words = parse_tier_intervals(tg, tier)
            if len(words) < 3:
                continue
            for clen in sentence_chunks(words):
                all_lens.append(clen)
                if clen > 20:
                    over20 += 1
        if not all_lens:
            print(f"{label}: no word intervals")
            continue
        print(f"{label} sentence chunks: {len(all_lens)}")
        print(f"  mean={sum(all_lens) / len(all_lens):.1f}s max={max(all_lens):.1f}s")
        print(f"  >20s: {over20} ({100 * over20 / len(all_lens):.1f}%)")
        under5 = sum(1 for x in all_lens if x < 5)
        print(f"  <5s: {under5} ({100 * under5 / len(all_lens):.1f}%)")


if __name__ == "__main__":
    main()
