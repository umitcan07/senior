"""Align the realised phone tier against the reference tier.

The corpus stores what the learner actually said (`phones`) and what was
targeted (`REF-phones`) as two independent interval tiers over the same audio.
Neither tier is a one-to-one match for the other — counts differ per file, which
is exactly what `analyze_corpus_deep.py` logs as `mismatches_per_file` — so the
two sequences have to be aligned before anything can be counted.

We use Needleman-Wunsch with an articulatory-aware substitution cost: swapping
/θ/ for /t/ (same place-ish, same manner class) is cheaper than swapping /θ/ for
/m/, so the aligner prefers a substitution over a delete+insert pair when the
phones are plausibly the same slot. That keeps the error typology honest —
otherwise near-misses inflate the deletion and insertion counts.

Error typology follows `app/src/lib/phone-profile.ts` (`ErrorMode`):

    correct       target == actual
    substitute    target != actual, both present
    delete        target present, actual absent
    insert        target absent, actual present

Correctness is **strict identity** on the phone token: a realisation counts as
correct only if it matches the target exactly. Stress and length are compared
separately (see `stress_errors`) so a right vowel with wrong stress is not
silently scored as a segmental error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .inventory import ParsedPhone, Phone, parse_phone
from .textgrid import Interval

ErrorType = Literal["correct", "substitute", "delete", "insert"]

# Needleman-Wunsch weights. Gaps are expensive relative to a *similar* pair so
# the aligner keeps slots together, but cheap relative to a wildly dissimilar
# pair so it does not force nonsense substitutions.
GAP_COST = 1.0
MAX_SUB_COST = 1.6


@dataclass(frozen=True)
class Token:
    """One aligned slot — the atomic row of the whole site."""

    index: int
    error: ErrorType
    target: str | None
    actual: str | None
    t0: float
    t1: float
    # Suprasegmentals, compared independently of segmental identity.
    target_stress: int = 0
    actual_stress: int = 0
    stress_error: bool = False
    length_error: bool = False
    word_index: int | None = None

    @property
    def correct(self) -> bool:
        return self.error == "correct"


def _articulatory_distance(a: Phone | None, b: Phone | None) -> float:
    """0 = identical class, 1 = maximally different. Unknown phones -> 0.8."""
    if a is None or b is None:
        return 0.8
    if a.area != b.area:
        return 1.0

    diffs = 0
    total = 0
    if a.area == "consonants":
        for x, y in ((a.place, b.place), (a.manner, b.manner), (a.voiced, b.voiced)):
            total += 1
            if x != y:
                diffs += 1
    else:
        for x, y in (
            (a.height, b.height),
            (a.backness, b.backness),
            (a.rounded, b.rounded),
            (a.diphthong, b.diphthong),
        ):
            total += 1
            if x != y:
                diffs += 1
    return diffs / total if total else 1.0


def substitution_cost(a: ParsedPhone, b: ParsedPhone) -> float:
    if a.token == b.token:
        return 0.0
    return MAX_SUB_COST * _articulatory_distance(a.phone, b.phone)


def align_sequences(
    reference: list[ParsedPhone], actual: list[ParsedPhone]
) -> list[tuple[int | None, int | None]]:
    """Needleman-Wunsch. Returns (ref_index, act_index) pairs; None = gap."""
    n, m = len(reference), len(actual)
    # dp[i][j] = cost of aligning reference[:i] against actual[:j]
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i * GAP_COST
    for j in range(1, m + 1):
        dp[0][j] = j * GAP_COST

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = min(
                dp[i - 1][j - 1] + substitution_cost(reference[i - 1], actual[j - 1]),
                dp[i - 1][j] + GAP_COST,
                dp[i][j - 1] + GAP_COST,
            )

    pairs: list[tuple[int | None, int | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            diag = dp[i - 1][j - 1] + substitution_cost(reference[i - 1], actual[j - 1])
            if abs(dp[i][j] - diag) < 1e-9:
                pairs.append((i - 1, j - 1))
                i, j = i - 1, j - 1
                continue
        if i > 0 and abs(dp[i][j] - (dp[i - 1][j] + GAP_COST)) < 1e-9:
            pairs.append((i - 1, None))
            i -= 1
            continue
        pairs.append((None, j - 1))
        j -= 1

    pairs.reverse()
    return pairs


def _word_index_for(t0: float, words: list[Interval]) -> int | None:
    for idx, w in enumerate(words):
        if w.t0 - 1e-6 <= t0 < w.t1 + 1e-6:
            return idx
    return None


def align_intervals(
    reference: list[Interval],
    actual: list[Interval],
    words: list[Interval] | None = None,
) -> list[Token]:
    """Align two labelled interval tiers into per-slot `Token` records.

    Times come from the realised interval where one exists (so the player seeks
    to what was actually said) and fall back to the reference interval for
    deletions.
    """
    ref_parsed = [parse_phone(iv.text) for iv in reference]
    act_parsed = [parse_phone(iv.text) for iv in actual]
    pairs = align_sequences(ref_parsed, act_parsed)

    tokens: list[Token] = []
    for slot, (ri, ai) in enumerate(pairs):
        r = ref_parsed[ri] if ri is not None else None
        a = act_parsed[ai] if ai is not None else None
        r_iv = reference[ri] if ri is not None else None
        a_iv = actual[ai] if ai is not None else None

        if r is not None and a is not None:
            error: ErrorType = "correct" if r.token == a.token else "substitute"
        elif r is not None:
            error = "delete"
        else:
            error = "insert"

        iv = a_iv or r_iv
        assert iv is not None  # a pair always carries at least one side
        t0, t1 = iv.t0, iv.t1

        stress_error = bool(r and a and r.stress != a.stress)
        length_error = bool(r and a and r.long != a.long)

        tokens.append(
            Token(
                index=slot,
                error=error,
                target=r.token if r else None,
                actual=a.token if a else None,
                t0=t0,
                t1=t1,
                target_stress=r.stress if r else 0,
                actual_stress=a.stress if a else 0,
                stress_error=stress_error,
                length_error=length_error,
                word_index=_word_index_for(t0, words) if words else None,
            )
        )

    return tokens


def stress_errors(tokens: list[Token]) -> list[Token]:
    """Tokens whose vowel carries a stress mismatch.

    Lexical stress is only meaningful where the reference actually marks it, so
    slots with no target stress and no realised stress are not counted as
    evidence either way.
    """
    return [
        t
        for t in tokens
        if t.stress_error and (t.target_stress or t.actual_stress)
    ]
