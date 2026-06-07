"""Unit tests for the articulatory-feature substitution cost (E7.6 / issue #57).

Costs are transcribed from the POC self-tests in doc/e7.6_poc_results.md
(scale 2.0, divisor 24). Skipped wholesale if panphon isn't installed so the rest
of the suite still runs on a bare host.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import panphon  # noqa: F401

    _HAS_PANPHON = True
except Exception:  # noqa: BLE001
    _HAS_PANPHON = False

import phone_features as pf


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed")
class TestFeatureSubCost(unittest.TestCase):

    def test_identical_is_zero(self):
        # Exact-match short-circuit: never even consults the feature vectors.
        self.assertEqual(pf.feature_sub_cost("s", "s"), 0.0)
        self.assertEqual(pf.feature_sub_cost("eɪ", "eɪ"), 0.0)  # even for uncovered tokens

    def test_published_costs(self):
        # (pair, Δfeatures) from the committed POC results; cost = 2*(Δ/24).
        cases = [
            ("ɛ", "ɛ̃", 1),   # nasalization
            ("s", "z", 1),    # voicing
            ("ɪ", "i", 1),    # tenseness
            ("θ", "s", 2),    # TR-L1 think -> sink
            ("ɑ̃", "ɔ̃", 4),  # comment #2 nasal vowel pair
            ("w", "v", 7),    # TR-L1 wine/vine
            ("p", "i", 9),    # maximally different consonant/vowel
        ]
        for a, b, dfeat in cases:
            with self.subTest(pair=f"{a}/{b}"):
                self.assertAlmostEqual(
                    pf.feature_sub_cost(a, b), 2.0 * (dfeat / 24), places=4
                )

    def test_norm_map_tokens_vectorize(self):
        # The precomposed safety-net tokens must resolve to a single panphon segment.
        for tok in pf.NORM_MAP:
            with self.subTest(tok=tok):
                self.assertIsNotNone(
                    pf._vec(tok), f"NORM_MAP token {tok!r} did not vectorize"
                )
        # ɫ -> velarized l is a small (Δ1) difference from plain l, not a hard error.
        self.assertAlmostEqual(pf.feature_sub_cost("l", "ɫ"), 2.0 * (1 / 24), places=4)

    def test_uncovered_falls_back_to_two_and_logs(self):
        # A multi-codepoint diphthong vectorizes to >1 segment -> uncovered -> 2.0.
        pf.feature_sub_cost.cache_clear()  # ensure the warning actually fires
        with self.assertLogs(pf.log, level="WARNING"):
            cost = pf.feature_sub_cost("eɪ", "s")
        self.assertEqual(cost, pf.UNCOVERED_COST)
        self.assertEqual(cost, 2.0)

    def test_symmetry(self):
        for a, b in [("θ", "s"), ("w", "v"), ("ɪ", "i"), ("eɪ", "s")]:
            with self.subTest(pair=f"{a}/{b}"):
                self.assertEqual(
                    pf.feature_sub_cost(a, b), pf.feature_sub_cost(b, a)
                )

    def test_costs_within_bounds(self):
        inventory = ["s", "z", "θ", "ð", "t", "d", "w", "v", "ŋ", "n",
                     "ɹ", "ɾ", "æ", "a", "ɛ", "ə", "ɪ", "i", "ʊ", "u", "p"]
        for a in inventory:
            for b in inventory:
                c = pf.feature_sub_cost(a, b)
                self.assertGreaterEqual(c, 0.0)
                self.assertLessEqual(c, 2.0)

    def test_feature_count_is_24(self):
        # _table() asserts this; calling it here surfaces a panphon upgrade early.
        self.assertEqual(len(pf._table().names), pf.FEATURE_COUNT)


if __name__ == "__main__":
    unittest.main()
