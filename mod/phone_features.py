"""Articulatory-feature substitution cost for the phone diff (E7.6 / issue #57).

Replaces the binary ``substitute=2`` cost in ``mod/phone_diff.py`` with a PanPhon
articulatory-feature distance so articulatorily-close phones align as cheap
substitutions instead of being torn into spurious insert/delete pairs or matched
to unrelated phones. Feasibility (verdict GREEN) is written up in
``doc/e7.6_panphon_feasibility.md`` §5; the validated reference implementation is
the dev-only POC ``mod/dev/poc_feature_diff.py`` (``vec``/``hamming``/
``make_feature_cost``/``NORM_MAP``), which this module ports — keep the two in
sync if either changes.

Cost model: ``feature_sub_cost(a, b) = SCALE · (differing_features / 24)``, with
``SCALE = 2.0`` so the maximum substitution cost equals the old binary ceiling
(``ins + del = 2``). That keeps the aligner's far-phone insert/delete balance
unchanged while making near-misses cheap. Identical tokens cost ``0.0``; any
token PanPhon can't vectorize to a single segment falls back to ``UNCOVERED_COST``
(also 2.0, i.e. binary-equivalent for that pair) and logs a warning.

``panphon`` is imported lazily so this module import-cleans on the dev worker
(which ships POWSM but not panphon) and so binary-only callers/tests never need
panphon installed.
"""

import functools
import logging

log = logging.getLogger(__name__)

# scale so max sub cost = 2.0·1.0 = 2.0 = ins+del ceiling (see module docstring).
SCALE = 2.0
# Graceful fallback for any token panphon can't vectorize to exactly one segment.
# 2.0 == the binary ceiling, so an unknown pair degrades to binary-equivalent
# behavior rather than crashing assessment. Never 0 (would be a free match) or inf
# (would poison the DP matrix). Emitted with a log.warning so misses are visible.
UNCOVERED_COST = 2.0
# PanPhon's English-relevant feature set. Asserted against the live table below so a
# panphon upgrade that changes the feature inventory can't silently shift every cost
# (and break reproducibility with doc/e7.6_poc_results.md).
FEATURE_COUNT = 24

# Precomposed POWSM tokens -> a form PanPhon's ipa_all.csv segments. A forward safety
# net: the POC found none of these in 72 observed tokens (POWSM emits the decomposed
# combining forms, which panphon covers natively), but map them in case a future
# model/token emits the precomposed codepoint.
NORM_MAP = {
    "ɫ": "l̴",   # velarized l (U+026B) -> l + combining velarized/pharyngealized (U+0334)
    "ɝ": "ɜ˞",  # rhotacized open-mid central -> ɜ + rhotacity hook
    "ɚ": "ə˞",  # rhotacized schwa -> ə + rhotacity hook
}

_ft = None


def _table():
    """Lazy PanPhon FeatureTable singleton (load once, per the ``mod/`` convention).

    Importing panphon here — not at module top — keeps ``import phone_features``
    working on the dev worker and in binary-only test paths that don't have panphon.
    """
    global _ft
    if _ft is None:
        import panphon

        _ft = panphon.FeatureTable()
        n = len(_ft.names)
        # A silent change here would shift every feature cost and every alignment.
        assert n == FEATURE_COUNT, (
            f"panphon feature count is {n}, expected {FEATURE_COUNT}; "
            "feature costs would shift — pin panphon or update FEATURE_COUNT."
        )
    return _ft


def _norm(tok):
    return NORM_MAP.get(tok, tok)


@functools.lru_cache(maxsize=None)
def _vec(tok):
    """24-int feature vector for a single phone, or ``None`` if PanPhon can't
    vectorize it to exactly one segment (after normalization). Memoized — the phone
    inventory is tiny (≤~72 tokens)."""
    vs = _table().word_to_vector_list(_norm(tok), numeric=True)
    return tuple(vs[0]) if len(vs) == 1 else None


@functools.lru_cache(maxsize=None)
def feature_sub_cost(a, b):
    """Substitution cost between two phones for the diff aligner.

    ``0.0`` for identical tokens; ``SCALE · (differing_features / 24)`` otherwise;
    ``UNCOVERED_COST`` (with a logged warning) if either token isn't PanPhon-covered.
    Pure + memoized, so injecting it into the Wagner-Fischer DP adds no real latency.
    Symmetric: ``feature_sub_cost(a, b) == feature_sub_cost(b, a)``.
    """
    if a == b:
        return 0.0
    va, vb = _vec(a), _vec(b)
    if va is None or vb is None:
        log.warning(
            "phone_features: uncovered token in pair (%r, %r); using fallback cost %.1f",
            a, b, UNCOVERED_COST,
        )
        return UNCOVERED_COST
    differing = sum(1 for x, y in zip(va, vb) if x != y)
    return SCALE * (differing / FEATURE_COUNT)
