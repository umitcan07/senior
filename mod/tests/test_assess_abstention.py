"""Cascade-logic tests for the assess() orchestrator (#19/#20/#54).

Model-free: the heavy dependencies (audio download, VAD, the POWSM aligner, GOP)
are monkeypatched so we exercise the *abstention decision ordering and thresholds*
deterministically. The real model path is covered by mod/dev/verify.py + E2E.
"""

import contextlib
import os
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "assessment"))

try:
    import assess as assess_mod
    _IMPORTABLE = True
except Exception:
    _IMPORTABLE = False


def _sq(snr_db=20.0, duration=2.0):
    return {
        "is_acceptable": True,
        "quality_score": 1.0,
        "rms_db": -20.0,
        "clipping_ratio": 0.0,
        "silence_ratio": 0.1,
        "snr_estimate_db": snr_db,
        "duration_seconds": duration,
        "warnings": [],
        "suggestions": [],
    }


class _FakeAligner:
    def __init__(self, user_phones):
        self._phones = user_phones

    def encode(self, audio):
        return SimpleNamespace(
            logprobs=np.zeros((max(1, len(self._phones)), 3)),
            vocab=["<blank>", "/a/", "/b/"],
            blank_id=0,
            frame_stride_ms=40.0,
        )

    def free_alignment(self, audio):
        return [
            SimpleNamespace(token=p, start_ms=i * 40.0, end_ms=(i + 1) * 40.0, confidence=0.9)
            for i, p in enumerate(self._phones)
        ]

    def forced_alignment(self, audio, canonical_ipa):
        # One segment per non-"▁" target phone (mirrors POWSM tokenizer dropping ▁).
        nb = [p for p in canonical_ipa if p != "▁"]
        return [
            SimpleNamespace(token=p, start_ms=i * 40.0, end_ms=(i + 1) * 40.0, confidence=0.8)
            for i, p in enumerate(nb)
        ]


@unittest.skipUnless(_IMPORTABLE, "assess deps (e.g. requests) not installed")
class TestAbstentionCascade(unittest.TestCase):

    def _run(self, *, speech=True, snr=20.0, n_samples=32000, per=0.2,
             entropy=0.3, user_phones=("a",), diff_errors=None):
        """Drive assess() with all model deps stubbed. n_samples @16k sets duration."""
        if diff_errors is None:
            diff_errors = []
        audio = np.zeros(n_samples, dtype=np.float32)
        diff = {"errors": diff_errors, "alignment": [], "per": per}
        gop = SimpleNamespace(gop_score=1.0, entropy=entropy, uncertain=entropy > 2.0)
        with contextlib.ExitStack() as es:
            es.enter_context(mock.patch.object(assess_mod, "load_audio", return_value=(audio, 16000)))
            es.enter_context(mock.patch.object(assess_mod, "check_signal_quality", return_value=_sq(snr, n_samples / 16000)))
            es.enter_context(mock.patch.object(assess_mod, "has_speech", return_value=(speech, [])))
            es.enter_context(mock.patch.object(assess_mod.alignment, "get_aligner", return_value=_FakeAligner(list(user_phones))))
            es.enter_context(mock.patch.object(assess_mod, "phone_diff", return_value=diff))
            es.enter_context(mock.patch.object(assess_mod.gop_scoring, "compute_gop", return_value=[gop] * len(user_phones)))
            es.enter_context(mock.patch.object(assess_mod.gop_scoring, "mean_entropy", return_value=entropy))
            return assess_mod.assess("uri", reference_id="r", reference_phones=["a"])

    def test_no_speech(self):
        out = self._run(speech=False)
        self.assertEqual(out["status"], "abstained")
        self.assertEqual(out["abstention"]["reason"], "no_speech")

    def test_low_audio_quality(self):
        out = self._run(snr=3.0)
        self.assertEqual(out["abstention"]["reason"], "low_audio_quality")
        self.assertEqual(out["abstention"]["detail"]["snr_db"], 3.0)

    def test_duration_too_short(self):
        out = self._run(n_samples=int(0.2 * 16000))
        self.assertEqual(out["abstention"]["reason"], "duration_out_of_range")

    def test_duration_too_long(self):
        out = self._run(n_samples=int(30 * 16000))
        self.assertEqual(out["abstention"]["reason"], "duration_out_of_range")

    def test_wrong_sentence(self):
        out = self._run(per=0.9)
        self.assertEqual(out["abstention"]["reason"], "wrong_sentence")
        self.assertEqual(out["abstention"]["detail"]["per"], 0.9)

    def test_uncertain(self):
        out = self._run(per=0.2, entropy=2.5)
        self.assertEqual(out["abstention"]["reason"], "uncertain")

    def test_scored_happy_path(self):
        errs = [{"type": "sub", "user_position": 0, "ref_position": 0, "expected": "a", "actual": "b"}]
        out = self._run(per=0.2, entropy=0.3, user_phones=("b",), diff_errors=errs)
        self.assertEqual(out["status"], "scored")
        self.assertIn("score", out)
        self.assertEqual(len(out["errors"]), 1)
        self.assertEqual(out["errors"][0]["type"], "substitute")
        self.assertIsNotNone(out["confidence"])

    def test_deletion_gets_forced_timestamp(self):
        # A dropped target phone has no user segment, but forced alignment still
        # gives it a timestamp + target GOP.
        errs = [{"type": "del", "user_position": None, "ref_position": 0, "expected": "a", "actual": None}]
        out = self._run(per=0.2, entropy=0.3, user_phones=("b",), diff_errors=errs)
        self.assertEqual(out["status"], "scored")
        self.assertEqual(out["errors"][0]["type"], "delete")
        self.assertIsNotNone(out["errors"][0]["timestamp"])
        self.assertIsNotNone(out["errors"][0]["gop_score"])

    def test_speech_gate_precedes_quality(self):
        # No speech wins even when SNR is also bad — ordering check.
        out = self._run(speech=False, snr=1.0)
        self.assertEqual(out["abstention"]["reason"], "no_speech")


if __name__ == "__main__":
    unittest.main()
