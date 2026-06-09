"""Unit tests for mod/alignment.py (requires numpy, no GPU required)."""

import unittest

try:
    import numpy as np
    from alignment import (
        AFFRICATE_SPLITS,
        AlignerOutput,
        PAD_SECONDS,
        PhoneSegment,
        TARGET_SR,
        split_affricate_ligatures,
    )
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False


@unittest.skipUnless(HAS_DEPS, "numpy/alignment deps not installed")
class TestPhoneSegment(unittest.TestCase):
    def test_to_dict(self):
        seg = PhoneSegment(token="h", start_ms=0.0, end_ms=40.0, confidence=0.95)
        d = seg.to_dict()
        self.assertEqual(d["token"], "h")
        self.assertEqual(d["start_ms"], 0.0)
        self.assertEqual(d["end_ms"], 40.0)
        self.assertEqual(d["confidence"], 0.95)
        self.assertEqual(set(d.keys()), {"token", "start_ms", "end_ms", "confidence"})

    def test_to_dict_diphthong(self):
        seg = PhoneSegment(token="oʊ", start_ms=120.0, end_ms=200.0, confidence=0.87)
        d = seg.to_dict()
        self.assertEqual(d["token"], "oʊ")

    def test_to_dict_is_json_serializable(self):
        import json

        seg = PhoneSegment(token="ɛ", start_ms=40.0, end_ms=80.0, confidence=0.9)
        serialized = json.dumps(seg.to_dict())
        self.assertIsInstance(serialized, str)


@unittest.skipUnless(HAS_DEPS, "numpy/alignment deps not installed")
class TestAlignerOutput(unittest.TestCase):
    def test_to_dict(self):
        logprobs = np.zeros((10, 50), dtype=np.float32)
        out = AlignerOutput(
            logprobs=logprobs,
            n_frames=10,
            frame_stride_ms=40.0,
            blank_id=0,
            vocab=["<blank>", "/h/", "/ɛ/"],
        )
        d = out.to_dict()
        self.assertEqual(d["n_frames"], 10)
        self.assertEqual(d["frame_stride_ms"], 40.0)
        self.assertEqual(d["blank_id"], 0)
        self.assertEqual(d["vocab_size"], 3)
        self.assertNotIn("logprobs", d)

    def test_to_dict_is_json_serializable(self):
        import json

        out = AlignerOutput(
            logprobs=np.zeros((5, 10), dtype=np.float32),
            n_frames=5,
            frame_stride_ms=40.0,
            blank_id=0,
            vocab=["<blank>"],
        )
        serialized = json.dumps(out.to_dict())
        self.assertIsInstance(serialized, str)


@unittest.skipUnless(HAS_DEPS, "numpy/alignment deps not installed")
class TestPad20s(unittest.TestCase):
    def _make_aligner_stub(self):
        """Create a minimal object with _pad_20s without loading the model."""
        from alignment import POWSMAligner

        obj = object.__new__(POWSMAligner)
        return obj

    def test_short_audio_padded(self):
        aligner = self._make_aligner_stub()
        audio = np.ones(TARGET_SR, dtype=np.float32)  # 1 second
        padded = aligner._pad_20s(audio)
        self.assertEqual(len(padded), TARGET_SR * PAD_SECONDS)
        np.testing.assert_array_equal(padded[:TARGET_SR], audio)
        np.testing.assert_array_equal(padded[TARGET_SR:], 0.0)

    def test_exact_20s_unchanged(self):
        aligner = self._make_aligner_stub()
        audio = np.ones(TARGET_SR * PAD_SECONDS, dtype=np.float32)
        padded = aligner._pad_20s(audio)
        self.assertEqual(len(padded), TARGET_SR * PAD_SECONDS)
        np.testing.assert_array_equal(padded, audio)

    def test_longer_than_20s_truncated(self):
        aligner = self._make_aligner_stub()
        audio = np.ones(TARGET_SR * 25, dtype=np.float32)  # 25 seconds
        padded = aligner._pad_20s(audio)
        self.assertEqual(len(padded), TARGET_SR * PAD_SECONDS)
        np.testing.assert_array_equal(padded, 1.0)

    def test_empty_audio(self):
        aligner = self._make_aligner_stub()
        audio = np.array([], dtype=np.float32)
        padded = aligner._pad_20s(audio)
        self.assertEqual(len(padded), TARGET_SR * PAD_SECONDS)
        np.testing.assert_array_equal(padded, 0.0)


