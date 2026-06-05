#!/usr/bin/env python3
"""
Smoke test for mod/alignment.py — run inside the worker-assessment container.

Usage (from repo root):
  docker compose -f docker-compose.dev.yml exec worker-assessment \
    python3 /worker/dev/test_alignment_smoke.py

Or standalone:
  docker run --rm --gpus all \
    -v "$PWD/mod:/worker/mod" \
    -e HF_HOME=/runpod-volume/.cache/huggingface \
    senior-worker-assessment:latest \
    python3 /worker/dev/test_alignment_smoke.py
"""
import time
import sys
import numpy as np


def main():
    print("=== POWSMAligner smoke test ===\n")

    # 1. Import test
    print("1. Importing POWSMAligner...")
    t0 = time.time()
    from alignment import POWSMAligner, get_aligner
    print(f"   Import OK ({time.time() - t0:.2f}s)")

    # 2. Init (loads model)
    print("\n2. Loading model...")
    t0 = time.time()
    aligner = get_aligner()
    load_time = time.time() - t0
    print(f"   Model loaded on {aligner.device} ({load_time:.2f}s)")
    print(f"   frame_sec={aligner.frame_sec}, blank_id={aligner.blank_id}, "
          f"vocab_size={len(aligner.token_list)}")

    # 3. Singleton test
    aligner2 = get_aligner()
    assert aligner is aligner2, "Singleton broken!"
    print("   Singleton OK")

    # 4. Generate a test tone (1kHz sine, 2 seconds) — not real speech,
    #    but enough to verify the pipeline doesn't crash
    print("\n3. Testing with synthetic audio (2s sine wave)...")
    sr = 16000
    duration = 2.0
    t = np.linspace(0, duration, int(sr * duration), dtype=np.float32)
    audio = 0.5 * np.sin(2 * np.pi * 440 * t)

    # 4a. encode()
    t0 = time.time()
    enc_out = aligner.encode(audio)
    enc_time = time.time() - t0
    print(f"   encode(): logprobs shape={enc_out.logprobs.shape}, "
          f"n_frames={enc_out.n_frames}, stride={enc_out.frame_stride_ms}ms ({enc_time:.3f}s)")
    assert enc_out.logprobs.shape[0] == enc_out.n_frames
    assert enc_out.logprobs.shape[1] == len(enc_out.vocab)
    assert enc_out.frame_stride_ms == 40.0

    # 4b. free_alignment()
    t0 = time.time()
    free_segs = aligner.free_alignment(audio)
    free_time = time.time() - t0
    print(f"   free_alignment(): {len(free_segs)} segments ({free_time:.3f}s)")
    for s in free_segs[:5]:
        print(f"     {s.token:6s}  {s.start_ms:8.1f} - {s.end_ms:8.1f} ms  conf={s.confidence:.4f}")
    if len(free_segs) > 5:
        print(f"     ... ({len(free_segs) - 5} more)")

    # 4c. forced_alignment() — POWSM uses monophthongs, not diphthongs
    test_phones = ["h", "ɛ", "l", "o", "ʊ"]
    print(f"\n4. Forced alignment with {test_phones}...")
    t0 = time.time()
    forced_segs = aligner.forced_alignment(audio, test_phones)
    forced_time = time.time() - t0
    print(f"   forced_alignment(): {len(forced_segs)} segments ({forced_time:.3f}s)")
    for s in forced_segs:
        print(f"     {s.token:6s}  {s.start_ms:8.1f} - {s.end_ms:8.1f} ms  conf={s.confidence:.4f}")

    # Validate forced alignment constraints
    assert len(forced_segs) > 0, "No segments returned"
    for s in forced_segs:
        assert 0 <= s.start_ms <= 20000, f"start_ms out of range: {s.start_ms}"
        assert 0 <= s.end_ms <= 20000, f"end_ms out of range: {s.end_ms}"
        assert s.start_ms <= s.end_ms, f"start > end: {s.start_ms} > {s.end_ms}"
    # Monotonically non-decreasing starts
    starts = [s.start_ms for s in forced_segs]
    assert starts == sorted(starts), f"Non-monotonic starts: {starts}"

    # 5. to_dict() serialization
    d = forced_segs[0].to_dict()
    assert set(d.keys()) == {"token", "start_ms", "end_ms", "confidence"}
    ed = enc_out.to_dict()
    assert "logprobs" not in ed

    # 6. Determinism: encode same audio twice, check shapes match
    print("\n5. Determinism check...")
    enc_out2 = aligner.encode(audio)
    assert enc_out.logprobs.shape == enc_out2.logprobs.shape
    assert enc_out.n_frames == enc_out2.n_frames
    # Values should be very close (floating point)
    diff = np.abs(enc_out.logprobs - enc_out2.logprobs).max()
    print(f"   Max logprob diff between runs: {diff:.2e}")
    assert diff < 1e-4, f"Non-deterministic: max diff {diff}"

    print("\n=== ALL SMOKE TESTS PASSED ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
