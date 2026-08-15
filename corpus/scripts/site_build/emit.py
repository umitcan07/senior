"""Write the precomputed JSON artifacts the static site consumes.

The corpus is frozen, so the site never queries anything live. This module
produces a small fixed set of files under the output `data/` directory:

    manifest.json                small: build meta, speaker table, filter tree,
                                 per-area headline counts. Loaded on first paint.
    areas/<area>.json            per-area stats: for each phone and each
                                 articulatory class, correct/incorrect counts.
    tokens/<area>/<phone>.json   sharded token lists: every realisation of one
                                 target phone, lazy-loaded when the user drills in.
    utterances/<uid>.json        per-utterance detail: aligned tokens, rhythm,
                                 F0 contour, clip URL. Lazy-loaded on token click.

Sharding per phone keeps any single fetch small: ~300k tokens total would be one
huge file, but "/b/ only" is a few thousand rows. The site's two-level filter
(area -> class/phone) maps directly onto which shard to fetch.

JSON is written compact (no indent) except `manifest.json`, which is small and
worth keeping diff-friendly.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote


@dataclass
class TokenRow:
    """One realised phone across the whole corpus — the atomic site row."""

    id: str
    utterance: str
    speaker: str
    target: str | None
    actual: str | None
    error: str  # correct | substitute | delete | insert
    t0: float
    t1: float
    stress_error: bool = False
    length_error: bool = False
    word: str | None = None
    # Realised phones either side of this one, for the KWIC concordance view.
    left_context: str = ""
    right_context: str = ""

    def as_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "u": self.utterance,
            "spk": self.speaker,
            "tgt": self.target,
            "act": self.actual,
            "e": self.error,
            "t0": round(self.t0, 3),
            "t1": round(self.t1, 3),
        }
        if self.stress_error:
            d["se"] = True
        if self.length_error:
            d["le"] = True
        if self.word:
            d["w"] = self.word
        if self.left_context:
            d["lc"] = self.left_context
        if self.right_context:
            d["rc"] = self.right_context
        return d


@dataclass
class PhoneStat:
    target: str
    total: int = 0
    correct: int = 0
    substitute: int = 0
    delete: int = 0
    # Substitution confusions: what the target was replaced with, counted.
    confusions: dict[str, int] = field(default_factory=dict)

    @property
    def incorrect(self) -> int:
        return self.substitute + self.delete

    @property
    def accuracy(self) -> float | None:
        denom = self.correct + self.incorrect
        return self.correct / denom if denom else None

    def as_dict(self) -> dict[str, Any]:
        return {
            "phone": self.target,
            "total": self.total,
            "correct": self.correct,
            "substitute": self.substitute,
            "delete": self.delete,
            "accuracy": round(self.accuracy, 4) if self.accuracy is not None else None,
            "confusions": dict(
                sorted(self.confusions.items(), key=lambda kv: -kv[1])
            ),
        }


def _write_json(path: Path, payload: Any, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=indent)


class SiteWriter:
    """Accumulates rows/stats during the build, then flushes the artifact tree."""

    def __init__(self, out_dir: Path) -> None:
        self.out = out_dir
        self.data = out_dir / "data"
        # target phone -> shard rows
        self._shards: dict[tuple[str, str], list[dict[str, Any]]] = {}
        # target phone -> stat
        self._stats: dict[str, PhoneStat] = {}
        self._insertions: dict[str, PhoneStat] = {}
        self._utterances: list[dict[str, Any]] = []
        # Lexical stress: totals + per-stressed-vowel {phone: [correct, mismatch]}
        self._stress_total = 0
        self._stress_correct = 0
        self._stress_by_phone: dict[str, list[int]] = {}
        self._stress_marks_seen = False
        self._stress_rows: list[dict[str, Any]] = []
        self._annotations: dict[str, list[dict[str, Any]]] = {}

    def add_token(self, area: str, row: TokenRow) -> None:
        # Insertions have no target phone; bucket them under the actual phone in
        # a parallel "added" table so they are inspectable without polluting the
        # target-phone accuracy denominators.
        if row.error == "insert":
            key = row.actual or "∅"
            stat = self._insertions.setdefault(key, PhoneStat(target=key))
            stat.total += 1
            self._shards.setdefault((area, f"ins_{key}"), []).append(row.as_dict())
            return

        key = row.target or "∅"
        stat = self._stats.setdefault(key, PhoneStat(target=key))
        stat.total += 1
        if row.error == "correct":
            stat.correct += 1
        elif row.error == "substitute":
            stat.substitute += 1
            if row.actual:
                stat.confusions[row.actual] = stat.confusions.get(row.actual, 0) + 1
        elif row.error == "delete":
            stat.delete += 1
        self._shards.setdefault((area, key), []).append(row.as_dict())

    def add_stress(
        self,
        target_phone: str | None,
        *,
        defined: bool,
        mismatch: bool,
        marks_seen: bool,
        row: TokenRow | None = None,
    ) -> None:
        """Record one stress-bearing slot.

        `defined` is True when either the target or the realised phone carried a
        stress mark — only those slots are evidence either way. `marks_seen`
        tracks whether any ˈ/ˌ appeared at all, so the site can distinguish
        "stress annotated, all correct" from "no stress annotation exists".
        """
        if marks_seen:
            self._stress_marks_seen = True
        if not defined:
            return
        key = target_phone or "∅"
        bucket = self._stress_by_phone.setdefault(key, [0, 0])
        self._stress_total += 1
        if mismatch:
            bucket[1] += 1
            if row is not None:
                self._stress_rows.append(row.as_dict())
        else:
            self._stress_correct += 1
            bucket[0] += 1

    def add_utterance(self, payload: dict[str, Any]) -> None:
        self._utterances.append(
            {
                "id": payload["id"],
                "spk": payload["spk"],
                "task": payload.get("task"),
                "text": payload.get("text"),
                "dur": payload.get("dur"),
            }
        )
        _write_json(self.data / "utterances" / f"{payload['id']}.json", payload)

    def add_annotation(self, area: str, row: dict[str, Any]) -> None:
        """Store a corpus-native hand judgement as a concordance row."""
        self._annotations.setdefault(area, []).append(row)
        if area == "lexical-stress":
            self._stress_marks_seen = True
            self._stress_total += 1
            outcome = row["e"] == "correct"
            if outcome:
                self._stress_correct += 1
            else:
                self._stress_rows.append(row)

    def write_annotation_stats(self, area: str) -> None:
        rows = self._annotations.get(area, [])
        correct = sum(1 for row in rows if row["e"] == "correct")
        # The existing UI's ``substitute`` column is retained as a transport
        # field for an incorrect hand judgement; no substitution is claimed.
        payload = {
            "area": area,
            "total": len(rows),
            "correct": correct,
            "incorrect": len(rows) - correct,
            "mismatch": len(rows) - correct,
            "marksPresent": bool(rows),
            "byPhone": [],
        }
        _write_json(self.data / "areas" / f"{area}.json", payload)
        _write_json(self.data / "tokens" / area / "all.json", rows)

    def phone_stat(self, target: str) -> PhoneStat:
        return self._stats.setdefault(target, PhoneStat(target=target))

    def flush_shards(self) -> None:
        for (area, key), rows in self._shards.items():
            # Corpus labels may contain Windows-reserved characters (notably
            # ``:`` in length notation). Match the browser's encodeURIComponent
            # request path while keeping generated files portable.
            _write_json(self.data / "tokens" / area / f"{quote(key, safe='')}.json", rows)

    def write_area_stats(self, area: str, phones: list[str]) -> None:
        stats = [
            self._stats[p].as_dict() for p in phones if p in self._stats
        ]
        _write_json(self.data / "areas" / f"{area}.json", {"area": area, "phones": stats})

    def write_stress_stats(self) -> None:
        by_phone = [
            {"phone": p, "total": c + m, "correct": c, "mismatch": m}
            for p, (c, m) in sorted(
                self._stress_by_phone.items(), key=lambda kv: -(kv[1][0] + kv[1][1])
            )
        ]
        _write_json(
            self.data / "areas" / "lexical-stress.json",
            {
                "area": "lexical-stress",
                "total": self._stress_total,
                "correct": self._stress_correct,
                "mismatch": self._stress_total - self._stress_correct,
                "marksPresent": self._stress_marks_seen,
                "byPhone": by_phone,
            },
        )
        _write_json(self.data / "tokens" / "stress" / "mismatch.json", self._stress_rows)

    def write_manifest(self, manifest: dict[str, Any]) -> None:
        manifest = dict(manifest)
        manifest["utterances"] = sorted(self._utterances, key=lambda u: u["id"])
        manifest["insertions"] = [
            s.as_dict() for s in sorted(self._insertions.values(), key=lambda s: -s.total)
        ]
        _write_json(self.data / "manifest.json", manifest, indent=2)

    @property
    def stats(self) -> dict[str, PhoneStat]:
        return self._stats
