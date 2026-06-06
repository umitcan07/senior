import os
import sys
import time
import unittest

import numpy as np

# Add parent dir (mod/) and the assessment package dir to path.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "assessment"))

try:
    import vad  # mod/assessment/vad.py
    from silero_vad import load_silero_vad  # noqa: F401
    _HAS_SILERO = True
except Exception:
    _HAS_SILERO = False


@unittest.skipUnless(_HAS_SILERO, "silero-vad not installed")
class TestVad(unittest.TestCase):

    def test_pure_silence_has_no_speech(self):
        silence = np.zeros(16000, dtype=np.float32)  # 1 s
        t0 = time.time()
        speech, regions = vad.has_speech(silence, sr=16000)
        elapsed = time.time() - t0
        self.assertFalse(speech)
        self.assertEqual(regions, [])
        # Acceptance (#18): silence resolves quickly. Loose bound (first call may
        # JIT/torch-warm); a CPU pass on 1 s is well under this.
        self.assertLess(elapsed, 5.0)

    def test_returns_tuple_shape(self):
        speech, regions = vad.has_speech(np.zeros(8000, dtype=np.float32))
        self.assertIsInstance(speech, bool)
        self.assertIsInstance(regions, list)


if __name__ == "__main__":
    unittest.main()