class TestIpaSlashReconstruction(unittest.TestCase):
    def test_single_phone(self):
        phones = ["h"]
        result = "".join(f"/{p}/" for p in phones)
        self.assertEqual(result, "/h/")

    def test_multiple_phones(self):
        phones = ["h", "ɛ", "l", "o", "ʊ"]
        result = "".join(f"/{p}/" for p in phones)
        self.assertEqual(result, "/h//ɛ//l//o//ʊ/")

    def test_empty_list(self):
        phones = []
        result = "".join(f"/{p}/" for p in phones)
        self.assertEqual(result, "")

    def test_diphthong_preserved(self):
        phones = ["aɪ"]
        result = "".join(f"/{p}/" for p in phones)
        self.assertEqual(result, "/aɪ/")


class TestSlashStripping(unittest.TestCase):
    def test_strip_slashes(self):
        self.assertEqual("/h/".strip("/"), "h")

    def test_diphthong_no_slashes(self):
        self.assertEqual("oʊ".strip("/"), "oʊ")

    def test_diphthong_with_slashes(self):
        self.assertEqual("/oʊ/".strip("/"), "oʊ")

    def test_bare_phone_unchanged(self):
        self.assertEqual("ɛ".strip("/"), "ɛ")


@unittest.skipUnless(HAS_DEPS, "numpy/alignment deps not installed")
class TestAffricateSplit(unittest.TestCase):
    def test_splits_ligature_at_midpoint(self):
        segs = split_affricate_ligatures(
            [PhoneSegment(token="d͡ʒ", start_ms=100.0, end_ms=200.0, confidence=0.8)]
        )
        self.assertEqual(len(segs), 2)
        self.assertEqual(segs[0].token, "d")
        self.assertEqual(segs[0].start_ms, 100.0)
        self.assertEqual(segs[0].end_ms, 150.0)
        self.assertEqual(segs[1].token, "ʒ")
        self.assertEqual(segs[1].start_ms, 150.0)
        self.assertEqual(segs[1].end_ms, 200.0)
        # confidence carried to both
        self.assertEqual(segs[0].confidence, 0.8)
        self.assertEqual(segs[1].confidence, 0.8)

    def test_all_ligatures_split_to_known_components(self):
        for lig, (a, b) in AFFRICATE_SPLITS.items():
            segs = split_affricate_ligatures(
                [PhoneSegment(token=lig, start_ms=0.0, end_ms=80.0, confidence=1.0)]
            )
            self.assertEqual([s.token for s in segs], [a, b], f"{lig} -> {a},{b}")

    def test_non_affricate_passes_through_unchanged(self):
        original = [
            PhoneSegment(token="d", start_ms=0.0, end_ms=40.0, confidence=0.9),
            PhoneSegment(token="ʒ", start_ms=40.0, end_ms=80.0, confidence=0.9),
            PhoneSegment(token="oʊ", start_ms=80.0, end_ms=120.0, confidence=0.7),
        ]
        result = split_affricate_ligatures(original)
        self.assertEqual(result, original)

    def test_output_never_contains_a_ligature(self):
        segs = split_affricate_ligatures(
            [
                PhoneSegment(token="h", start_ms=0.0, end_ms=40.0, confidence=1.0),
                PhoneSegment(token="t͡ʃ", start_ms=40.0, end_ms=120.0, confidence=0.6),
                PhoneSegment(token="i", start_ms=120.0, end_ms=160.0, confidence=1.0),
            ]
        )
        self.assertFalse(any(s.token in AFFRICATE_SPLITS for s in segs))
        self.assertEqual([s.token for s in segs], ["h", "t", "ʃ", "i"])


if __name__ == "__main__":
    unittest.main()
