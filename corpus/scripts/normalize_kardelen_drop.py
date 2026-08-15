"""Normalize the timestamped Kardelen Drive export into the site-build layout.

The source export is deliberately left untouched.  The resulting directory has
the canonical task folders expected by ``site_build`` and an inventory that
records missing assets instead of silently excluding them.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


STEM = re.compile(r"^S\d+T[12]$", re.IGNORECASE)


def _by_stem(root: Path, suffix: str) -> dict[str, list[Path]]:
    found: dict[str, list[Path]] = {}
    for path in root.rglob(f"*{suffix}"):
        if STEM.match(path.stem):
            found.setdefault(path.stem.upper(), []).append(path)
    return found


def _pick(paths: list[Path], *, task: str, want_textgrid: bool = False) -> Path | None:
    preferred = [
        p
        for p in paths
        if ("coma files" in str(p).lower()) == (task == "T2" and want_textgrid)
    ]
    return (preferred or paths)[0] if paths else None


def normalize(source: Path, destination: Path, *, copy: bool = True) -> dict:
    """Create a canonical layout and return its non-sensitive inventory."""
    if not source.is_dir():
        raise FileNotFoundError(source)
    wavs = _by_stem(source, ".wav")
    grids = _by_stem(source, ".TextGrid")
    exbs = _by_stem(source, ".exb")
    inventory: dict[str, dict[str, object]] = {}

    for task in ("T1", "T2"):
        folder = destination / f"TASK{task[-1]} audio&textgrids"
        folder.mkdir(parents=True, exist_ok=True)
        for number in range(1, 31):
            stem = f"S{number}{task}"
            grid = _pick(grids.get(stem, []), task=task, want_textgrid=True)
            wav = _pick(wavs.get(stem, []), task=task)
            exb = (exbs.get(stem) or [None])[0]
            entry = {
                "task": task,
                "textgrid": bool(grid),
                "wav": bool(wav),
                "exb": bool(exb),
                "sourceFiles": [p.name for p in (grid, wav, exb) if p],
            }
            inventory[stem] = entry
            if not copy:
                continue
            for item in (grid, wav):
                if item:
                    shutil.copy2(item, folder / item.name)
            if exb:
                out = destination / "exb files"
                out.mkdir(exist_ok=True)
                shutil.copy2(exb, out / exb.name)

    payload = {
        "corpus": "CORPTES",
        "records": inventory,
        "missingAudio": sorted(k for k, v in inventory.items() if not v["wav"]),
        "missingTextGrid": sorted(k for k, v in inventory.items() if not v["textgrid"]),
    }
    if copy:
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "raw_inventory.json").write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="inspect without copying")
    args = parser.parse_args()
    report = normalize(args.source, args.out, copy=not args.check)
    print(
        f"{len(report['records'])} records; "
        f"{len(report['missingAudio'])} missing audio; "
        f"{len(report['missingTextGrid'])} missing TextGrid"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
