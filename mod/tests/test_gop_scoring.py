import math
import os
import sys
import unittest
from types import SimpleNamespace

import numpy as np

# Add parent directory (mod/) to path so `gop_scoring` resolves.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gop_scoring import compute_gop, mean_entropy, mean_gop


# vocab[0] is blank, like POWSM. Phones carry POWSM's /.../ slashes.
VOCAB = ["<blank>", "/a/", "/b/"]
BLANK = 0
STRIDE = 40.0  # ms/frame


def _logprobs(prob_rows):
    """Natural-log CTC matrix from per-frame probability rows."""
    return np.log(np.array(prob_rows, dtype=np.float64))


def _seg(token, n_frames):
    """A PhoneSegment-like object spanning frames [0, n_frames)."""
    return SimpleNamespace(token=token, start_ms=0.0, end_ms=n_frames * STRIDE)


class TestComputeGop(unittest.TestCase):

    def test_confident_correct_has_positive_gop(self):
        # Model strongly favors the realized phone "a".
        lp = _logprobs([[0.01, 0.98, 0.01]] * 3)
        gops = compute_gop(lp, [_seg("a", 3)], VOCAB, BLANK, STRIDE)
        self.assertEqual(len(gops), 1)
        self.assertGreater(gops[0].gop_score, 0.0)
        self.assertFalse(gops[0].uncertain)

    def test_confident_wrong_has_negative_gop(self):
        # Phone aligned to "a" but the model actually puts mass on "b".
        lp = _logprobs([[0.01, 0.01, 0.98]] * 3)
        gops = compute_gop(lp, [_seg("a", 3)], VOCAB, BLANK, STRIDE)
        self.assertLess(gops[0].gop_score, 0.0)

    def test_ambiguous_is_uncertain(self):
        # Uniform over a 10-way vocab -> entropy ln(10) ~ 2.30 nats > 2.0.
        v = 10
        vocab = ["<blank>"] + [f"/p{i}/" for i in range(v - 1)]
        lp = _logprobs([[1.0 / v] * v] * 4)
        gops = compute_gop(lp, [_seg("p0", 4)], vocab, 0, STRIDE)
        self.assertAlmostEqual(gops[0].entropy, math.log(v), places=2)
        self.assertTrue(gops[0].uncertain)
        # Near-zero margin when everything is equally likely.
        self.assertLess(gops[0].margin, 0.05)

    def test_confident_has_low_entropy(self):
        lp = _logprobs([[0.01, 0.98, 0.01]] * 3)
        gops = compute_gop(lp, [_seg("a", 3)], VOCAB, BLANK, STRIDE)
        self.assertLess(gops[0].entropy, 0.5)

    def test_phone_absent_from_vocab_gives_none_gop_but_still_entropy(self):
        lp = _logprobs([[0.2, 0.4, 0.4]] * 2)
        gops = compute_gop(lp, [_seg("zzz", 2)], VOCAB, BLANK, STRIDE)
        self.assertIsNone(gops[0].gop_score)
        self.assertGreater(gops[0].entropy, 0.0)

    def test_frame_span_maps_via_stride(self):
        # Two phones over distinct frame spans; both resolve to >=1 frame.
        lp = _logprobs([[0.01, 0.98, 0.01], [0.01, 0.01, 0.98]])
        a = SimpleNamespace(token="a", start_ms=0.0, end_ms=40.0)
        b = SimpleNamespace(token="b", start_ms=40.0, end_ms=80.0)
        gops = compute_gop(lp, [a, b], VOCAB, BLANK, STRIDE)
        self.assertGreater(gops[0].gop_score, 0.0)  # frame 0 favors a
        self.assertGreater(gops[1].gop_score, 0.0)  # frame 1 favors b

    def test_zero_width_segment_clamps_to_one_frame(self):
        lp = _logprobs([[0.01, 0.98, 0.01]] * 2)
        z = SimpleNamespace(token="a", start_ms=40.0, end_ms=40.0)
        gops = compute_gop(lp, [z], VOCAB, BLANK, STRIDE)
        self.assertEqual(len(gops), 1)
        self.assertIsNotNone(gops[0].gop_score)


class TestAggregates(unittest.TestCase):

    def test_mean_entropy_empty(self):
        self.assertEqual(mean_entropy([]), 0.0)

    def test_mean_gop_skips_none(self):
        lp = _logprobs([[0.01, 0.98, 0.01]] * 2)
        gops = compute_gop(lp, [_seg("a", 2), _seg("zzz", 2)], VOCAB, BLANK, STRIDE)
        # One scorable phone, one absent -> mean over the scorable one only.
        self.assertIsNotNone(mean_gop(gops))
        self.assertAlmostEqual(mean_gop(gops), gops[0].gop_score, places=4)


if __name__ == "__main__":
    unittest.main()
