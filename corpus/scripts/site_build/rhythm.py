"""Durational rhythm metrics per utterance.

These are the standard suprasegmental rhythm measures from the L2 prosody
literature, computed purely from segment durations — no audio processing, no F0.
Everything needed is already in the TextGrid interval boundaries.

    %V        proportion of the utterance spent in vocalic intervals
    ΔV, ΔC    standard deviation of vocalic / consonantal interval durations
    VarcoV,   ΔV and ΔC normalised by mean duration (rate-robust)
    VarcoC
    nPVI-V    normalised pairwise variability index over vocalic intervals
    rPVI-C    raw pairwise variability index over consonantal intervals

Turkish is more syllable-timed than English, so Turkish-L1 English tends toward
lower vocalic nPVI and lower %V variability than a native target. These are
**measurements**, presented as such — there is no correct/incorrect verdict on a
rhythm score, only the learner value beside the reference distribution.

`consonant_runs`/`vowel_runs` collapse adjacent same-class phones into a single
interval, which is what the PVI definitions operate on (a CC cluster is one
consonantal interval, not two).
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev

from .inventory import parse_phone
from .textgrid import Interval


@dataclass(frozen=True)
class RhythmMetrics:
    n_vocalic: int
    n_consonantal: int
    percent_v: float | None
    delta_v: float | None
    delta_c: float | None
    varco_v: float | None
    varco_c: float | None
    npvi_v: float | None
    rpvi_c: float | None

    def as_dict(self) -> dict[str, float | int | None]:
        return {
            "nV": self.n_vocalic,
            "nC": self.n_consonantal,
            "percentV": _round(self.percent_v),
            "deltaV": _round(self.delta_v),
            "deltaC": _round(self.delta_c),
            "varcoV": _round(self.varco_v),
            "varcoC": _round(self.varco_c),
            "npviV": _round(self.npvi_v),
            "rpviC": _round(self.rpvi_c),
        }


def _round(x: float | None, n: int = 4) -> float | None:
    return round(x, n) if x is not None else None


def _class_runs(intervals: list[Interval]) -> list[tuple[str, float]]:
    """Collapse the phone tier into (class, duration) runs.

    class is "V", "C" or "" (unknown / skipped). Adjacent same-class intervals
    merge, so a consonant cluster becomes one consonantal interval.
    """
    runs: list[tuple[str, float]] = []
    for iv in intervals:
        if not iv.text.strip():
            continue
        parsed = parse_phone(iv.text)
        area = parsed.area
        cls = "V" if area == "vowels" else "C" if area == "consonants" else ""
        if not cls:
            continue
        if runs and runs[-1][0] == cls:
            prev_cls, prev_dur = runs[-1]
            runs[-1] = (prev_cls, prev_dur + iv.dur)
        else:
            runs.append((cls, iv.dur))
    return runs


def _npvi(durations: list[float]) -> float | None:
    """Normalised pairwise variability index (Grabe & Low 2002)."""
    if len(durations) < 2:
        return None
    acc = 0.0
    pairs = 0
    for d1, d2 in zip(durations, durations[1:]):
        denom = (d1 + d2) / 2
        if denom == 0:
            continue
        acc += abs(d1 - d2) / denom
        pairs += 1
    if pairs == 0:
        return None
    return 100 * acc / pairs


def _rpvi(durations: list[float]) -> float | None:
    """Raw pairwise variability index (in ms if durations are seconds*1000)."""
    if len(durations) < 2:
        return None
    diffs = [abs(d1 - d2) for d1, d2 in zip(durations, durations[1:])]
    return mean(diffs) if diffs else None


def compute_rhythm(phone_intervals: list[Interval]) -> RhythmMetrics:
    runs = _class_runs(phone_intervals)
    v = [d for cls, d in runs if cls == "V"]
    c = [d for cls, d in runs if cls == "C"]
    total = sum(v) + sum(c)

    # rPVI is conventionally reported in milliseconds.
    c_ms = [d * 1000 for d in c]

    return RhythmMetrics(
        n_vocalic=len(v),
        n_consonantal=len(c),
        percent_v=(sum(v) / total * 100) if total else None,
        delta_v=(pstdev(v) * 1000) if len(v) > 1 else None,
        delta_c=(pstdev(c) * 1000) if len(c) > 1 else None,
        varco_v=(100 * pstdev(v) / mean(v)) if len(v) > 1 and mean(v) else None,
        varco_c=(100 * pstdev(c) / mean(c)) if len(c) > 1 and mean(c) else None,
        npvi_v=_npvi(v),
        rpvi_c=_rpvi(c_ms),
    )
