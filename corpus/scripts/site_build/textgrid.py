"""PRAAT TextGrid parser (long and short text formats).

The existing corpus scripts scrape TextGrids with regexes because they only ever
needed the label sequence. The site needs exact interval boundaries — every
token carries `t0`/`t1` so the player can seek to it, and the rhythm metrics are
computed straight from durations — so this reads the format properly.

Binary TextGrids are not supported; PRAAT writes text by default and the corpus
drop is text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Interval:
    t0: float
    t1: float
    text: str

    @property
    def dur(self) -> float:
        return self.t1 - self.t0


@dataclass
class Tier:
    name: str
    kind: str  # "interval" | "point"
    intervals: list[Interval]

    def labelled(self) -> list[Interval]:
        """Intervals with a non-empty label (silences dropped)."""
        return [iv for iv in self.intervals if iv.text.strip()]


@dataclass
class TextGrid:
    path: Path
    xmin: float
    xmax: float
    tiers: dict[str, Tier]

    def tier(self, *names: str) -> Tier | None:
        """First tier matching any of `names`, case-insensitively."""
        lowered = {k.lower(): v for k, v in self.tiers.items()}
        for name in names:
            hit = lowered.get(name.lower())
            if hit is not None:
                return hit
        return None


_NUM = r"([-\d.eE+]+)"
_QUOTED = re.compile(r'"((?:[^"]|"")*)"')


def _unquote(raw: str) -> str:
    return raw.replace('""', '"')


def _parse_long(text: str, path: Path) -> TextGrid:
    xmin = float(re.search(rf"xmin\s*=\s*{_NUM}", text).group(1))
    xmax = float(re.search(rf"xmax\s*=\s*{_NUM}", text).group(1))

    tiers: dict[str, Tier] = {}
    # Split on the item[] headers that open each tier.
    blocks = re.split(r"item\s*\[\d+\]\s*:", text)
    for block in blocks[1:]:
        cls_m = re.search(r'class\s*=\s*"([^"]+)"', block)
        name_m = re.search(r'name\s*=\s*"((?:[^"]|"")*)"', block)
        if not cls_m or not name_m:
            continue
        cls = cls_m.group(1)
        name = _unquote(name_m.group(1))

        intervals: list[Interval] = []
        if cls == "IntervalTier":
            for m in re.finditer(
                rf"xmin\s*=\s*{_NUM}\s+xmax\s*=\s*{_NUM}\s+text\s*=\s*"
                r'"((?:[^"]|"")*)"',
                block,
            ):
                intervals.append(
                    Interval(float(m.group(1)), float(m.group(2)), _unquote(m.group(3)))
                )
            kind = "interval"
        else:  # TextTier / point tier
            for m in re.finditer(
                rf"(?:number|time)\s*=\s*{_NUM}\s+mark\s*=\s*" r'"((?:[^"]|"")*)"',
                block,
            ):
                t = float(m.group(1))
                intervals.append(Interval(t, t, _unquote(m.group(2))))
            kind = "point"

        # A few CORPTES exports contain an empty shell tier followed by the
        # populated tier under the same name (notably S1T1 linking). Preserve
        # the useful intervals rather than silently replacing them.
        existing = tiers.get(name)
        if existing is not None:
            intervals = existing.intervals + intervals
        tiers[name] = Tier(name=name, kind=kind, intervals=intervals)

    return TextGrid(path=path, xmin=xmin, xmax=xmax, tiers=tiers)


def _parse_short(text: str, path: Path) -> TextGrid:
    """Short format: bare values, one per line, no keys."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # Drop the two header lines (File type / Object class).
    i = 0
    while i < len(lines) and not _looks_numeric(lines[i]):
        i += 1

    xmin = float(lines[i])
    xmax = float(lines[i + 1])
    i += 2
    i += 1  # <exists>
    n_tiers = int(float(lines[i]))
    i += 1

    tiers: dict[str, Tier] = {}
    for _ in range(n_tiers):
        cls = _unquote(_strip_quotes(lines[i]))
        name = _unquote(_strip_quotes(lines[i + 1]))
        i += 4  # class, name, tier xmin, tier xmax
        count = int(float(lines[i]))
        i += 1
        intervals: list[Interval] = []
        if cls == "IntervalTier":
            for _ in range(count):
                t0 = float(lines[i])
                t1 = float(lines[i + 1])
                label = _unquote(_strip_quotes(lines[i + 2]))
                intervals.append(Interval(t0, t1, label))
                i += 3
            kind = "interval"
        else:
            for _ in range(count):
                t = float(lines[i])
                label = _unquote(_strip_quotes(lines[i + 1]))
                intervals.append(Interval(t, t, label))
                i += 2
            kind = "point"
        existing = tiers.get(name)
        if existing is not None:
            intervals = existing.intervals + intervals
        tiers[name] = Tier(name=name, kind=kind, intervals=intervals)

    return TextGrid(path=path, xmin=xmin, xmax=xmax, tiers=tiers)


def _strip_quotes(line: str) -> str:
    line = line.strip()
    if line.startswith('"') and line.endswith('"') and len(line) >= 2:
        return line[1:-1]
    return line


def _looks_numeric(line: str) -> bool:
    try:
        float(line.strip())
    except ValueError:
        return False
    return True


def read_textgrid(path: Path) -> TextGrid:
    """Parse a TextGrid, auto-detecting long vs short text format."""
    raw = path.read_bytes()
    # The real drop includes UTF-16 TextGrids (S27T1). BOM-aware decoding is
    # required; UTF-8 replacement would make the long-format detector fail.
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8-sig", errors="replace")
    # PRAAT writes a BOM on some platforms.
    text = text.lstrip("﻿")
    if "xmin = " in text or "xmin=" in text:
        return _parse_long(text, path)
    return _parse_short(text, path)
